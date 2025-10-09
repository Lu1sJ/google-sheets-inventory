import { findTechnicianColumn } from './columnHelpers';

type SheetRow = Record<string, string>;

interface User {
  role?: string;
  email: string;
}

export function shouldAutoFillTechnician(user: User): boolean {
  return user.role !== 'admin';
}

export function autoFillTechnicianField(
  data: SheetRow[],
  rowIndex: number,
  user: User,
  headers: string[],
  getDisplayName: (header: string) => string,
  trackCellChange?: (relativeRowIndex: number, column: string, oldValue: string, newValue: string) => void,
  relativeRowIndex?: number
): SheetRow[] {
  if (!shouldAutoFillTechnician(user)) {
    return data;
  }

  const technicianColumn = findTechnicianColumn(headers, getDisplayName);
  if (!technicianColumn || data[rowIndex][technicianColumn]) {
    return data;
  }

  const updatedData = [...data];
  const oldValue = updatedData[rowIndex]?.[technicianColumn] || '';
  
  updatedData[rowIndex] = {
    ...updatedData[rowIndex],
    [technicianColumn]: user.email
  };

  // Track the technician change if tracking is enabled
  if (trackCellChange && relativeRowIndex !== undefined && oldValue !== user.email) {
    trackCellChange(relativeRowIndex, technicianColumn, oldValue, user.email);
  }

  return updatedData;
}