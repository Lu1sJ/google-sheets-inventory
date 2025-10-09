import { useCallback } from 'react';
import { type ModelOption } from '@/data/model-options';
import { findTypeColumn, findManufacturerColumn, findNameColumn, findSerialColumn, findModelIdColumn } from '../utils/columnHelpers';

type SheetRow = Record<string, string>;

interface UseModelSelectionProps {
  localSheetData: SheetRow[];
  setLocalSheetData: (data: SheetRow[]) => void;
  setHasUnsyncedChanges: (hasChanges: boolean) => void;
  tableHeaders: string[];
  getColumnDisplayName: (columnKey: string) => string;
  headerOffset: number;
}

export function useModelSelection({
  localSheetData,
  setLocalSheetData,
  setHasUnsyncedChanges,
  tableHeaders,
  getColumnDisplayName,
  headerOffset
}: UseModelSelectionProps) {
  const createNameWithSerial = useCallback((modelId: string, serialNumber: string) => {
    return [modelId, serialNumber].filter(Boolean).join(' - ');
  }, []);

  const updateRowField = useCallback((data: SheetRow[], rowIndex: number, header: string | undefined, value: string) => {
    if (!header || !data[rowIndex]) return data;
    
    return data.map((row, index) => 
      index === rowIndex 
        ? { ...row, [header]: value }
        : row
    );
  }, []);

  const handleModelIdSelect = useCallback((rowIndex: number, model: ModelOption) => {
    let updatedData = [...localSheetData];
    const actualRowIndex = rowIndex + headerOffset; // Account for all header/hidden rows
    
    // Find relevant columns
    const modelIdHeader = findModelIdColumn(tableHeaders, getColumnDisplayName);
    const typeHeader = findTypeColumn(tableHeaders, getColumnDisplayName);
    const manufacturerHeader = findManufacturerColumn(tableHeaders, getColumnDisplayName);
    const nameHeader = findNameColumn(tableHeaders, getColumnDisplayName);
    const serialHeader = findSerialColumn(tableHeaders, getColumnDisplayName);
    
    // Update Model ID field first
    updatedData = updateRowField(updatedData, actualRowIndex, modelIdHeader, model.modelId);
    
    // Update Type field
    updatedData = updateRowField(updatedData, actualRowIndex, typeHeader, model.type);
    
    // Update Manufacturer field
    updatedData = updateRowField(updatedData, actualRowIndex, manufacturerHeader, model.manufacturer);
    
    // Update Name field with Model ID + Serial Number
    if (nameHeader && updatedData[actualRowIndex]) {
      const currentSerialNumber = serialHeader ? (updatedData[actualRowIndex][serialHeader] || '') : '';
      const nameValue = createNameWithSerial(model.modelId, currentSerialNumber);
      updatedData = updateRowField(updatedData, actualRowIndex, nameHeader, nameValue);
    }
    
    setLocalSheetData(updatedData);
    setHasUnsyncedChanges(true);
  }, [
    localSheetData,
    setLocalSheetData,
    setHasUnsyncedChanges,
    tableHeaders,
    getColumnDisplayName,
    createNameWithSerial,
    updateRowField,
    headerOffset
  ]);

  return { handleModelIdSelect };
}