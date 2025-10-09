import { COLUMN_PATTERNS } from '../constants';

export function findColumnByPattern(
  headers: string[],
  patterns: readonly string[],
  getDisplayName: (header: string) => string,
  excludePatterns: readonly string[] = []
): string | undefined {
  return headers.find(header => {
    const displayName = getDisplayName(header).toLowerCase();
    const hasPattern = patterns.some(pattern => displayName.includes(pattern));
    const hasExclude = excludePatterns.some(exclude => displayName.includes(exclude));
    return hasPattern && !hasExclude;
  });
}

export function findTypeColumn(headers: string[], getDisplayName: (header: string) => string) {
  return findColumnByPattern(headers, COLUMN_PATTERNS.TYPE, getDisplayName);
}

export function findManufacturerColumn(headers: string[], getDisplayName: (header: string) => string) {
  return findColumnByPattern(headers, COLUMN_PATTERNS.MANUFACTURER, getDisplayName);
}

export function findNameColumn(headers: string[], getDisplayName: (header: string) => string) {
  return findColumnByPattern(headers, COLUMN_PATTERNS.NAME, getDisplayName, ['column']);
}

export function findSerialColumn(headers: string[], getDisplayName: (header: string) => string) {
  return findColumnByPattern(headers, COLUMN_PATTERNS.SERIAL, getDisplayName);
}

export function findTechnicianColumn(headers: string[], getDisplayName: (header: string) => string) {
  return findColumnByPattern(headers, COLUMN_PATTERNS.TECHNICIAN, getDisplayName);
}

export function findModelIdColumn(headers: string[], getDisplayName: (header: string) => string) {
  return findColumnByPattern(headers, COLUMN_PATTERNS.MODEL_ID, getDisplayName);
}