export const SHEETS_ENDPOINTS = {
  SHEETS: "/api/sheets",
  SHEET_BY_ID: (id: string) => `/api/sheets/${id}`,
  SHEET_MAPPINGS: (id: string) => `/api/sheets/${id}/mappings`,
  SHEET_DATA: (id: string) => `/api/sheets/${id}/data`,
  SHEET_SYNC: (id: string) => `/api/sheets/${id}/sync`,
} as const;

export const SHEETS_ERROR_MESSAGES = {
  INVALID_SHEET_INPUT: "Invalid Google Sheets URL or ID",
  SHEET_NOT_FOUND: "Sheet not found or not accessible",
  SHEET_ALREADY_EXISTS: "Sheet already exists for this user",
  MAPPINGS_REQUIRED: "Column mappings are required",
  INVALID_MAPPING: "Invalid column mapping",
  FETCH_FAILED: "Failed to fetch sheet data",
  SAVE_FAILED: "Failed to save sheet data",
} as const;

export const DEFAULT_FIELDS = [
  "Manager sign-off",
  "Technician",
] as const;

export const CACHE_KEYS = {
  SHEET_DATA: (sheetId: string) => `sheet_data_${sheetId}`,
  SHEET_MAPPINGS: (sheetId: string) => `sheet_mappings_${sheetId}`,
  USER_SHEETS: (userId: string) => `user_sheets_${userId}`,
} as const;

export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes