import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SheetsService, GoogleSheet } from "../../../../services/sheets-service";
import { useToast } from "@/hooks/use-toast";
import { createHeaderConfig, extractTableHeaders, getDataRowsOnly, enhanceDataWithSmartNames, addTypeFieldToData, computeHeaderContext, type SheetRow, type HeaderContext } from "@/utils/header-utils";
import { getSheetsQueryKey, getSheetDataQueryKey, getSheetMappingsQueryKey, getSheetQueryKey } from "../../../../constants/sheets";

interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role?: string;
}

interface UseInventorySheetProps {
  user: User;
  currentSheet: GoogleSheet | null;
  setCurrentSheet: (sheet: GoogleSheet | null) => void;
}

export function useInventorySheet({ user, currentSheet, setCurrentSheet }: UseInventorySheetProps) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [mappingInputs, setMappingInputs] = useState<Record<string, string>>({});
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(true);
  const [localSheetData, setLocalSheetData] = useState<SheetRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // CRITICAL FIX: Move all hooks to top level before any other logic
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lastSheetDataRef = useRef<SheetRow[]>([]);

  const { data: sheets = [] } = useQuery({
    queryKey: getSheetsQueryKey(),
    queryFn: SheetsService.getUserSheets,
  });

  const { data: sheetData = [], isLoading: dataLoading, refetch: refetchData } = useQuery({
    queryKey: currentSheet ? getSheetDataQueryKey(currentSheet.id) : ["sheets", "none", "data"],
    queryFn: () => currentSheet ? SheetsService.getSheetData(currentSheet.id) : [],
    enabled: !!currentSheet,
  });

  const { data: mappings = [] } = useQuery({
    queryKey: currentSheet ? getSheetMappingsQueryKey(currentSheet.id) : ["sheets", "none", "mappings"],
    queryFn: () => currentSheet ? SheetsService.getSheetMappings(currentSheet.id) : [],
    enabled: !!currentSheet,
  });

  // CRITICAL FIX: Stable memoization with consistent dependencies
  // Now uses smart field-name-based detection when mappings are available
  const headerContext = useMemo<HeaderContext>(() => {
    return computeHeaderContext(sheetData, mappings, currentSheet?.sheetName);
  }, [sheetData, mappings, currentSheet?.sheetName]);

  const processedData = useMemo(() => {
    if (sheetData.length === 0) return { dataRowsOnly: [], dataStartIndex: 0 };
    
    const dataRowsOnly = getDataRowsOnly(sheetData, headerContext);
    const dataWithType = addTypeFieldToData(dataRowsOnly);
    const dataStartIndex = sheetData.length - dataRowsOnly.length;
    
    return { dataRowsOnly: dataWithType, dataStartIndex };
  }, [sheetData, headerContext]);

  const headerConfig = useMemo(() => {
    return createHeaderConfig(sheetData, mappings, headerContext);
  }, [sheetData, mappings, headerContext]);

  const convertToGridFormat = useMemo(() => {
    return (): string[][] => {
      if (!sheetData || sheetData.length === 0) return [];
      
      const { dataRowsOnly } = processedData;
      const enhancedDataRows = enhanceDataWithSmartNames(dataRowsOnly, mappings, headerContext);
      const orderedColumns = headerConfig.tableHeaders;
      
      return enhancedDataRows.map(row => {
        return orderedColumns.map(columnLetter => row[columnLetter] || '');
      });
    };
  }, [sheetData, processedData, mappings, headerConfig]);

  // CRITICAL FIX: Stable reference for mappings to prevent infinite loops
  const mappingsTechnician = useMemo(() => {
    return mappings.find(m => {
      const fieldName = m.fieldName?.toLowerCase() || '';
      return fieldName.includes('technician');
    })?.columnLetter || null;
  }, [mappings]);

  // Simplified sync - only update localSheetData when currentSheet changes
  useEffect(() => {
    if (!currentSheet?.id) return;
    
    const storageKey = `unsaved_changes_${currentSheet.id}`;
    const hasUnsavedChanges = localStorage.getItem(storageKey);
    
    // Only sync if no unsaved changes and we have sheet data
    if (!hasUnsavedChanges && sheetData.length > 0) {
      setLocalSheetData([...sheetData]);
      setHasUnsyncedChanges(false);
    }
    
    // Force refetch data when currentSheet changes (especially after auth)
    if (currentSheet?.id && sheetData.length === 0) {
      console.log("Forcing data refetch for currentSheet after auth:", currentSheet.id);
      queryClient.invalidateQueries({ queryKey: getSheetDataQueryKey(currentSheet.id) });
      queryClient.invalidateQueries({ queryKey: getSheetMappingsQueryKey(currentSheet.id) });
    }
  }, [currentSheet?.id, sheetData.length]); // Include sheetData.length to detect empty data scenarios

  // Strengthened auto-selection logic for authentication edge cases
  useEffect(() => {
    if (sheets.length > 0 && !currentSheet) {
      console.log("Auto-selecting first sheet:", sheets[0]);
      setCurrentSheet(sheets[0]);
    }
  }, [sheets, currentSheet, sheets.length]); // Include sheets.length to catch auth cases

  const addSheetMutation = useMutation({
    mutationFn: SheetsService.addSheet,
    onSuccess: async (data) => {
      setCurrentSheet(data.sheet);
      setSheetUrl("");
      setSheetName("Sheet1");
      toast({
        title: "Success",
        description: "Google Sheet connected successfully",
      });
      
      // More aggressive cache invalidation to ensure dashboard refreshes
      await queryClient.invalidateQueries({ queryKey: getSheetsQueryKey() });
      
      // Automatically sync data after adding sheet
      try {
        await SheetsService.refreshSheetData(data.sheet.id);
        // Force refetch of all related queries
        await queryClient.invalidateQueries({ queryKey: getSheetDataQueryKey(data.sheet.id) });
        await queryClient.invalidateQueries({ queryKey: getSheetMappingsQueryKey(data.sheet.id) });
        
        // Additional force refetch to ensure dashboard shows data immediately
        queryClient.refetchQueries({ queryKey: getSheetDataQueryKey(data.sheet.id) });
      } catch (error) {
        console.error("Failed to auto-sync after adding sheet:", error);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSheetMutation = useMutation({
    mutationFn: SheetsService.deleteSheet,
    onSuccess: async (_, deletedSheetId) => {
      toast({
        title: "Sheet disconnected",
        description: "Successfully disconnected from Google Sheet",
      });
      
      // Clean up related queries
      queryClient.removeQueries({ queryKey: getSheetDataQueryKey(deletedSheetId) });
      queryClient.removeQueries({ queryKey: getSheetMappingsQueryKey(deletedSheetId) });
      queryClient.removeQueries({ queryKey: getSheetQueryKey(deletedSheetId) });
      
      // Clear current sheet and refresh sheets list
      setCurrentSheet(null);
      queryClient.invalidateQueries({ queryKey: getSheetsQueryKey() });
      
      // Auto-select first available sheet after refresh (useEffect will handle this)
      // The existing useEffect at line 110-114 will automatically select the first sheet
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const refreshDataMutation = useMutation({
    mutationFn: SheetsService.refreshSheetData,
    onSuccess: async (data) => {
      toast({
        title: "Refreshed",
        description: "Data updated from Google Sheets",
      });
      // Reset local data to server response on successful refresh
      if (data?.data) {
        setLocalSheetData([...data.data]);
        setHasUnsyncedChanges(false);
      }
      // Clear all selections after successful sync
      setSelectedRows(new Set());
      setSelectAll(false);
      
      // CRITICAL FIX: Invalidate cache and refetch to ensure fresh data after server sync completes
      if (currentSheet) {
        await queryClient.invalidateQueries({ queryKey: getSheetDataQueryKey(currentSheet.id) });
        await queryClient.refetchQueries({ queryKey: getSheetDataQueryKey(currentSheet.id) });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Refresh failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pushChangesMutation = useMutation({
    mutationFn: ({ sheetId, data }: { sheetId: string; data: SheetRow[] }) => {
      return SheetsService.pushSheetData(sheetId, data);
    },
    onSuccess: () => {
      toast({
        title: "Changes pushed",
        description: "Data synchronized to Google Sheets",
      });
      setHasUnsyncedChanges(false);
      
      // Clear all selections after successful sync
      setSelectedRows(new Set());
      setSelectAll(false);
      refetchData();
    },
    onError: (error: Error) => {
      toast({
        title: "Push failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveMappingsMutation = useMutation({
    mutationFn: (mappings: Array<{ fieldName: string; columnLetter: string }>) => 
      currentSheet ? SheetsService.saveSheetMappings(currentSheet.id, mappings) : Promise.reject(new Error("No sheet selected")),
    onSuccess: () => {
      toast({
        title: "Mappings saved",
        description: "Column mappings updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: currentSheet ? getSheetMappingsQueryKey(currentSheet.id) : ["sheets", "none", "mappings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Extract properties from headerConfig for easier access
  const { tableHeaders, getColumnDisplayName } = headerConfig;

  const handleAddSheet = () => {
    if (!sheetUrl.trim()) return;
    addSheetMutation.mutate({ 
      url: sheetUrl.trim(), 
      sheetName: sheetName.trim() || "Sheet1" 
    });
  };

  const handleRefresh = (clearChanges?: () => void) => {
    if (!currentSheet) return;
    refreshDataMutation.mutate(currentSheet.id, {
      onSuccess: () => {
        // Clear unsaved changes from localStorage when fresh data is loaded
        if (clearChanges && typeof clearChanges === 'function') {
          clearChanges();
        }
      }
    });
  };

  const handlePushChanges = (changedRowsOnly?: SheetRow[], clearChanges?: () => void) => {
    if (!currentSheet) return;
    
    // Use selective data if provided, otherwise fall back to all data
    const dataToSync = changedRowsOnly || localSheetData;
    pushChangesMutation.mutate({ 
      sheetId: currentSheet.id, 
      data: dataToSync 
    }, {
      onSuccess: () => {
        // Call the custom clearChanges if provided
        if (clearChanges && typeof clearChanges === 'function') {
          clearChanges();
        }
      }
    });
  };

  const handleDeleteSheet = () => {
    if (!currentSheet) return;
    if (confirm(`Disconnect "${currentSheet.title}"? This will remove the sheet connection.`)) {
      deleteSheetMutation.mutate(currentSheet.id);
    }
  };

  const handleSaveMappings = () => {
    const mappingsToSave = tableHeaders
      .map(column => ({
        fieldName: mappingInputs[column] || getColumnDisplayName(column),
        columnLetter: column
      }))
      .filter(mapping => mapping.fieldName && mapping.fieldName !== mapping.columnLetter);
    
    saveMappingsMutation.mutate(mappingsToSave);
  };

  // Handle smart field selection mappings from the new FieldSelectionDialog
  const handleSmartFieldMapping = (mappings: Array<{
    fieldKey: string;
    fieldName: string;
    columnLetter: string;
    order: number;
  }>) => {
    // Convert smart field mappings to the format expected by the backend
    const mappingsToSave = mappings.map(mapping => ({
      fieldName: mapping.fieldName,
      columnLetter: mapping.columnLetter
    }));
    
    saveMappingsMutation.mutate(mappingsToSave);
  };

  const handleMappingInputChange = (column: string, value: string) => {
    setMappingInputs(prev => ({
      ...prev,
      [column]: value
    }));
  };


  // SMART FIELD SELECTION FIX: Full grid format for dialog (shows ALL columns for field selection)
  const convertToFullGridFormat = (): string[][] => {
    if (!sheetData || sheetData.length === 0) return [];
    
    // Use ALL available columns from raw sheet data for smart field selection
    const allColumns = extractTableHeaders(sheetData);
    
    // Convert each row to array format using ALL columns
    return sheetData.map(row => {
      return allColumns.map(columnLetter => row[columnLetter] || '');
    });
  };

  const isLoading = addSheetMutation.isPending || refreshDataMutation.isPending || pushChangesMutation.isPending || dataLoading;

  return {
    // State
    sheetUrl,
    setSheetUrl,
    sheetName,
    setSheetName,
    mappingInputs,
    hasUnsyncedChanges,
    setHasUnsyncedChanges,
    localSheetData,
    setLocalSheetData,
    selectedRows,
    setSelectedRows,
    selectAll,
    setSelectAll,
    
    // Data
    sheets,
    sheetData,
    mappings,
    tableHeaders,
    
    // Loading states
    isLoading,
    dataLoading,
    
    // Actions
    handleAddSheet,
    handleRefresh,
    handlePushChanges,
    handleDeleteSheet,
    handleSaveMappings,
    handleSmartFieldMapping,
    handleMappingInputChange,
    getColumnDisplayName,
    convertToGridFormat,
    convertToFullGridFormat,
    
    // Mutations
    addSheetMutation,
    deleteSheetMutation,
    refreshDataMutation,
    pushChangesMutation,
    saveMappingsMutation,
  };
}