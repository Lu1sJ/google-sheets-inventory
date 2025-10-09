// Time constants for sync status calculations
export const TIME_CONSTANTS = {
  ONE_MINUTE: 60_000,
  ONE_HOUR: 3_600_000,
  ONE_DAY: 86_400_000,
} as const;

// Column name patterns for header identification
export const COLUMN_PATTERNS = {
  TYPE: ['type', 'device type'],
  MANUFACTURER: ['manufacturer', 'brand'],
  NAME: ['name'],
  SERIAL: ['serial', 'serial number'],
  TECHNICIAN: ['technician'],
  MODEL_ID: ['model id', 'model'],
} as const;