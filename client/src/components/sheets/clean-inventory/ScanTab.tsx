import { useRef, useState, useMemo, useCallback } from "react";
import { ScanningInput, type ScanningInputRef } from "@/components/scanning/scanning-input";
import { DataTable } from "./DataTable";
// TODO: Will update Adding new device on future push
// import { AddDeviceDialog } from "./AddDeviceDialog";
import { GoogleSheet } from "../../../services/sheets-service";
import { useRowSelection } from "./hooks/useRowSelection";
import { useModelSelection } from "./hooks/useModelSelection";
import { useLocationSelection } from "./hooks/useLocationSelection";
import { useSheetDataEditor } from "./hooks/useSheetDataEditor";
import { useChangeTracker } from "./hooks/useChangeTracker";
import { useContainerClick } from "./hooks/useContainerClick";
import { calculateSyncStatusText } from "./utils/syncStatusHelpers";
import { InventoryHeader } from "./components/InventoryHeader";
import { LoadingSpinner, EmptyDataState } from "./components/LoadingStates";
import { DataQualityPanel } from "./components/DataQualityPanel";
import { useToast } from '@/hooks/use-toast';
import { getDataRowsOnly, computeHeaderContext, addTypeFieldToData } from "@/utils/header-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

type SheetRow = Record<string, string>;

interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role?: string;
}

interface ScanTabProps {
  user: User;
  localSheetData: SheetRow[];
  setLocalSheetData: (data: SheetRow[]) => void;
  originalSheetData: SheetRow[]; // Add original data for change tracking
  selectedRows: Set<number>;
  setSelectedRows: (rows: Set<number>) => void;
  selectAll: boolean;
  setSelectAll: (selectAll: boolean) => void;
  tableHeaders: string[];
  hasUnsyncedChanges: boolean;
  setHasUnsyncedChanges: (hasChanges: boolean) => void;
  isLoading: boolean;
  handleRefresh: (clearChanges?: () => void) => void;
  handlePushChanges: (changedRowsOnly?: SheetRow[], clearChanges?: () => void) => void; // Add support for selective sync
  getColumnDisplayName: (columnKey: string) => string;
  mappings?: Array<{fieldKey?: string, fieldName?: string, columnLetter: string}>; // Add mappings prop
  refreshDataMutation: any;
  pushChangesMutation: any;
  currentSheet?: GoogleSheet | null;
  selectedTabName?: string; // Add tab name for tab-specific data loading
}

export function ScanTab({
  user,
  localSheetData,
  setLocalSheetData,
  originalSheetData,
  selectedRows,
  setSelectedRows,
  selectAll,
  setSelectAll,
  tableHeaders,
  hasUnsyncedChanges,
  setHasUnsyncedChanges,
  isLoading,
  handleRefresh,
  handlePushChanges,
  getColumnDisplayName,
  mappings = [], // Add mappings with default
  refreshDataMutation,
  pushChangesMutation,
  currentSheet,
  selectedTabName, // Add tab name parameter
}: ScanTabProps) {
  const { toast } = useToast();
  const scanningInputRef = useRef<ScanningInputRef>(null);
  
  // Scan Mode state
  const [scanMode, setScanMode] = useState<'decommission' | 'installed' | 'damaged' | 'disconnected' | null>(null);
  
  // Image Mode state
  const [imageMode, setImageMode] = useState<'staff' | 'public' | 'server' | 'lab' | null>(null);
  
  // Filter state
  const [currentFilter, setCurrentFilter] = useState<string>("all");
  
  // Add Device Dialog state
  // TODO: Will update Adding new device on future push
  // const [showAddDeviceDialog, setShowAddDeviceDialog] = useState(false);
  // TODO: Will update Adding new device on future push
  // const [scannedValue, setScannedValue] = useState("");
  // const [scannedType, setScannedType] = useState<'serial' | 'asset'>('asset');
  
  // Calculate derived values (syncStatusText only)
  const syncStatusText = calculateSyncStatusText(currentSheet?.lastSyncAt);

  // SIMPLIFIED FIX: Just track where real headers start (everything above gets skipped)
  const { cleanDataRows, headerOffset } = useMemo(() => {
    // Guard against undefined/null data during rapid re-renders
    if (!localSheetData || !Array.isArray(localSheetData) || localSheetData.length === 0) {
      return { cleanDataRows: [], headerOffset: 0 };
    }
    // Create header context for proper header detection with smart field-name matching
    const headerContext = computeHeaderContext(localSheetData, mappings, currentSheet?.sheetName);
    // Get only real data rows 
    const dataRowsOnly = getDataRowsOnly(localSheetData, headerContext);
    // Add type field for filtering
    const dataWithType = addTypeFieldToData(dataRowsOnly);
    // Simple offset: everything above the real headers gets skipped
    const headerOffset = headerContext.headerRowIndex + 1;
    
    
    return { cleanDataRows: dataWithType, headerOffset };
  }, [localSheetData, mappings, currentSheet?.sheetName]); // Include mappings to prevent stale headerOffset

  // Filter logic for clean data with original index mapping
  const { filteredData, originalIndexMap } = useMemo(() => {
    if (currentFilter === "all" || cleanDataRows.length === 0) {
      const indexMap = cleanDataRows.map((_, index) => index);
      return { filteredData: cleanDataRows, originalIndexMap: indexMap };
    }
    
    // Find the actual Type column from the sheet (if it exists)
    const typeColumn = tableHeaders.find(header => {
      const displayName = getColumnDisplayName(header).toLowerCase();
      return displayName.includes('type') && !displayName.includes('scanned');
    });
    
    // Find Manufacturer column for Epson filter
    const manufacturerColumn = tableHeaders.find(header => {
      const displayName = getColumnDisplayName(header).toLowerCase();
      return displayName.includes('manufacturer');
    });
    
    // Filter rows and maintain original index mapping
    const filteredRows: any[] = [];
    const indexMap: number[] = [];
    
    cleanDataRows.forEach((row, originalIndex) => {
      let shouldInclude = false;
      
      if (currentFilter === "printer-epson") {
        // Special filter for Epson printers: filter by both Type and Manufacturer
        // Try Type column first, fallback to _type field
        const type = typeColumn 
          ? (row[typeColumn] || '').toString().toLowerCase() 
          : (row['_type'] || '').toString().toLowerCase();
        const manufacturer = manufacturerColumn 
          ? (row[manufacturerColumn] || '').toString().toLowerCase()
          : (row['_manufacturer'] || '').toString().toLowerCase();
        shouldInclude = type === 'printer' && manufacturer === 'epson';
      } else {
        // Regular type filter
        const filterValue = currentFilter.toLowerCase();
        
        if (typeColumn) {
          // STRICT TYPE ENFORCEMENT: Type column exists - ONLY use that column, never auto-detect
          // If Type is empty, the item won't match any filter (only shows in "All")
          const sheetType = (row[typeColumn] || '').toString().toLowerCase().trim();
          shouldInclude = sheetType === filterValue;
        } else {
          // No Type column exists - fallback to auto-detected type
          const detectedType = (row['_type'] || '').toString().toLowerCase().trim();
          shouldInclude = detectedType === filterValue;
        }
      }
      
      if (shouldInclude) {
        filteredRows.push(row);
        indexMap.push(originalIndex);
      }
    });
    
    return { filteredData: filteredRows, originalIndexMap: indexMap };
  }, [cleanDataRows, currentFilter, tableHeaders, getColumnDisplayName]);

  // Calculate item count from filtered data (no need to subtract 1 since we already filtered out headers)
  const dataRowCount = Math.max(0, filteredData.length);

  // Initialize custom hooks (calculate total rows from clean data)
  const rowSelection = useRowSelection({
    selectedRows,
    setSelectedRows,
    setSelectAll,
    totalRows: dataRowCount
  });
  
  // Initialize change tracker for selective sync and persistence (must be before hooks that use trackCellChange)
  const changeTracker = useChangeTracker({
    sheetId: currentSheet?.id || '',
    originalData: originalSheetData,
    localData: localSheetData,
    setLocalData: setLocalSheetData,
    headerOffset
  });
  
  const modelSelection = useModelSelection({
    localSheetData,
    setLocalSheetData,
    setHasUnsyncedChanges,
    tableHeaders,
    getColumnDisplayName,
    headerOffset
  });
  
  const locationSelection = useLocationSelection({
    localSheetData,
    setLocalSheetData,
    setHasUnsyncedChanges,
    tableHeaders,
    getColumnDisplayName,
    headerOffset
  });

  const sheetDataEditor = useSheetDataEditor({
    localSheetData,
    setLocalSheetData,
    setHasUnsyncedChanges,
    selectedRows,
    tableHeaders,
    getColumnDisplayName,
    user,
    mappings,
    trackCellChange: changeTracker.trackCellChange,
    headerOffset
  });
  
  // Auto-highlight rows when status changes to "Missing"
  const autoHighlightMissing = useCallback(async (rowIndex: number) => {
    if (!currentSheet?.id) return;
    
    // rowIndex is an index into cleanDataRows (data only, no headers)
    // Convert to localSheetData index by adding headerOffset
    const localSheetDataIndex = rowIndex + headerOffset;
    const row = localSheetData[localSheetDataIndex];
    if (!row) return;
    
    // API expects 0-based index where 0 is the header row
    // The localSheetDataIndex is already the correct 0-based sheet position
    const actualRowIndex = localSheetDataIndex;
    
    console.log('🎨 Highlighting row:', { rowIndex, localSheetDataIndex, actualRowIndex, headerOffset });
    
    try {
      const response = await fetch(`/api/sheets/${currentSheet.id}/highlight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies for authentication
        body: JSON.stringify({
          rowIndices: [actualRowIndex],
          color: { red: 1, green: 1, blue: 0 }, // Bright yellow
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error('Failed to auto-highlight missing item:', errorData);
      }
    } catch (error) {
      console.error('Failed to auto-highlight missing item:', error);
    }
  }, [currentSheet?.id, localSheetData, headerOffset]);

  // FIXED: Map filtered index to original index for proper data editing
  const handleEditStatusWithMapping = useCallback((filteredRowIndex: number, header: string, newValue: string) => {
    const originalIndex = originalIndexMap[filteredRowIndex];
    if (originalIndex !== undefined) {
      sheetDataEditor.handleEditStatus(originalIndex, header, newValue);
      
      // Check if this is a Status column update to "Missing"
      const displayName = getColumnDisplayName(header).toLowerCase();
      if (displayName === 'status' && newValue.toLowerCase() === 'missing') {
        autoHighlightMissing(originalIndex);
      }
    }
  }, [sheetDataEditor.handleEditStatus, originalIndexMap, getColumnDisplayName, autoHighlightMissing]);
  
  const handleModelIdSelectWithMapping = useCallback((filteredRowIndex: number, model: any) => {
    const originalIndex = originalIndexMap[filteredRowIndex];
    if (originalIndex !== undefined && modelSelection.handleModelIdSelect) {
      modelSelection.handleModelIdSelect(originalIndex, model);
    }
  }, [modelSelection.handleModelIdSelect, originalIndexMap]);
  
  const handleLocationSelectWithMapping = useCallback((filteredRowIndex: number, location: any) => {
    const originalIndex = originalIndexMap[filteredRowIndex];
    if (originalIndex !== undefined && locationSelection.handleLocationSelect) {
      locationSelection.handleLocationSelect(originalIndex, location);
    }
  }, [locationSelection.handleLocationSelect, originalIndexMap]);

  // Map row selection handlers to use original indices
  const handleToggleRowWithMapping = useCallback((filteredRowIndex: number, checked: boolean) => {
    const originalIndex = originalIndexMap[filteredRowIndex];
    if (originalIndex !== undefined) {
      rowSelection.handleToggleRow(originalIndex, checked);
    }
  }, [rowSelection.handleToggleRow, originalIndexMap]);

  const handleBatchUpdateSelectionWithMapping = useCallback((rowsToSelect: number[], rowsToDeselect: number[]) => {
    // Map filtered indices to original indices
    const originalRowsToSelect = rowsToSelect.map(index => originalIndexMap[index]).filter(index => index !== undefined);
    const originalRowsToDeselect = rowsToDeselect.map(index => originalIndexMap[index]).filter(index => index !== undefined);
    
    if (originalRowsToSelect.length > 0 || originalRowsToDeselect.length > 0) {
      rowSelection.batchUpdateSelection(originalRowsToSelect, originalRowsToDeselect);
    }
  }, [rowSelection.batchUpdateSelection, originalIndexMap]);

  // Map selection state from original indices to filtered indices for rendering
  const filteredSelectedRows = useMemo(() => {
    const filtered = new Set<number>();
    filteredData.forEach((_, filteredIndex) => {
      const originalIndex = originalIndexMap[filteredIndex];
      if (originalIndex !== undefined && selectedRows.has(originalIndex)) {
        filtered.add(filteredIndex);
      }
    });
    return filtered;
  }, [selectedRows, originalIndexMap, filteredData]);

  // Check if all filtered rows are selected
  const selectAllFiltered = useMemo(() => {
    if (filteredData.length === 0) return false;
    return filteredData.every((_, filteredIndex) => {
      const originalIndex = originalIndexMap[filteredIndex];
      return originalIndex !== undefined && selectedRows.has(originalIndex);
    });
  }, [selectedRows, originalIndexMap, filteredData]);

  // Handle toggle all for filtered view
  const handleToggleAllWithMapping = useCallback((checked: boolean) => {
    if (checked) {
      // Select all filtered rows (map to original indices)
      const originalIndices = originalIndexMap.filter(index => index !== undefined);
      rowSelection.batchUpdateSelection(originalIndices, []);
    } else {
      // Deselect all filtered rows (map to original indices)
      const originalIndices = originalIndexMap.filter(index => index !== undefined);
      rowSelection.batchUpdateSelection([], originalIndices);
    }
  }, [rowSelection.batchUpdateSelection, originalIndexMap]);

  // Filter change handler
  const handleFilterChange = (filter: string) => {
    setCurrentFilter(filter);
    // Clear selection when filter changes
    rowSelection.clearSelection();
  };

  // Enhanced sync function with selective sync
  const handleSelectivePushChanges = () => {
    const changedRows = changeTracker.getChangedRowsForSync();
    if (changedRows.length > 0) {
      handlePushChanges(changedRows, changeTracker.clearChanges);
    } else {
      handlePushChanges(); // Fall back to full sync if no changes detected
    }
  };
  
  const containerClick = useContainerClick({
    selectedRows,
    clearSelection: rowSelection.clearSelection
  });

  const handleScan = (value: string) => {
    console.log("Scanned:", value);
    
    // Find columns for matching and updating
    const serialColumns = tableHeaders.filter(header => {
      const displayName = getColumnDisplayName(header).toLowerCase();
      return displayName.includes('serial') && !displayName.includes('scanned');
    });
    
    const assetTagColumns = tableHeaders.filter(header => {
      const displayName = getColumnDisplayName(header).toLowerCase();
      return (displayName.includes('asset') && displayName.includes('tag')) || 
             displayName.includes('asset tag') ||
             (displayName.includes('asset') && !displayName.includes('scanned'));
    });
    
    const scannedSnColumns = tableHeaders.filter(header => {
      const displayName = getColumnDisplayName(header).toLowerCase();
      return displayName.includes('scanned') && (
        displayName.includes('sn') || 
        displayName.includes('serial number') ||
        displayName.includes('serial')
      );
    });
    
    const scannedAssetColumns = tableHeaders.filter(header => {
      const displayName = getColumnDisplayName(header).toLowerCase();
      return displayName.includes('scanned') && displayName.includes('asset');
    });
    
    // Search for the value in the data (use cleanDataRows which already has headers removed)
    let foundRowIndex = -1;
    let foundColumn = '';
    let matchType = ''; // 'serial' or 'asset'
    
    for (let rowIndex = 0; rowIndex < cleanDataRows.length; rowIndex++) {
      const row = cleanDataRows[rowIndex];
      
      // Check serial number columns first
      for (const serialColumn of serialColumns) {
        const cellValue = (row[serialColumn] || '').toString().trim();
        if (cellValue && cellValue.toLowerCase() === value.toLowerCase()) {
          foundRowIndex = rowIndex;
          foundColumn = serialColumn;
          matchType = 'serial';
          break;
        }
      }
      
      // If not found in serial columns, check asset tag columns
      if (foundRowIndex === -1) {
        for (const assetColumn of assetTagColumns) {
          const cellValue = (row[assetColumn] || '').toString().trim();
          if (cellValue && cellValue.toLowerCase() === value.toLowerCase()) {
            foundRowIndex = rowIndex;
            foundColumn = assetColumn;
            matchType = 'asset';
            break;
          }
        }
      }
      
      if (foundRowIndex !== -1) break;
    }
    
    if (foundRowIndex === -1) {
      // Determine scan type based on value format (NYPL asset tags: A + 6 digits)
      const assetTagPattern = /^[A]\d{6}$/;
      const serialNumberPattern = /^[A-Za-z0-9-]{5,}$/;
      
      let determinedScanType: 'serial' | 'asset' = 'asset'; // Default to asset
      
      if (assetTagPattern.test(value)) {
        determinedScanType = 'asset';
      } else if (serialNumberPattern.test(value) && !assetTagPattern.test(value)) {
        determinedScanType = 'serial';
      } else {
        // If no pattern matches, use heuristic based on available columns
        if (assetTagColumns.length > 0 && serialColumns.length === 0) {
          determinedScanType = 'asset';
        } else if (serialColumns.length > 0 && assetTagColumns.length === 0) {
          determinedScanType = 'serial';
        }
        // Otherwise default to 'asset'
      }
      
      // Show add device dialog instead of toast
      // TODO: Will update Adding new device on future push
      // setScannedValue(value);
      // setScannedType(determinedScanType);
      // TODO: Will update Adding new device on future push
      // setShowAddDeviceDialog(true);
      toast({
        title: "Item Not Found",
        description: "Item Not Found. Adding new devices will be updated in a future release.",
        variant: "default"
      });
      return;
    }
    
    // Determine which scanned column to update based on match type
    let targetColumn = '';
    let fieldName = '';
    
    if (matchType === 'serial' && scannedSnColumns.length > 0) {
      targetColumn = scannedSnColumns[0];
      fieldName = 'Scanned Sn';
    } else if (matchType === 'asset' && scannedAssetColumns.length > 0) {
      targetColumn = scannedAssetColumns[0];
      fieldName = 'Scanned Asset';
    } else {
      toast({
        title: "Column Not Found",
        description: `No appropriate scanned column found for ${matchType === 'serial' ? 'serial numbers' : 'asset tags'}.`,
        duration: 3000,
      });
      return;
    }
    
    // Update the appropriate scanned field for the found row
    const currentValue = cleanDataRows[foundRowIndex][targetColumn] || '';
    
    // Get the actual _rowIndex from the found row data
    // This is the original Google Sheets row number, preserved when filtering empty rows
    const foundRow = cleanDataRows[foundRowIndex];
    const actualRowIndex = (foundRow as any)._rowIndex;
    
    // handleEditStatus adds headerOffset to the rowIndex, so we need to subtract it
    const adjustedRowIndex = actualRowIndex - headerOffset;
    
    // Only update scanned column if the value is different
    if (currentValue.trim() !== value.trim()) {
      // If scan mode is active, use the combined update function
      if (scanMode) {
        // Find Status column using mappings
        const statusMapping = mappings.find(m => {
          const fieldKey = m.fieldKey?.toLowerCase() || '';
          const fieldName = m.fieldName?.toLowerCase() || '';
          return fieldKey === 'status' || fieldName === 'status';
        });
        
        const statusColumn = statusMapping?.columnLetter;
        
        if (statusColumn) {
          const statusValue = 
            scanMode === 'decommission' ? 'Decommissioned' :
            scanMode === 'installed' ? 'Installed' :
            scanMode === 'damaged' ? 'Damaged' :
            scanMode === 'disconnected' ? 'Disconnected' : 'Installed';
          
          // Find Image column if imageMode is set
          let imageColumn = null;
          let imageValue = null;
          if (imageMode) {
            const imageMapping = mappings.find(m => {
              const fieldKey = m.fieldKey?.toLowerCase() || '';
              const fieldName = m.fieldName?.toLowerCase() || '';
              return fieldKey === 'image' || fieldName === 'image';
            });
            imageColumn = imageMapping?.columnLetter || null;
            imageValue = imageMode.charAt(0).toUpperCase() + imageMode.slice(1); // Capitalize: Staff, Public, Server, Lab
          }
          
          // Use the new combined function that updates Status (with auto-fill), Image (if set), AND scanned column
          sheetDataEditor.handleScanWithMode(adjustedRowIndex, statusColumn, statusValue, targetColumn, value, imageColumn, imageValue);
        } else {
          // Fallback: Just update scanned column
          sheetDataEditor.handleEditStatus(adjustedRowIndex, targetColumn, value);
        }
      } else {
        // No scan mode: Just update scanned column
        sheetDataEditor.handleEditStatus(adjustedRowIndex, targetColumn, value);
      }
      
      setHasUnsyncedChanges(true);
      
      toast({
        title: `${matchType === 'serial' ? 'Serial Number' : 'Asset Tag'} Scanned`,
        description: scanMode 
          ? `Scanned and marked as ${
              scanMode === 'decommission' ? 'Decommissioned' :
              scanMode === 'installed' ? 'Installed' :
              scanMode === 'damaged' ? 'Damaged' :
              scanMode === 'disconnected' ? 'Disconnected' : 'Installed'
            }.`
          : `Successfully updated ${fieldName} for "${value}".`,
        variant: "success",
        duration: 3000,
      });
    } else {
      toast({
        title: "Already Scanned",
        description: `${matchType === 'serial' ? 'Serial' : 'Asset'} "${value}" is already marked as scanned.`,
        duration: 3000,
        className: "border-l-4 border-l-[#FFC107] bg-amber-50",
      });
    }
  };

  // TODO: Will update Adding new device on future push
  // Handle adding new device from dialog
  // const handleAddDevice = useCallback(async (deviceData: any): Promise<boolean> => {
  //   console.log("Adding new device:", deviceData);
  //   
  //   if (!mappings || mappings.length === 0) {
  //     toast({
  //       title: "Error",
  //       description: "No column mappings available. Please configure mappings first.",
  //       variant: "destructive"
  //     });
  //     return false;
  //   }
  //
  //   // Create new row with device data mapped to sheet columns
  //   const newRow: SheetRow = {};
  //   
  //   // Initialize all mapped columns with empty values
  //   mappings.forEach(mapping => {
  //     newRow[mapping.columnLetter] = "";
  //   });
  //
  //   // Map device data to appropriate columns based on field names
  //   mappings.forEach(mapping => {
  //     const fieldName = mapping.fieldName?.toLowerCase() || '';
  //     const fieldKey = mapping.fieldKey?.toLowerCase() || '';
  //     
  //     // Map the device data fields to sheet columns
  //     if (fieldName.includes('status') && deviceData.status) {
  //       newRow[mapping.columnLetter] = deviceData.status;
  //     } else if (fieldName.includes('equipment move') && deviceData.equipmentMove) {
  //       newRow[mapping.columnLetter] = deviceData.equipmentMove;
  //     } else if (fieldName.includes('serial') && !fieldName.includes('scanned') && deviceData.serialNumber) {
  //       newRow[mapping.columnLetter] = deviceData.serialNumber;
  //     } else if (fieldName.includes('product number') && deviceData.productNumber) {
  //       newRow[mapping.columnLetter] = deviceData.productNumber;
  //     } else if (fieldName.includes('asset tag') && !fieldName.includes('scanned') && deviceData.assetTag) {
  //       newRow[mapping.columnLetter] = deviceData.assetTag;
  //     } else if (fieldName.includes('model id') && deviceData.modelId) {
  //       newRow[mapping.columnLetter] = deviceData.modelId;
  //     } else if (fieldName.includes('type') && !fieldName.includes('device') && deviceData.type) {
  //       newRow[mapping.columnLetter] = deviceData.type;
  //     } else if (fieldName.includes('manufacturer') && deviceData.manufacturer) {
  //       newRow[mapping.columnLetter] = deviceData.manufacturer;
  //     } else if (fieldName.includes('name') && !fieldName.includes('device') && deviceData.name) {
  //       // This is the Name field (Model ID + Serial), not Device Name
  //       newRow[mapping.columnLetter] = deviceData.name;
  //     } else if (fieldName.includes('location') && !fieldName.includes('physical') && !fieldName.includes('code') && deviceData.location) {
  //       newRow[mapping.columnLetter] = deviceData.location;
  //     } else if (fieldName.includes('assigned to') && deviceData.assignedTo) {
  //       newRow[mapping.columnLetter] = deviceData.assignedTo;
  //     } else if (fieldName.includes('physical location') && deviceData.physicalLocation) {
  //       newRow[mapping.columnLetter] = deviceData.physicalLocation;
  //     } else if (fieldName.includes('device name') && deviceData.deviceName) {
  //       newRow[mapping.columnLetter] = deviceData.deviceName;
  //     } else if (fieldName.includes('image') && deviceData.image) {
  //       newRow[mapping.columnLetter] = deviceData.image;
  //     } else if (fieldName.includes('technician') && user?.name) {
  //       // Auto-fill technician with current user
  //       newRow[mapping.columnLetter] = user.name;
  //     } else if (fieldName.includes('scanned sn') && scannedType === 'serial') {
  //       // Auto-fill scanned serial number
  //       newRow[mapping.columnLetter] = scannedValue;
  //     } else if (fieldName.includes('scanned asset') && scannedType === 'asset') {
  //       // Auto-fill scanned asset tag
  //       newRow[mapping.columnLetter] = scannedValue;
  //     } else if (fieldName.includes('last verified') || fieldName.includes('verification date')) {
  //       // Auto-fill verification date
  //       newRow[mapping.columnLetter] = new Date().toLocaleDateString();
  //     }
  //   });
  //
  //   // Add the new row to localSheetData
  //   const updatedData = [...localSheetData, newRow];
  //   setLocalSheetData(updatedData);
  //   setHasUnsyncedChanges(true);
  //   
  //   // Mark all populated fields in the new row as changed for visual indication
  //   const newRowIndex = updatedData.length - 2; // -1 for array index, -1 for header row
  //   Object.entries(newRow).forEach(([columnLetter, value]) => {
  //     if (value && value.trim() !== '') {
  //       // Call trackCellChange to mark this cell as changed
  //       changeTracker.trackCellChange(newRowIndex, columnLetter, '', value);
  //     }
  //   });
  //
  //   toast({
  //     title: "Device Added",
  //     description: `Successfully added device. Remember to sync changes to save to the sheet.`,
  //     variant: "success"
  //   });
  //   
  //   return true; // Return true to indicate success
  // }, [mappings, localSheetData, setLocalSheetData, setHasUnsyncedChanges, user, scannedType, scannedValue, toast]);





  // Handle loading and empty states
  if (isLoading && !localSheetData.length) {
    return <LoadingSpinner />;
  }

  if (localSheetData.length === 0) {
    return <EmptyDataState />;
  }

  return (
    <div onClick={containerClick.handleContainerClick} className="flex flex-col flex-1 min-h-0">
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Scan Asset Tag/Serial Number
              </h3>
              {scanMode && (
                <Badge 
                  variant="secondary" 
                  className="flex items-center gap-1.5 px-3 py-1"
                >
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  {scanMode === 'decommission' ? 'Decommissioned' :
                   scanMode === 'installed' ? 'Installed' :
                   scanMode === 'damaged' ? 'Damaged' :
                   scanMode === 'disconnected' ? 'Disconnected' : 'Installed'}
                  <button
                    onClick={() => setScanMode(null)}
                    className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {imageMode && (
                <Badge 
                  variant="secondary" 
                  className="flex items-center gap-1.5 px-3 py-1"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  {imageMode.charAt(0).toUpperCase() + imageMode.slice(1)}
                  <button
                    onClick={() => setImageMode(null)}
                    className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ScanningInput ref={scanningInputRef} onScan={handleScan} />
              </div>
              <div className="w-48">
                <Select
                  value={scanMode || 'none'}
                  onValueChange={(value) => setScanMode(value === 'none' ? null : value as 'decommission' | 'installed' | 'damaged' | 'disconnected')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Status (manual)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Status (manual)</SelectItem>
                    <SelectItem value="installed">Installed</SelectItem>
                    <SelectItem value="decommission">Decommissioned</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                    <SelectItem value="disconnected">Disconnected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-44">
                <Select
                  value={imageMode || 'none'}
                  onValueChange={(value) => setImageMode(value === 'none' ? null : value as 'staff' | 'public' | 'server' | 'lab')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Image (manual)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Image (manual)</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="server">Server</SelectItem>
                    <SelectItem value="lab">Lab</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        <div className="w-80">
          <DataQualityPanel 
            data={cleanDataRows}
            tableHeaders={tableHeaders}
            getColumnDisplayName={getColumnDisplayName}
          />
        </div>
      </div>
      
      {/* Live Inventory Data Section */}
      <div className="mt-4 flex flex-col flex-1 min-h-0">
        <InventoryHeader
          itemCount={dataRowCount}
          hasUnsyncedChanges={changeTracker.hasUnsavedChanges}
          syncStatusText={`${syncStatusText}${changeTracker.hasUnsavedChanges ? ` • ${changeTracker.getChangeSummary().message}` : ''}`}
          onRefresh={() => handleRefresh(changeTracker.clearChanges)}
          onPushChanges={handleSelectivePushChanges}
          isRefreshing={refreshDataMutation.isPending}
          isPushing={pushChangesMutation.isPending}
          isLoading={isLoading}
          currentFilter={currentFilter}
          onFilterChange={handleFilterChange}
        />

        <div className="flex-1 min-h-0 overflow-auto">
          <DataTable
            headers={tableHeaders}
            rows={filteredData}
            selectedRows={filteredSelectedRows}
            selectAll={selectAllFiltered}
            onToggleRow={handleToggleRowWithMapping} // Use mapped function
            onToggleAll={handleToggleAllWithMapping} // Use mapped function with index mapping
            onEditStatus={handleEditStatusWithMapping} // Use mapped function
            onModelIdSelect={handleModelIdSelectWithMapping} // Use mapped function
            onLocationSelect={handleLocationSelectWithMapping} // Use mapped function
            onBatchUpdateSelection={handleBatchUpdateSelectionWithMapping} // Use mapped function
            getColumnDisplayName={getColumnDisplayName}
            mappings={mappings} // Pass mappings to DataTable
            user={user}
          />
        </div>
      </div>

      {/* TODO: Will update Adding new device on future push */}
      {/* Add Device Dialog */}
      {/*
      <AddDeviceDialog
        open={showAddDeviceDialog}
        onOpenChange={setShowAddDeviceDialog}
        scannedValue=""
        scannedType="asset"
        onAddDevice={handleAddDevice}
        isLoading={false}
      />
      */}
    </div>
  );
}