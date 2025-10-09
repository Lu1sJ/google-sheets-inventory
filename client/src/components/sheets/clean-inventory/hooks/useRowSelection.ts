import { useCallback } from 'react';

interface UseRowSelectionProps {
  selectedRows: Set<number>;
  setSelectedRows: (rows: Set<number>) => void;
  setSelectAll: (selectAll: boolean) => void;
  totalRows: number;
}

export function useRowSelection({
  selectedRows,
  setSelectedRows,
  setSelectAll,
  totalRows
}: UseRowSelectionProps) {
  const handleToggleRow = useCallback((rowIndex: number, checked: boolean) => {
    const newSelectedRows = new Set(selectedRows);
    if (checked) {
      newSelectedRows.add(rowIndex);
    } else {
      newSelectedRows.delete(rowIndex);
    }
    setSelectedRows(newSelectedRows);
    setSelectAll(newSelectedRows.size === totalRows);
  }, [selectedRows, setSelectedRows, setSelectAll, totalRows]);

  // Optimized batch selection for drag operations
  const updateSelectionRange = useCallback((start: number, end: number, selected: boolean = true) => {
    const newSelectedRows = new Set(selectedRows);
    const minRow = Math.min(start, end);
    const maxRow = Math.max(start, end);
    
    for (let i = minRow; i <= maxRow; i++) {
      if (selected) {
        newSelectedRows.add(i);
      } else {
        newSelectedRows.delete(i);
      }
    }
    
    setSelectedRows(newSelectedRows);
    setSelectAll(newSelectedRows.size === totalRows);
  }, [selectedRows, setSelectedRows, setSelectAll, totalRows]);

  // Optimized batch deselection for drag operations
  const batchUpdateSelection = useCallback((rowsToSelect: number[], rowsToDeselect: number[]) => {
    const newSelectedRows = new Set(selectedRows);
    
    // Batch deselect
    rowsToDeselect.forEach(rowIndex => {
      newSelectedRows.delete(rowIndex);
    });
    
    // Batch select
    rowsToSelect.forEach(rowIndex => {
      newSelectedRows.add(rowIndex);
    });
    
    setSelectedRows(newSelectedRows);
    setSelectAll(newSelectedRows.size === totalRows);
  }, [selectedRows, setSelectedRows, setSelectAll, totalRows]);

  const handleToggleAll = useCallback((checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      const allRowIndices = new Set(Array.from({ length: totalRows }, (_, index) => index));
      setSelectedRows(allRowIndices);
    } else {
      setSelectedRows(new Set());
    }
  }, [setSelectAll, setSelectedRows, totalRows]);

  const clearSelection = useCallback(() => {
    handleToggleAll(false);
  }, [handleToggleAll]);

  return {
    handleToggleRow,
    handleToggleAll,
    clearSelection,
    updateSelectionRange,
    batchUpdateSelection
  };
}