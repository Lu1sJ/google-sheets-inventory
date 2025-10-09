import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

type SheetRow = Record<string, string>;

interface ChangedCell {
  rowIndex: number;
  column: string;
  oldValue: string;
  newValue: string;
  timestamp: number;
  actualRowIndex?: number; // Absolute Google Sheets row index for localStorage persistence
}

interface ChangeTracker {
  changedCells: Map<string, ChangedCell>;
  changedRowIndices: Set<number>;
  hasUnsavedChanges: boolean;
}

interface UseChangeTrackerProps {
  sheetId: string;
  originalData: SheetRow[];
  localData: SheetRow[];
  setLocalData: (data: SheetRow[]) => void;
  headerOffset: number;
}

const STORAGE_KEY_PREFIX = 'unsaved_changes_';
const WARNING_SHOWN_KEY = 'change_warning_shown_';

// CRITICAL FIX: Create stable empty Map and Set instances outside component to prevent infinite loops
const createEmptyChangeTracker = (): ChangeTracker => ({
  changedCells: new Map<string, ChangedCell>(),
  changedRowIndices: new Set<number>(),
  hasUnsavedChanges: false
});

export function useChangeTracker({ 
  sheetId, 
  originalData, 
  localData, 
  setLocalData,
  headerOffset
}: UseChangeTrackerProps) {
  const { toast } = useToast();
  const [changeTracker, setChangeTracker] = useState<ChangeTracker>(createEmptyChangeTracker);
  
  const warningShownRef = useRef(false);
  const storageKey = `${STORAGE_KEY_PREFIX}${sheetId}`;
  const warningKey = `${WARNING_SHOWN_KEY}${sheetId}`;

  // Load unsaved changes from localStorage on mount
  useEffect(() => {
    if (!sheetId || originalData.length === 0) {
      return;
    }

    try {
      const savedChanges = localStorage.getItem(storageKey);
      const warningShown = localStorage.getItem(warningKey);
      
      if (savedChanges) {
        const parsedChanges = JSON.parse(savedChanges);
        
        const changedCells = new Map<string, ChangedCell>();
        const changedRowIndices = new Set<number>();
        
        // Reconstruct the change tracker
        parsedChanges.changes.forEach((change: ChangedCell) => {
          const cellKey = `${change.rowIndex}-${change.column}`;
          changedCells.set(cellKey, change);
          changedRowIndices.add(change.rowIndex);
        });

        // Apply saved changes to local data
        const restoredData = [...originalData];
        changedCells.forEach((change) => {
          // CRITICAL: Use stored actualRowIndex if available (prevents corruption from headerOffset changes)
          // Fallback to calculated position for backward compatibility
          const targetRowIndex = change.actualRowIndex ?? (change.rowIndex + headerOffset);
          
          if (restoredData[targetRowIndex]) {
            restoredData[targetRowIndex] = {
              ...restoredData[targetRowIndex],
              [change.column]: change.newValue
            };
          }
        });

        setLocalData(restoredData);
        setChangeTracker({
          changedCells,
          changedRowIndices,
          hasUnsavedChanges: changedCells.size > 0
        });

        // Show warning if we haven't shown it yet for this session
        if (changedCells.size > 0 && !warningShownRef.current) {
          toast({
            title: "Unsaved Changes Restored",
            description: `${changedCells.size} unsaved changes were recovered. Don't forget to sync your data!`,
            duration: 3000,
          });
          warningShownRef.current = true;
        }
      }
    } catch (error) {
      console.error('Failed to load unsaved changes:', error);
      // Clear corrupted data
      localStorage.removeItem(storageKey);
    }

    // Mark restoration as complete
    setHasRestoredInitialData(true);
  }, [sheetId, originalData, setLocalData, storageKey, warningKey, toast, headerOffset]);

  // Track if we've completed the initial restoration
  const [hasRestoredInitialData, setHasRestoredInitialData] = useState(false);

  // Save changes to localStorage whenever changeTracker updates
  useEffect(() => {
    // Don't clear localStorage during initial load/restoration phase
    if (!hasRestoredInitialData) {
      return;
    }

    if (!sheetId || changeTracker.changedCells.size === 0) {
      localStorage.removeItem(storageKey);
      return;
    }

    try {
      const changesToSave = {
        sheetId,
        timestamp: Date.now(),
        headerOffset, // Saved for reference, but actualRowIndex is used for restoration
        changes: Array.from(changeTracker.changedCells.values())
      };
      localStorage.setItem(storageKey, JSON.stringify(changesToSave));
    } catch (error) {
      console.error('Failed to save changes to localStorage:', error);
    }
  }, [changeTracker.changedCells, sheetId, storageKey, hasRestoredInitialData, headerOffset]);

  // Track individual cell changes
  const trackCellChange = useCallback((rowIndex: number, column: string, oldValue: string, newValue: string) => {
    // Skip if values are the same
    if (oldValue === newValue) return;

    const cellKey = `${rowIndex}-${column}`;
    const actualRowIndex = rowIndex + headerOffset; // Account for all header/hidden rows
    const originalValue = originalData[actualRowIndex]?.[column] || '';

    setChangeTracker(prev => {
      const newChangedCells = new Map(prev.changedCells);
      const newChangedRowIndices = new Set(prev.changedRowIndices);

      if (newValue === originalValue) {
        // Value reverted to original - remove from tracking
        newChangedCells.delete(cellKey);
        // Check if this row has any other changes
        const hasOtherChanges = Array.from(newChangedCells.keys())
          .some(key => key.startsWith(`${rowIndex}-`));
        if (!hasOtherChanges) {
          newChangedRowIndices.delete(rowIndex);
        }
      } else {
        // if something changed - add to tracking
        // CRITICAL: Store ABSOLUTE row index (actualRowIndex) for localStorage persistence
        // This prevents data corruption when headerOffset changes between page loads
        newChangedCells.set(cellKey, {
          rowIndex,
          column,
          oldValue: originalValue,
          newValue,
          timestamp: Date.now(),
          actualRowIndex // Store absolute position in Google Sheets
        });
        newChangedRowIndices.add(rowIndex);
      }

      return {
        changedCells: newChangedCells,
        changedRowIndices: newChangedRowIndices,
        hasUnsavedChanges: newChangedCells.size > 0
      };
    });
  }, [originalData, headerOffset]);

  // Get only the changed rows for syncing
  const getChangedRowsForSync = useCallback((): SheetRow[] => {
    if (changeTracker.changedRowIndices.size === 0) return [];

    const changedRows: SheetRow[] = [];
    changeTracker.changedRowIndices.forEach(rowIndex => {
      const actualRowIndex = rowIndex + headerOffset; // Account for all header/hidden rows using headerOffset
      if (localData[actualRowIndex]) {
        changedRows.push({
          ...localData[actualRowIndex],
          _rowIndex: actualRowIndex.toString() // Store the absolute row index
        });
      }
    });

    return changedRows;
  }, [changeTracker.changedRowIndices, localData, headerOffset]);

  // Clear all tracked changes (called after successful sync)
  const clearChanges = useCallback(() => {
    setChangeTracker(createEmptyChangeTracker());
    localStorage.removeItem(storageKey);
    localStorage.removeItem(warningKey);
    warningShownRef.current = false;
  }, [storageKey, warningKey]);

  // Get change summary for display
  const getChangeSummary = useCallback(() => {
    const cellCount = changeTracker.changedCells.size;
    const rowCount = changeTracker.changedRowIndices.size;
    
    return {
      cellCount,
      rowCount,
      message: cellCount > 0 
        ? `${cellCount} change${cellCount !== 1 ? 's' : ''} in ${rowCount} row${rowCount !== 1 ? 's' : ''}`
        : 'No unsaved changes'
    };
  }, [changeTracker]);

  // Removed beforeunload warning to allow page reload with data recovery

  return {
    hasUnsavedChanges: changeTracker.hasUnsavedChanges,
    changedRowCount: changeTracker.changedRowIndices.size,
    changedCellCount: changeTracker.changedCells.size,
    trackCellChange,
    getChangedRowsForSync,
    clearChanges,
    getChangeSummary
  };
}