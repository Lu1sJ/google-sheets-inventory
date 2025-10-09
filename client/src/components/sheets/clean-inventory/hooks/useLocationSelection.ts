import { useCallback } from "react";
import { type LocationOption } from "@/data/location-options";

type SheetRow = Record<string, string>;

interface UseLocationSelectionProps {
  localSheetData: SheetRow[];
  setLocalSheetData: (data: SheetRow[]) => void;
  setHasUnsyncedChanges: (hasChanges: boolean) => void;
  tableHeaders: string[];
  getColumnDisplayName: (columnKey: string) => string;
  headerOffset: number;
}

function findLocationColumn(headers: string[], getColumnDisplayName: (columnKey: string) => string): string | undefined {
  return headers.find(header => {
    const displayName = getColumnDisplayName(header).toLowerCase();
    // Match "location" but not "location code"
    return displayName === 'location' || (displayName.includes('location') && !displayName.includes('code'));
  });
}

function findLocationCodeColumn(headers: string[], getColumnDisplayName: (columnKey: string) => string): string | undefined {
  return headers.find(header => {
    const displayName = getColumnDisplayName(header).toLowerCase();
    return displayName.includes('location code');
  });
}

function findBoroughColumn(headers: string[], getColumnDisplayName: (columnKey: string) => string): string | undefined {
  return headers.find(header => {
    const displayName = getColumnDisplayName(header).toLowerCase();
    return displayName.includes('borough');
  });
}

export function useLocationSelection({
  localSheetData,
  setLocalSheetData,
  setHasUnsyncedChanges,
  tableHeaders,
  getColumnDisplayName,
  headerOffset
}: UseLocationSelectionProps) {
  
  const updateRowField = useCallback((data: SheetRow[], rowIndex: number, header: string | undefined, value: string) => {
    if (!header || !data[rowIndex]) return data;
    
    return data.map((row, index) => 
      index === rowIndex 
        ? { ...row, [header]: value }
        : row
    );
  }, []);

  const handleLocationSelect = useCallback((rowIndex: number, location: LocationOption) => {
    let updatedData = [...localSheetData];
    const actualRowIndex = rowIndex + headerOffset; // Account for all header/hidden rows
    
    // Find relevant columns
    const locationHeader = findLocationColumn(tableHeaders, getColumnDisplayName);
    const locationCodeHeader = findLocationCodeColumn(tableHeaders, getColumnDisplayName);
    const boroughHeader = findBoroughColumn(tableHeaders, getColumnDisplayName);
    
    // Update Location field (the location name)
    updatedData = updateRowField(updatedData, actualRowIndex, locationHeader, location.location);
    
    // Update Location Code field
    updatedData = updateRowField(updatedData, actualRowIndex, locationCodeHeader, location.locationCode);
    
    // Update Borough field
    updatedData = updateRowField(updatedData, actualRowIndex, boroughHeader, location.borough);
    
    setLocalSheetData(updatedData);
    setHasUnsyncedChanges(true);
  }, [
    localSheetData,
    setLocalSheetData,
    setHasUnsyncedChanges,
    tableHeaders,
    getColumnDisplayName,
    updateRowField,
    headerOffset
  ]);

  return { handleLocationSelect };
}