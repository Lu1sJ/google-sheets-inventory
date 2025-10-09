import { SmartStatus } from "@/components/ui/status-dropdown";
import { SmartEquipmentMove } from "@/components/ui/equipment-move-dropdown";
import { SmartLocation } from "@/components/ui/location-dropdown";
import { SmartAssignedTo } from "@/components/ui/smart-assigned-to";
import { SmartDeviceName } from "@/components/ui/smart-device-name";
import { SmartPhysicalLocation } from "@/components/ui/smart-physical-location";
import { SmartImage } from "@/components/ui/image-dropdown";
import { Badge } from "@/components/ui/badge";
import { MODEL_OPTIONS, type ModelOption } from "@/data/model-options";
import { type LocationOption } from "@/data/location-options";
import { useState, useRef, useCallback, useEffect, MouseEvent } from "react";

// Utility function to capitalize the first letter of each word
const capitalizeText = (text: string): string => {
  if (!text) return text;
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to detect if text is an email address
const isEmailAddress = (text: string): boolean => {
  return text.includes('@') && text.includes('.');
};

// Helper function to copy text to clipboard and show feedback
const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    console.log(`✅ Copied ${label}: ${text}`);
    // Optional: Add toast notification here if you want visual feedback
  } catch (err) {
    console.error(`❌ Failed to copy ${label}:`, err);
    // Fallback: select the text for manual copying
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
};

type SheetRow = Record<string, string>;

interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role?: string;
}

interface DataTableProps {
  headers: string[];
  rows: SheetRow[];
  selectedRows: Set<number>;
  selectAll: boolean;
  onToggleRow: (rowIndex: number, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onEditStatus: (rowIndex: number, header: string, newValue: string) => void;
  onModelIdSelect?: (rowIndex: number, model: ModelOption) => void;
  onLocationSelect?: (rowIndex: number, location: LocationOption) => void;
  onBatchUpdateSelection?: (rowsToSelect: number[], rowsToDeselect: number[]) => void;
  getColumnDisplayName: (columnKey: string) => string;
  mappings?: Array<{fieldKey?: string, fieldName?: string, columnLetter: string}>; // Add mappings prop
  user: User;
}

export function DataTable({
  headers,
  rows,
  selectedRows,
  selectAll,
  onToggleRow,
  onToggleAll,
  onEditStatus,
  onModelIdSelect,
  onLocationSelect,
  onBatchUpdateSelection,
  getColumnDisplayName,
  mappings = [], // Add mappings with default
  user,
}: DataTableProps) {
  // Track last clicked row for Shift+Click range selection
  const lastClickedRowRef = useRef<number | null>(null);
  // Prevent double handling of shift+click events
  const isShiftRangeActionRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartRow, setDragStartRow] = useState<number | null>(null);
  const dragCurrentRow = useRef<number | null>(null);
  const previousDragRange = useRef<{start: number, end: number} | null>(null);

  // Optimized row checkbox handler with Shift+Click support
  const handleRowCheckboxChange = useCallback((rowIndex: number, checked: boolean, shiftKey: boolean = false) => {
    if (shiftKey && lastClickedRowRef.current !== null) {
      // Shift+Click: Apply same action (select/deselect) to range
      const start = Math.min(lastClickedRowRef.current, rowIndex);
      const end = Math.max(lastClickedRowRef.current, rowIndex);
      
      if (onBatchUpdateSelection) {
        if (checked) {
          // Selecting: add range to selection
          const rowsToSelect = [];
          for (let i = start; i <= end; i++) {
            rowsToSelect.push(i);
          }
          onBatchUpdateSelection(rowsToSelect, []);
        } else {
          // Deselecting: remove range from selection
          const rowsToDeselect = [];
          for (let i = start; i <= end; i++) {
            rowsToDeselect.push(i);
          }
          onBatchUpdateSelection([], rowsToDeselect);
        }
      } else {
        // Fallback: individual row toggles
        for (let i = start; i <= end; i++) {
          onToggleRow(i, checked);
        }
      }
    } else {
      // Regular click: toggle single row
      onToggleRow(rowIndex, checked);
    }
    
    // Always update last clicked row and reset guard flag
    lastClickedRowRef.current = rowIndex;
    isShiftRangeActionRef.current = false;
  }, [onToggleRow, onBatchUpdateSelection]);
  
  const handleMouseDown = useCallback((rowIndex: number, e: MouseEvent) => {
    // Only start drag on the row area, not on interactive elements
    const target = e.target as HTMLElement;
    
    // More precise blocking: only block if clicking directly on or very close to interactive elements
    // Check if the target itself or its immediate parent is an interactive element
    const role = target.getAttribute('role');
    const closestButton = target.closest('button');
    const isInteractiveElement = 
      target.tagName === 'INPUT' || 
      target.tagName === 'BUTTON' || 
      target.tagName === 'SELECT' ||
      role === 'combobox' ||
      role === 'button' ||
      !!target.closest('input[type="checkbox"]') || // Allow clicking near checkbox
      (closestButton !== null && closestButton.offsetParent !== null) || // Only block visible buttons
      target.hasAttribute('data-radix-collection-item');
    
    if (isInteractiveElement) {
      return;
    }
    
    e.preventDefault();
    setIsDragging(true);
    setDragStartRow(rowIndex);
    dragCurrentRow.current = rowIndex;
    
    // Select the starting row
    onToggleRow(rowIndex, true);
    
    // Update last clicked row for Shift+Click anchor
    lastClickedRowRef.current = rowIndex;
    
    // Initialize the previous range with just the starting row
    previousDragRange.current = {start: rowIndex, end: rowIndex};
  }, [onToggleRow]);
  
  const handleMouseEnter = useCallback((rowIndex: number) => {
    if (!isDragging || dragStartRow === null) return;
    
    dragCurrentRow.current = rowIndex;
    
    // Calculate new selection range
    const newStart = Math.min(dragStartRow, rowIndex);
    const newEnd = Math.max(dragStartRow, rowIndex);
    
    // Optimize: Send only deltas instead of entire ranges
    const rowsToSelect: number[] = [];
    const rowsToDeselect: number[] = [];
    
    if (previousDragRange.current) {
      const {start: prevStart, end: prevEnd} = previousDragRange.current;
      
      // Find rows to deselect (were in previous range but not in new range)
      for (let i = prevStart; i <= prevEnd; i++) {
        if (i < newStart || i > newEnd) {
          rowsToDeselect.push(i);
        }
      }
      
      // Find rows to select (are in new range but weren't in previous range)
      for (let i = newStart; i <= newEnd; i++) {
        if (i < prevStart || i > prevEnd) {
          rowsToSelect.push(i);
        }
      }
    } else {
      // First drag movement - select entire range
      for (let i = newStart; i <= newEnd; i++) {
        rowsToSelect.push(i);
      }
    }
    
    // Only make batch update if there are changes
    if (rowsToSelect.length > 0 || rowsToDeselect.length > 0) {
      if (onBatchUpdateSelection) {
        onBatchUpdateSelection(rowsToSelect, rowsToDeselect);
      } else {
        // Fallback to individual toggles
        rowsToDeselect.forEach(i => onToggleRow(i, false));
        rowsToSelect.forEach(i => onToggleRow(i, true));
      }
    }
    
    // Update previous range
    previousDragRange.current = {start: newStart, end: newEnd};
  }, [isDragging, dragStartRow, onToggleRow, onBatchUpdateSelection]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStartRow(null);
    dragCurrentRow.current = null;
    previousDragRange.current = null;
  }, []);

  // Add global mouse up handler
  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // Helper function to generate name from model ID and serial number
  const generateName = (row: SheetRow, headers: string[]) => {
    const modelIdHeader = headers.find(h => {
      const displayName = getColumnDisplayName(h).toLowerCase();
      return displayName.includes('model id') || displayName.includes('model');
    });
    const serialHeader = headers.find(h => {
      const displayName = getColumnDisplayName(h).toLowerCase();
      return displayName.includes('serial') || displayName.includes('serial number');
    });
    
    const modelId = modelIdHeader ? row[modelIdHeader] || '' : '';
    const serialNumber = serialHeader ? row[serialHeader] || '' : '';
    
    if (modelId && serialNumber) {
      return `${modelId} - ${serialNumber}`;
    } else if (modelId) {
      return modelId;
    } else if (serialNumber) {
      return serialNumber;
    } else {
      return '';
    }
  };

  // Helper function to check if a column should be visually hidden (CSS-based)
  // Checks for [HIDDEN] prefix in the field name from mappings
  const isHiddenColumn = (header: string): boolean => {
    const mapping = mappings.find(m => m.columnLetter === header);
    return mapping ? mapping.fieldName?.startsWith('[HIDDEN]') ?? false : false;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden w-full h-full flex flex-col">
      <div className="flex-1 overflow-auto" data-testid="table-scroll-container">
        <table className="w-full min-w-max">
          <thead className="sticky top-0 z-10 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
            <tr>
              <th className="w-12 px-3 py-2.5 text-left">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  data-testid="select-all-checkbox"
                />
              </th>
              {headers.map((header) => (
                <th 
                  key={header} 
                  className={`text-left px-3 py-2.5 text-xs font-medium text-gray-700 min-w-[115px] ${isHiddenColumn(header) ? 'hidden' : ''}`}
                  data-testid={`header-${header}`}
                  aria-hidden={isHiddenColumn(header)}
                >
                  {getColumnDisplayName(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 1} className="px-3 py-6 text-center text-gray-500 text-xs">
                  No data available
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => {
                const isSelected = selectedRows.has(rowIndex);
                return (
                  <tr 
                    key={rowIndex} 
                    className={`border-b border-gray-100 transition-colors ${
                      isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                    } ${isDragging ? 'select-none' : ''}`} 
                    data-testid={`row-${rowIndex}`}
                    onMouseDown={(e) => handleMouseDown(rowIndex, e)}
                    onMouseEnter={() => handleMouseEnter(rowIndex)}
                    style={{ cursor: isDragging ? 'default' : 'pointer' }}
                  >
                    <td className="w-12 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          // Skip if we just handled a shift+range action
                          if (isShiftRangeActionRef.current) {
                            isShiftRangeActionRef.current = false;
                            return;
                          }
                          onToggleRow(rowIndex, e.target.checked);
                          // Update last clicked row for Shift+Click anchor
                          lastClickedRowRef.current = rowIndex;
                        }}
                        onMouseDown={(e) => {
                          // Capture Shift key for range selection
                          if (e.shiftKey) {
                            e.preventDefault();
                            isShiftRangeActionRef.current = true;
                            handleRowCheckboxChange(rowIndex, !isSelected, true);
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        data-testid={`row-checkbox-${rowIndex}`}
                      />
                    </td>
                    {headers.map(header => {
                      const cellValue = row[header] || '';
                      const displayName = getColumnDisplayName(header).toLowerCase();
                      
                      // CRITICAL FIX: Check both display name AND field mappings for column type detection
                      const mapping = mappings.find(m => m.columnLetter === header);
                      const fieldName = mapping?.fieldName?.toLowerCase() || '';
                      const fieldKey = mapping?.fieldKey?.toLowerCase() || '';
                      
                      // Helper function to check both display name and field mappings
                      const checkField = (patterns: string[]) => {
                        return patterns.some(pattern => 
                          displayName.includes(pattern) || 
                          fieldName.includes(pattern) || 
                          fieldKey.includes(pattern)
                        );
                      };
                      
                      const isStatusColumn = checkField(['status']) && !checkField(['scanned']);
                      const isEquipmentMoveColumn = checkField(['equipment move', 'equipment_move', 'moved']);
                      const isTechnicianColumn = checkField(['technician']);
                      const isModelIdColumn = checkField(['model id', 'model']);
                      const isNameColumn = checkField(['name']) && !checkField(['column', 'device']);
                      const isDeviceNameColumn = checkField(['device name']);
                      const isLocationColumn = checkField(['location']) && !checkField(['code', 'physical']);
                      const isPhysicalLocationColumn = checkField(['physical location']);
                      const isLocationCodeColumn = checkField(['location code']);
                      const isBoroughColumn = checkField(['borough']);
                      const isAssignedToColumn = checkField(['assigned to', 'assigned', 'department']);
                      const isImageColumn = checkField(['image']); // This will now work with mapped Image fields!
                      
                      // Badge column identification
                      const isSerialColumn = displayName.includes('serial') && !displayName.includes('scanned');
                      const isScannedSnColumn = displayName.includes('scanned') && (
                        displayName.includes('sn') || 
                        displayName.includes('serial number') ||
                        displayName.includes('serial')
                      );
                      const isAssetTagColumn = (displayName.includes('asset') && displayName.includes('tag')) || 
                                              displayName.includes('asset tag') ||
                                              (displayName.includes('asset') && !displayName.includes('scanned'));
                      const isScannedAssetColumn = displayName.includes('scanned') && displayName.includes('asset');
                      
                      return (
                        <td 
                          key={header} 
                          className={`px-3 py-2 text-xs min-w-[115px] ${isHiddenColumn(header) ? 'hidden' : ''}`}
                          data-testid={`cell-${rowIndex}-${header}`}
                          aria-hidden={isHiddenColumn(header)}
                        >
                          {isStatusColumn ? (
                            <div onMouseDown={(e) => e.stopPropagation()}>
                              <SmartStatus
                                value={cellValue}
                                isEditable={true}
                                onChange={(newValue) => onEditStatus(rowIndex, header, newValue)}
                                placeholder="Select status..."
                                className="w-full"
                              />
                            </div>
                          ) : isEquipmentMoveColumn ? (
                            <div className="flex justify-center" onMouseDown={(e) => e.stopPropagation()}>
                              <SmartEquipmentMove
                                value={cellValue}
                                isEditable={true}
                                onChange={(newValue) => onEditStatus(rowIndex, header, newValue)}
                                placeholder="Select move..."
                                className="w-full text-center"
                              />
                            </div>
                          ) : isModelIdColumn ? (
                            <span className="text-gray-800 text-xs">
                              {cellValue || '-'}
                            </span>
                          ) : isNameColumn ? (
                            <span 
                              className="text-gray-800 text-xs" 
                              title={generateName(row, headers) || 'Generated from Model ID + Serial Number'}
                            >
                              {generateName(row, headers) || '-'}
                            </span>
                          ) : isDeviceNameColumn ? (
                            <div onMouseDown={(e) => e.stopPropagation()}>
                              <SmartDeviceName
                                value={cellValue}
                                isEditable={true}
                                onChange={(newValue) => onEditStatus(rowIndex, header, newValue)}
                                className="w-full"
                              />
                            </div>
                          ) : isLocationColumn ? (
                            <div onMouseDown={(e) => e.stopPropagation()}>
                              <SmartLocation
                                value={cellValue}
                                isEditable={true}
                                onChange={(newValue) => onEditStatus(rowIndex, header, newValue)}
                                onLocationSelect={(location) => {
                                  onLocationSelect?.(rowIndex, location);
                                }}
                                placeholder="Select location..."
                                className="w-full"
                              />
                            </div>
                          ) : isPhysicalLocationColumn ? (
                            <div onMouseDown={(e) => e.stopPropagation()}>
                              <SmartPhysicalLocation
                                value={cellValue}
                                isEditable={true}
                                onChange={(newValue) => onEditStatus(rowIndex, header, newValue)}
                                className="w-full"
                              />
                            </div>
                          ) : isLocationCodeColumn ? (
                            <span className="text-gray-800 text-xs" title={cellValue}>
                              {cellValue || '-'}
                            </span>
                          ) : isBoroughColumn ? (
                            <span className="text-gray-800 text-xs" title={cellValue}>
                              {cellValue || '-'}
                            </span>
                          ) : isTechnicianColumn ? (
                            <span className="text-gray-800 text-xs">
                              {cellValue || '-'}
                            </span>
                          ) : isAssignedToColumn ? (
                            <div onMouseDown={(e) => e.stopPropagation()}>
                              <SmartAssignedTo
                                value={cellValue}
                                isEditable={true}
                                onChange={(newValue) => onEditStatus(rowIndex, header, newValue)}
                                className="w-full"
                              />
                            </div>
                          ) : isImageColumn ? (
                            <div onMouseDown={(e) => e.stopPropagation()}>
                              <SmartImage
                                value={cellValue}
                                isEditable={true}
                                onChange={(newValue) => onEditStatus(rowIndex, header, newValue)}
                                placeholder="Select image..."
                                className="w-full"
                              />
                            </div>
                          ) : isSerialColumn || isScannedSnColumn ? (
                            cellValue ? (
                              <Badge 
                                variant="outline" 
                                className="bg-orange-50 text-orange-800 border-orange-300 hover:bg-orange-100 cursor-pointer transition-colors hover:bg-orange-200 text-xs px-2 py-0.5"
                                title={`Click to copy: ${cellValue}`}
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row selection
                                  copyToClipboard(cellValue, 'Serial Number');
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation(); // Prevent row selection on mouse down
                                  e.preventDefault(); // Prevent default mouse behavior
                                }}
                              >
                                {cellValue}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )
                          ) : isAssetTagColumn || isScannedAssetColumn ? (
                            cellValue ? (
                              <Badge 
                                variant="outline" 
                                className="bg-green-50 text-green-800 border-green-300 hover:bg-green-100 cursor-pointer transition-colors hover:bg-green-200 text-xs px-2 py-0.5"
                                title={`Click to copy: ${cellValue}`}
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row selection
                                  copyToClipboard(cellValue, 'Asset Tag');
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation(); // Prevent row selection on mouse down
                                  e.preventDefault(); // Prevent default mouse behavior
                                }}
                              >
                                {cellValue}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )
                          ) : (
                            <span className="text-gray-800 text-xs" title={cellValue}>
                              {cellValue || '-'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}