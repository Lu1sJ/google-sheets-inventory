import { useCallback } from 'react';
import { autoFillTechnicianField } from '../utils/technicianHelpers';
import { formatLastVerifiedDate, getCurrentYearEST } from '../../../../utils/date-utils';

type SheetRow = Record<string, string>;

interface User {
  role?: string;
  email: string;
}

interface SheetMapping {
  fieldKey?: string;
  fieldName?: string;
  columnLetter: string;
}

interface UseSheetDataEditorProps {
  localSheetData: SheetRow[];
  setLocalSheetData: (data: SheetRow[]) => void;
  setHasUnsyncedChanges: (hasChanges: boolean) => void;
  selectedRows: Set<number>;
  tableHeaders: string[];
  getColumnDisplayName: (columnKey: string) => string;
  user: User;
  mappings?: SheetMapping[];
  trackCellChange?: (rowIndex: number, column: string, oldValue: string, newValue: string) => void;
  headerOffset: number;
}

export function useSheetDataEditor({
  localSheetData,
  setLocalSheetData,
  setHasUnsyncedChanges,
  selectedRows,
  tableHeaders,
  getColumnDisplayName,
  user,
  mappings = [],
  trackCellChange,
  headerOffset
}: UseSheetDataEditorProps) {
  const updateSingleRow = useCallback((data: SheetRow[], rowIndex: number, header: string, newValue: string) => {
    const updatedData = [...data];
    const actualRowIndex = rowIndex + headerOffset; // Account for all header/hidden rows
    const oldValue = updatedData[actualRowIndex]?.[header] || '';
    
    // Track the change if tracking is enabled
    if (trackCellChange && oldValue !== newValue) {
      trackCellChange(rowIndex, header, oldValue, newValue);
    }
    
    // Update the edited field
    updatedData[actualRowIndex] = {
      ...updatedData[actualRowIndex],
      [header]: newValue
    };
    
    // Auto-update "Last Verified Inventory date" when any field is edited
    // First try to find by display name
    let dateColumn = tableHeaders.find(h => {
      const displayName = getColumnDisplayName(h).toLowerCase();
      return (displayName.includes('last verified') && displayName.includes('date')) ||
             displayName.includes('last verified inventory date');
    });
    
    // Fallback: If not found by display name, check mappings for field key or field name
    if (!dateColumn && mappings.length > 0) {
      const dateMapping = mappings.find(m => {
        const fieldKey = m.fieldKey?.toLowerCase() || '';
        const fieldName = m.fieldName?.toLowerCase() || '';
        return fieldKey === 'lastverifieddate' || 
               fieldName.includes('last verified') && fieldName.includes('date');
      });
      
      if (dateMapping) {
        dateColumn = dateMapping.columnLetter;
      }
    }
    
    if (dateColumn && oldValue !== newValue) {
      const formattedDate = formatLastVerifiedDate();
      
      updatedData[actualRowIndex] = {
        ...updatedData[actualRowIndex],
        [dateColumn]: formattedDate
      };
      
      // Track the date change too if tracking is enabled
      if (trackCellChange) {
        const oldDateValue = data[actualRowIndex]?.[dateColumn] || '';
        if (oldDateValue !== formattedDate) {
          trackCellChange(rowIndex, dateColumn, oldDateValue, formattedDate);
        }
      }
    }
    
    // Auto-update "Description" based on Status and Equipment Move
    const isStatusColumn = getColumnDisplayName(header).toLowerCase().includes('status');
    const isEquipmentMoveColumn = getColumnDisplayName(header).toLowerCase().includes('equipment') && 
                                  getColumnDisplayName(header).toLowerCase().includes('move');
    const isDecommissionStatus = newValue.toLowerCase().includes('decommission');
    const isInstalledStatus = newValue.toLowerCase().includes('installed');
    const isEquipmentMoveNo = newValue.toLowerCase() === 'no';
    
    // Find Description column - try mapping first, then display name
    let descriptionColumn = mappings.find(m => {
      const fieldKey = m.fieldKey?.toLowerCase() || '';
      const fieldName = m.fieldName?.toLowerCase() || '';
      return fieldKey === 'description' || fieldName.includes('description');
    })?.columnLetter;
    
    if (!descriptionColumn) {
      descriptionColumn = tableHeaders.find(h => {
        const displayName = getColumnDisplayName(h).toLowerCase();
        return displayName === 'description' || displayName.includes('description');
      });
    }
    
    // Case 1: Status changed to Decommissioned
    if (isStatusColumn && isDecommissionStatus && oldValue !== newValue) {
      // Auto-fill Equipment Move to "Yes"
      // First try to find by mapping (more reliable for hidden fields)
      let equipmentMoveColumn = mappings.find(m => {
        const fieldKey = m.fieldKey?.toLowerCase() || '';
        const fieldName = m.fieldName?.toLowerCase() || '';
        return fieldKey === 'equipmentmove' || 
               (fieldName.includes('equipment') && fieldName.includes('move'));
      })?.columnLetter;
      
      // Fallback: find by display name
      if (!equipmentMoveColumn) {
        equipmentMoveColumn = tableHeaders.find(h => {
          const displayName = getColumnDisplayName(h).toLowerCase();
          return displayName.includes('equipment') && displayName.includes('move');
        });
      }
      
      if (equipmentMoveColumn) {
        const oldEquipmentMoveValue = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
        
        updatedData[actualRowIndex] = {
          ...updatedData[actualRowIndex],
          [equipmentMoveColumn]: 'Yes'
        };
        
        // Track the equipment move change if tracking is enabled
        if (trackCellChange && oldEquipmentMoveValue !== 'Yes') {
          trackCellChange(rowIndex, equipmentMoveColumn, oldEquipmentMoveValue, 'Yes');
        }
      }
      
      // Auto-fill Description
      if (descriptionColumn) {
        const currentYear = getCurrentYearEST();
        const descriptionText = `Decommissioned during Project Nova ${currentYear}.`;
        
        updatedData[actualRowIndex] = {
          ...updatedData[actualRowIndex],
          [descriptionColumn]: descriptionText
        };
        
        // Track the description change too if tracking is enabled
        if (trackCellChange) {
          const oldDescValue = data[actualRowIndex]?.[descriptionColumn] || '';
          if (oldDescValue !== descriptionText) {
            trackCellChange(rowIndex, descriptionColumn, oldDescValue, descriptionText);
          }
        }
      }
    }
    
    // Case 2: Status changed to Missing
    const isMissingStatus = newValue.toLowerCase().includes('missing');
    if (isStatusColumn && isMissingStatus && oldValue !== newValue) {
      // Auto-fill Equipment Move to "Yes"
      // First try to find by mapping (more reliable for hidden fields)
      let equipmentMoveColumn = mappings.find(m => {
        const fieldKey = m.fieldKey?.toLowerCase() || '';
        const fieldName = m.fieldName?.toLowerCase() || '';
        return fieldKey === 'equipmentmove' || 
               (fieldName.includes('equipment') && fieldName.includes('move'));
      })?.columnLetter;
      
      // Fallback: find by display name
      if (!equipmentMoveColumn) {
        equipmentMoveColumn = tableHeaders.find(h => {
          const displayName = getColumnDisplayName(h).toLowerCase();
          return displayName.includes('equipment') && displayName.includes('move');
        });
      }
      
      if (equipmentMoveColumn) {
        const oldEquipmentMoveValue = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
        
        updatedData[actualRowIndex] = {
          ...updatedData[actualRowIndex],
          [equipmentMoveColumn]: 'Yes'
        };
        
        // Track the equipment move change if tracking is enabled
        if (trackCellChange && oldEquipmentMoveValue !== 'Yes') {
          trackCellChange(rowIndex, equipmentMoveColumn, oldEquipmentMoveValue, 'Yes');
        }
      }
      
      // Auto-fill Description
      if (descriptionColumn) {
        const currentYear = getCurrentYearEST();
        const descriptionText = `Equipment not found during Project Nova ${currentYear}.`;
        
        updatedData[actualRowIndex] = {
          ...updatedData[actualRowIndex],
          [descriptionColumn]: descriptionText
        };
        
        // Track the description change too if tracking is enabled
        if (trackCellChange) {
          const oldDescValue = data[actualRowIndex]?.[descriptionColumn] || '';
          if (oldDescValue !== descriptionText) {
            trackCellChange(rowIndex, descriptionColumn, oldDescValue, descriptionText);
          }
        }
      }
    }
    
    // Case 2.25: Status changed to Damaged
    const isDamagedStatus = newValue.toLowerCase().includes('damaged');
    if (isStatusColumn && isDamagedStatus && oldValue !== newValue) {
      // Auto-fill Equipment Move to "Yes"
      // First try to find by mapping (more reliable for hidden fields)
      let equipmentMoveColumn = mappings.find(m => {
        const fieldKey = m.fieldKey?.toLowerCase() || '';
        const fieldName = m.fieldName?.toLowerCase() || '';
        return fieldKey === 'equipmentmove' || 
               (fieldName.includes('equipment') && fieldName.includes('move'));
      })?.columnLetter;
      
      // Fallback: find by display name
      if (!equipmentMoveColumn) {
        equipmentMoveColumn = tableHeaders.find(h => {
          const displayName = getColumnDisplayName(h).toLowerCase();
          return displayName.includes('equipment') && displayName.includes('move');
        });
      }
      
      if (equipmentMoveColumn) {
        const oldEquipmentMoveValue = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
        
        updatedData[actualRowIndex] = {
          ...updatedData[actualRowIndex],
          [equipmentMoveColumn]: 'Yes'
        };
        
        // Track the equipment move change if tracking is enabled
        if (trackCellChange && oldEquipmentMoveValue !== 'Yes') {
          trackCellChange(rowIndex, equipmentMoveColumn, oldEquipmentMoveValue, 'Yes');
        }
      }
    }
    
    // Case 2.3: Status changed to Disconnected
    const isDisconnectedStatus = newValue.toLowerCase().includes('disconnected');
    if (isStatusColumn && isDisconnectedStatus && oldValue !== newValue) {
      // Auto-fill Equipment Move to "Yes"
      // First try to find by mapping (more reliable for hidden fields)
      let equipmentMoveColumn = mappings.find(m => {
        const fieldKey = m.fieldKey?.toLowerCase() || '';
        const fieldName = m.fieldName?.toLowerCase() || '';
        return fieldKey === 'equipmentmove' || 
               (fieldName.includes('equipment') && fieldName.includes('move'));
      })?.columnLetter;
      
      // Fallback: find by display name
      if (!equipmentMoveColumn) {
        equipmentMoveColumn = tableHeaders.find(h => {
          const displayName = getColumnDisplayName(h).toLowerCase();
          return displayName.includes('equipment') && displayName.includes('move');
        });
      }
      
      if (equipmentMoveColumn) {
        const oldEquipmentMoveValue = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
        
        updatedData[actualRowIndex] = {
          ...updatedData[actualRowIndex],
          [equipmentMoveColumn]: 'Yes'
        };
        
        // Track the equipment move change if tracking is enabled
        if (trackCellChange && oldEquipmentMoveValue !== 'Yes') {
          trackCellChange(rowIndex, equipmentMoveColumn, oldEquipmentMoveValue, 'Yes');
        }
      }
    }
    
    // Case 2.5: Status changed to Installed - auto-fill Equipment Move to "No"
    if (isStatusColumn && isInstalledStatus && oldValue !== newValue) {
      // Auto-fill Equipment Move to "No"
      // First try to find by mapping (more reliable for hidden fields)
      let equipmentMoveColumn = mappings.find(m => {
        const fieldKey = m.fieldKey?.toLowerCase() || '';
        const fieldName = m.fieldName?.toLowerCase() || '';
        return fieldKey === 'equipmentmove' || 
               (fieldName.includes('equipment') && fieldName.includes('move'));
      })?.columnLetter;
      
      // Fallback: find by display name
      if (!equipmentMoveColumn) {
        equipmentMoveColumn = tableHeaders.find(h => {
          const displayName = getColumnDisplayName(h).toLowerCase();
          return displayName.includes('equipment') && displayName.includes('move');
        });
      }
      
      if (equipmentMoveColumn) {
        const oldEquipmentMoveValue = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
        
        updatedData[actualRowIndex] = {
          ...updatedData[actualRowIndex],
          [equipmentMoveColumn]: 'No'
        };
        
        // Track the equipment move change if tracking is enabled
        if (trackCellChange && oldEquipmentMoveValue !== 'No') {
          trackCellChange(rowIndex, equipmentMoveColumn, oldEquipmentMoveValue, 'No');
        }
      }
    }
    
    // Case 3: Status = Installed AND Equipment Move = No
    if (descriptionColumn) {
      // Find Status column using mappings
      let statusColumn = mappings.find(m => {
        const fieldKey = m.fieldKey?.toLowerCase() || '';
        const fieldName = m.fieldName?.toLowerCase() || '';
        return fieldKey === 'status' || fieldName.includes('status');
      })?.columnLetter;
      
      if (!statusColumn) {
        statusColumn = tableHeaders.find(h => getColumnDisplayName(h).toLowerCase().includes('status'));
      }
      
      // Find Equipment Move column using mappings
      let equipmentMoveColumn = mappings.find(m => {
        const fieldKey = m.fieldKey?.toLowerCase() || '';
        const fieldName = m.fieldName?.toLowerCase() || '';
        return fieldKey === 'equipmentmove' || 
               (fieldName.includes('equipment') && fieldName.includes('move'));
      })?.columnLetter;
      
      if (!equipmentMoveColumn) {
        equipmentMoveColumn = tableHeaders.find(h => {
          const displayName = getColumnDisplayName(h).toLowerCase();
          return displayName.includes('equipment') && displayName.includes('move');
        });
      }
      
      if (statusColumn && equipmentMoveColumn) {
        const currentStatus = updatedData[actualRowIndex]?.[statusColumn] || '';
        const currentEquipmentMove = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
        
        const hasInstalledStatus = currentStatus.toLowerCase().includes('installed');
        const hasEquipmentMoveNo = currentEquipmentMove.toLowerCase() === 'no';
        
        // Trigger if both conditions are met and one of them just changed
        if (hasInstalledStatus && hasEquipmentMoveNo && oldValue !== newValue) {
          const currentYear = getCurrentYearEST();
          const descriptionText = `Equipment found at branch during Project Nova ${currentYear}. Will remain at branch.`;
          
          updatedData[actualRowIndex] = {
            ...updatedData[actualRowIndex],
            [descriptionColumn]: descriptionText
          };
          
          // Track the description change too if tracking is enabled
          if (trackCellChange) {
            const oldDescValue = data[actualRowIndex]?.[descriptionColumn] || '';
            if (oldDescValue !== descriptionText) {
              trackCellChange(rowIndex, descriptionColumn, oldDescValue, descriptionText);
            }
          }
        }
      }
    }
    
    return autoFillTechnicianField(updatedData, actualRowIndex, user, tableHeaders, getColumnDisplayName, trackCellChange, rowIndex);
  }, [user, tableHeaders, getColumnDisplayName, mappings, trackCellChange, headerOffset]);

  const updateMultipleRows = useCallback((data: SheetRow[], rowIndices: Set<number>, header: string, newValue: string) => {
    let updatedData = [...data];
    
    // Find the date column for auto-updating
    // First try to find by display name
    let dateColumn = tableHeaders.find(h => {
      const displayName = getColumnDisplayName(h).toLowerCase();
      return (displayName.includes('last verified') && displayName.includes('date')) ||
             displayName.includes('last verified inventory date');
    });
    
    // Fallback: If not found by display name, check mappings for field key or field name
    if (!dateColumn && mappings.length > 0) {
      const dateMapping = mappings.find(m => {
        const fieldKey = m.fieldKey?.toLowerCase() || '';
        const fieldName = m.fieldName?.toLowerCase() || '';
        return fieldKey === 'lastverifieddate' || 
               fieldName.includes('last verified') && fieldName.includes('date');
      });
      
      if (dateMapping) {
        dateColumn = dateMapping.columnLetter;
      }
    }
    
    const formattedDate = formatLastVerifiedDate();
    
    rowIndices.forEach(selectedRowIndex => {
      const actualRowIndex = selectedRowIndex + headerOffset; // Account for all header/hidden rows
      const oldValue = updatedData[actualRowIndex]?.[header] || '';
      
      // Track the change if tracking is enabled
      if (trackCellChange && oldValue !== newValue) {
        trackCellChange(selectedRowIndex, header, oldValue, newValue);
      }
      
      // Update the edited field
      updatedData[actualRowIndex] = {
        ...updatedData[actualRowIndex],
        [header]: newValue
      };
      
      // Auto-update "Last Verified Inventory date" when any field is edited
      if (dateColumn && oldValue !== newValue) {
        updatedData[actualRowIndex] = {
          ...updatedData[actualRowIndex],
          [dateColumn]: formattedDate
        };
        
        // Track the date change too if tracking is enabled
        if (trackCellChange) {
          const oldDateValue = data[actualRowIndex]?.[dateColumn] || '';
          if (oldDateValue !== formattedDate) {
            trackCellChange(selectedRowIndex, dateColumn, oldDateValue, formattedDate);
          }
        }
      }
      
      // Auto-update "Description" based on Status and Equipment Move
      const isStatusColumn = getColumnDisplayName(header).toLowerCase().includes('status');
      const isEquipmentMoveColumn = getColumnDisplayName(header).toLowerCase().includes('equipment') && 
                                    getColumnDisplayName(header).toLowerCase().includes('move');
      const isDecommissionStatus = newValue.toLowerCase().includes('decommission');
      const isInstalledStatus = newValue.toLowerCase().includes('installed');
      const isEquipmentMoveNo = newValue.toLowerCase() === 'no';
      
      const descriptionColumn = tableHeaders.find(h => {
        const displayName = getColumnDisplayName(h).toLowerCase();
        return displayName === 'description';
      });
      
      // Case 1: Status changed to Decommissioned
      if (isStatusColumn && isDecommissionStatus && oldValue !== newValue) {
        // Auto-fill Equipment Move to "Yes"
        const equipmentMoveColumn = tableHeaders.find(h => {
          const displayName = getColumnDisplayName(h).toLowerCase();
          return displayName.includes('equipment') && displayName.includes('move');
        });
        
        if (equipmentMoveColumn) {
          const oldEquipmentMoveValue = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
          
          updatedData[actualRowIndex] = {
            ...updatedData[actualRowIndex],
            [equipmentMoveColumn]: 'Yes'
          };
          
          // Track the equipment move change if tracking is enabled
          if (trackCellChange && oldEquipmentMoveValue !== 'Yes') {
            trackCellChange(selectedRowIndex, equipmentMoveColumn, oldEquipmentMoveValue, 'Yes');
          }
        }
        
        // Auto-fill Description
        if (descriptionColumn) {
          const currentYear = getCurrentYearEST();
          const descriptionText = `Equipment was decommissioned during Project Nova ${currentYear}`;
          
          updatedData[actualRowIndex] = {
            ...updatedData[actualRowIndex],
            [descriptionColumn]: descriptionText
          };
          
          // Track the description change too if tracking is enabled
          if (trackCellChange) {
            const oldDescValue = data[actualRowIndex]?.[descriptionColumn] || '';
            if (oldDescValue !== descriptionText) {
              trackCellChange(selectedRowIndex, descriptionColumn, oldDescValue, descriptionText);
            }
          }
        }
      }
      
      // Case 2: Status changed to Missing
      const isMissingStatus = newValue.toLowerCase().includes('missing');
      if (isStatusColumn && isMissingStatus && oldValue !== newValue) {
        // Auto-fill Equipment Move to "Yes"
        // First try to find by mapping (more reliable for hidden fields)
        let equipmentMoveColumn = mappings.find(m => {
          const fieldKey = m.fieldKey?.toLowerCase() || '';
          const fieldName = m.fieldName?.toLowerCase() || '';
          return fieldKey === 'equipmentmove' || 
                 (fieldName.includes('equipment') && fieldName.includes('move'));
        })?.columnLetter;
        
        // Fallback: find by display name
        if (!equipmentMoveColumn) {
          equipmentMoveColumn = tableHeaders.find(h => {
            const displayName = getColumnDisplayName(h).toLowerCase();
            return displayName.includes('equipment') && displayName.includes('move');
          });
        }
        
        if (equipmentMoveColumn) {
          const oldEquipmentMoveValue = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
          
          updatedData[actualRowIndex] = {
            ...updatedData[actualRowIndex],
            [equipmentMoveColumn]: 'Yes'
          };
          
          // Track the equipment move change if tracking is enabled
          if (trackCellChange && oldEquipmentMoveValue !== 'Yes') {
            trackCellChange(selectedRowIndex, equipmentMoveColumn, oldEquipmentMoveValue, 'Yes');
          }
        }
        
        // Auto-fill Description
        if (descriptionColumn) {
          const currentYear = getCurrentYearEST();
          const descriptionText = `Equipment not found during Project Nova ${currentYear}.`;
          
          updatedData[actualRowIndex] = {
            ...updatedData[actualRowIndex],
            [descriptionColumn]: descriptionText
          };
          
          // Track the description change too if tracking is enabled
          if (trackCellChange) {
            const oldDescValue = data[actualRowIndex]?.[descriptionColumn] || '';
            if (oldDescValue !== descriptionText) {
              trackCellChange(selectedRowIndex, descriptionColumn, oldDescValue, descriptionText);
            }
          }
        }
      }
      
      // Case 2.25: Status changed to Damaged
      const isDamagedStatus = newValue.toLowerCase().includes('damaged');
      if (isStatusColumn && isDamagedStatus && oldValue !== newValue) {
        // Auto-fill Equipment Move to "Yes"
        // First try to find by mapping (more reliable for hidden fields)
        let equipmentMoveColumn = mappings.find(m => {
          const fieldKey = m.fieldKey?.toLowerCase() || '';
          const fieldName = m.fieldName?.toLowerCase() || '';
          return fieldKey === 'equipmentmove' || 
                 (fieldName.includes('equipment') && fieldName.includes('move'));
        })?.columnLetter;
        
        // Fallback: find by display name
        if (!equipmentMoveColumn) {
          equipmentMoveColumn = tableHeaders.find(h => {
            const displayName = getColumnDisplayName(h).toLowerCase();
            return displayName.includes('equipment') && displayName.includes('move');
          });
        }
        
        if (equipmentMoveColumn) {
          const oldEquipmentMoveValue = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
          
          updatedData[actualRowIndex] = {
            ...updatedData[actualRowIndex],
            [equipmentMoveColumn]: 'Yes'
          };
          
          // Track the equipment move change if tracking is enabled
          if (trackCellChange && oldEquipmentMoveValue !== 'Yes') {
            trackCellChange(selectedRowIndex, equipmentMoveColumn, oldEquipmentMoveValue, 'Yes');
          }
        }
      }
      
      // Case 2.3: Status changed to Disconnected
      const isDisconnectedStatus = newValue.toLowerCase().includes('disconnected');
      if (isStatusColumn && isDisconnectedStatus && oldValue !== newValue) {
        // Auto-fill Equipment Move to "Yes"
        // First try to find by mapping (more reliable for hidden fields)
        let equipmentMoveColumn = mappings.find(m => {
          const fieldKey = m.fieldKey?.toLowerCase() || '';
          const fieldName = m.fieldName?.toLowerCase() || '';
          return fieldKey === 'equipmentmove' || 
                 (fieldName.includes('equipment') && fieldName.includes('move'));
        })?.columnLetter;
        
        // Fallback: find by display name
        if (!equipmentMoveColumn) {
          equipmentMoveColumn = tableHeaders.find(h => {
            const displayName = getColumnDisplayName(h).toLowerCase();
            return displayName.includes('equipment') && displayName.includes('move');
          });
        }
        
        if (equipmentMoveColumn) {
          const oldEquipmentMoveValue = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
          
          updatedData[actualRowIndex] = {
            ...updatedData[actualRowIndex],
            [equipmentMoveColumn]: 'Yes'
          };
          
          // Track the equipment move change if tracking is enabled
          if (trackCellChange && oldEquipmentMoveValue !== 'Yes') {
            trackCellChange(selectedRowIndex, equipmentMoveColumn, oldEquipmentMoveValue, 'Yes');
          }
        }
      }
      
      // Case 2.5: Status changed to Installed - auto-fill Equipment Move to "No"
      if (isStatusColumn && isInstalledStatus && oldValue !== newValue) {
        // Auto-fill Equipment Move to "No"
        // First try to find by mapping (more reliable for hidden fields)
        let equipmentMoveColumn = mappings.find(m => {
          const fieldKey = m.fieldKey?.toLowerCase() || '';
          const fieldName = m.fieldName?.toLowerCase() || '';
          return fieldKey === 'equipmentmove' || 
                 (fieldName.includes('equipment') && fieldName.includes('move'));
        })?.columnLetter;
        
        // Fallback: find by display name
        if (!equipmentMoveColumn) {
          equipmentMoveColumn = tableHeaders.find(h => {
            const displayName = getColumnDisplayName(h).toLowerCase();
            return displayName.includes('equipment') && displayName.includes('move');
          });
        }
        
        if (equipmentMoveColumn) {
          const oldEquipmentMoveValue = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
          
          updatedData[actualRowIndex] = {
            ...updatedData[actualRowIndex],
            [equipmentMoveColumn]: 'No'
          };
          
          // Track the equipment move change if tracking is enabled
          if (trackCellChange && oldEquipmentMoveValue !== 'No') {
            trackCellChange(selectedRowIndex, equipmentMoveColumn, oldEquipmentMoveValue, 'No');
          }
        }
      }
      
      // Case 3: Status = Installed AND Equipment Move = No
      if (descriptionColumn) {
        const statusColumn = tableHeaders.find(h => getColumnDisplayName(h).toLowerCase().includes('status'));
        const equipmentMoveColumn = tableHeaders.find(h => {
          const displayName = getColumnDisplayName(h).toLowerCase();
          return displayName.includes('equipment') && displayName.includes('move');
        });
        
        if (statusColumn && equipmentMoveColumn) {
          const currentStatus = updatedData[actualRowIndex]?.[statusColumn] || '';
          const currentEquipmentMove = updatedData[actualRowIndex]?.[equipmentMoveColumn] || '';
          
          const hasInstalledStatus = currentStatus.toLowerCase().includes('installed');
          const hasEquipmentMoveNo = currentEquipmentMove.toLowerCase() === 'no';
          
          // Trigger if both conditions are met and one of them just changed
          if (hasInstalledStatus && hasEquipmentMoveNo && oldValue !== newValue) {
            const currentYear = getCurrentYearEST();
            const descriptionText = `Equipment found at branch during Project Nova ${currentYear}. Will remain at branch.`;
            
            updatedData[actualRowIndex] = {
              ...updatedData[actualRowIndex],
              [descriptionColumn]: descriptionText
            };
            
            // Track the description change too if tracking is enabled
            if (trackCellChange) {
              const oldDescValue = data[actualRowIndex]?.[descriptionColumn] || '';
              if (oldDescValue !== descriptionText) {
                trackCellChange(selectedRowIndex, descriptionColumn, oldDescValue, descriptionText);
              }
            }
          }
        }
      }
      
      updatedData = autoFillTechnicianField(updatedData, actualRowIndex, user, tableHeaders, getColumnDisplayName, trackCellChange, selectedRowIndex);
    });
    
    return updatedData;
  }, [user, tableHeaders, getColumnDisplayName, mappings, trackCellChange, headerOffset]);

  const handleEditStatus = useCallback((rowIndex: number, header: string, newValue: string) => {
    const isRowSelected = selectedRows.has(rowIndex);
    const hasMultipleSelectedRows = selectedRows.size > 1;
    
    // Remove debug logging since issue is identified
    
    let updatedData: SheetRow[];
    
    if (isRowSelected && hasMultipleSelectedRows) {
      updatedData = updateMultipleRows(localSheetData, selectedRows, header, newValue);
    } else {
      updatedData = updateSingleRow(localSheetData, rowIndex, header, newValue);
    }
    
    setLocalSheetData(updatedData);
    setHasUnsyncedChanges(true);
  }, [
    localSheetData,
    setLocalSheetData,
    setHasUnsyncedChanges,
    selectedRows,
    updateSingleRow,
    updateMultipleRows
  ]);

  // New function: Update Status with auto-fill AND add scanned column value AND optional Image value
  // This ensures ALL updates happen in a single batch to minimize API requests
  const handleScanWithMode = useCallback((
    rowIndex: number, 
    statusColumn: string, 
    statusValue: string, 
    scannedColumn: string, 
    scannedValue: string,
    imageColumn?: string | null,
    imageValue?: string | null
  ) => {
    // First, update Status through the normal flow (triggers auto-fill)
    const updatedDataWithStatus = updateSingleRow(localSheetData, rowIndex, statusColumn, statusValue);
    
    // Then, add the scanned column value AND Image value (if provided) to the ALREADY auto-filled data
    // This ensures everything happens in ONE update, not multiple API calls
    const actualRowIndex = rowIndex + headerOffset;
    const additionalUpdates: Record<string, string> = {
      [scannedColumn]: scannedValue
    };
    
    // CRITICAL FIX: When using scan mode, ALWAYS auto-fill Equipment Move regardless of whether status changed
    // Find Equipment Move column
    let equipmentMoveColumn = mappings.find(m => {
      const fieldKey = m.fieldKey?.toLowerCase() || '';
      const fieldName = m.fieldName?.toLowerCase() || '';
      return fieldKey === 'equipmentmove' || 
             (fieldName.includes('equipment') && fieldName.includes('move'));
    })?.columnLetter;
    
    if (!equipmentMoveColumn) {
      equipmentMoveColumn = tableHeaders.find(h => {
        const displayName = getColumnDisplayName(h).toLowerCase();
        return displayName.includes('equipment') && displayName.includes('move');
      });
    }
    
    // Set Equipment Move based on status value
    if (equipmentMoveColumn) {
      const isDecommission = statusValue.toLowerCase().includes('decommission');
      const isInstalled = statusValue.toLowerCase().includes('installed');
      const isMissing = statusValue.toLowerCase().includes('missing');
      const isDamaged = statusValue.toLowerCase().includes('damaged');
      const isDisconnected = statusValue.toLowerCase().includes('disconnected');
      
      let equipmentMoveValue = '';
      if (isDecommission || isMissing || isDamaged || isDisconnected) {
        equipmentMoveValue = 'Yes';
      } else if (isInstalled) {
        equipmentMoveValue = 'No';
      }
      
      if (equipmentMoveValue) {
        const oldEquipmentMoveValue = updatedDataWithStatus[actualRowIndex]?.[equipmentMoveColumn] || '';
        additionalUpdates[equipmentMoveColumn] = equipmentMoveValue;
        
        // Track Equipment Move change
        if (trackCellChange && oldEquipmentMoveValue !== equipmentMoveValue) {
          trackCellChange(rowIndex, equipmentMoveColumn, oldEquipmentMoveValue, equipmentMoveValue);
        }
      }
    }
    
    // Add Image field if provided
    if (imageColumn && imageValue) {
      additionalUpdates[imageColumn] = imageValue;
    }
    
    // CRITICAL: Track the scanned value and image value changes for localStorage persistence
    if (trackCellChange) {
      const oldScannedValue = updatedDataWithStatus[actualRowIndex]?.[scannedColumn] || '';
      if (oldScannedValue !== scannedValue) {
        trackCellChange(rowIndex, scannedColumn, oldScannedValue, scannedValue);
      }
      
      if (imageColumn && imageValue) {
        const oldImageValue = updatedDataWithStatus[actualRowIndex]?.[imageColumn] || '';
        if (oldImageValue !== imageValue) {
          trackCellChange(rowIndex, imageColumn, oldImageValue, imageValue);
        }
      }
    }
    
    updatedDataWithStatus[actualRowIndex] = {
      ...updatedDataWithStatus[actualRowIndex],
      ...additionalUpdates
    };
    
    setLocalSheetData(updatedDataWithStatus);
    setHasUnsyncedChanges(true);
  }, [
    localSheetData,
    setLocalSheetData,
    setHasUnsyncedChanges,
    updateSingleRow,
    headerOffset,
    trackCellChange,
    mappings,
    tableHeaders,
    getColumnDisplayName
  ]);

  return { handleEditStatus, handleScanWithMode };
}