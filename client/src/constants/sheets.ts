export const SHEETS_ENDPOINTS = {
  SHEETS: "/api/sheets",
  SHEET_BY_ID: (id: string) => `/api/sheets/${id}`,
  SHEET_MAPPINGS: (id: string) => `/api/sheets/${id}/mappings`,
  SHEET_DATA: (id: string) => `/api/sheets/${id}/data`,
  SHEET_SYNC: (id: string) => `/api/sheets/${id}/sync`,
  SHEET_PUSH: (id: string) => `/api/sheets/${id}/push`,
} as const;

export const DEFAULT_FIELDS = [
  "Manager sign-off",
  "Technician",
] as const;

export const COLUMN_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
] as const;

// Query key builders for hierarchical cache management
export const getSheetsQueryKey = () => ['sheets'] as const;
export const getSheetQueryKey = (id: string) => ['sheets', id] as const;
export const getSheetMappingsQueryKey = (id: string) => ['sheets', id, 'mappings'] as const;
export const getSheetDataQueryKey = (id: string) => ['sheets', id, 'data'] as const;