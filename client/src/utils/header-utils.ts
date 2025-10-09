import { SheetMapping } from "../services/sheets-service";
import { detectHeaderRow, generateSmartName } from "../lib/smart-field-mapping";

export type SheetRow = Record<string, string>;

/**
 * Field name aliases - allows same field to be recognized by multiple names
 * When user renames "Manager sign-off" to "Assistant Manager sign-off", both names work
 */
const FIELD_NAME_ALIASES: Record<string, string[]> = {
  'Manager sign-off': ['Manager sign-off', 'Assistant Manager sign-off'],
  'Assistant Manager sign-off': ['Manager sign-off', 'Assistant Manager sign-off'],
};

/**
 * Normalizes a field name using aliases - returns canonical name
 */
export function normalizeFieldName(fieldName: string): string {
  const normalized = fieldName.trim();
  // Check if this is an alias
  for (const [canonical, aliases] of Object.entries(FIELD_NAME_ALIASES)) {
    if (aliases.some(alias => alias.toLowerCase() === normalized.toLowerCase())) {
      return canonical; // Return the canonical name
    }
  }
  return normalized; // Not an alias, return as-is
}

/**
 * Checks if two field names are equivalent (considering aliases)
 */
export function areFieldNamesEquivalent(name1: string, name2: string): boolean {
  const norm1 = normalizeFieldName(name1);
  const norm2 = normalizeFieldName(name2);
  return norm1.toLowerCase() === norm2.toLowerCase();
}

export interface HeaderConfig {
  tableHeaders: string[];
  getColumnDisplayName: (columnKey: string) => string;
}

// PERFORMANCE FIX: Cached header context to avoid repeated expensive computations
export interface HeaderContext {
  orderedColumns: string[];
  gridData: string[][];
  headerRowIndex: number;
  displayNameCache: Map<string, string>;
}

/**
 * COLUMN-LETTER-BASED HEADER DETECTION
 * Uses the column letters from saved mappings to find the header row.
 * This works regardless of what the headers are named - immune to renames!
 */
export function detectHeaderRowByFieldNames(
  sheetData: SheetRow[], 
  mappings: Array<{fieldName?: string; columnLetter?: string}>
): number {
  if (sheetData.length === 0 || mappings.length === 0) {
    return 0; // Fallback to first row if no data or mappings
  }
  
  // Extract mapped column letters (these tell us which columns have headers)
  const mappedColumns = mappings
    .filter(m => m.columnLetter && m.columnLetter.trim() !== '')
    .map(m => m.columnLetter!.toUpperCase());
  
  if (mappedColumns.length === 0) {
    return 0; // No column mappings, use first row
  }
  
  let bestMatchRowIndex = 0;
  let bestNonEmptyCount = 0;
  
  // Search through rows to find the one with most non-empty values in mapped columns
  sheetData.forEach((row, rowIndex) => {
    // Skip rows beyond first 10 (headers are almost always in first few rows)
    if (rowIndex > 10) return;
    
    // Count how many mapped columns have non-empty text values in this row
    let nonEmptyCount = 0;
    mappedColumns.forEach(colLetter => {
      const cellValue = row[colLetter]?.trim() || '';
      // Check if this cell has actual text content (not just whitespace or numbers)
      if (cellValue && cellValue.length > 0) {
        nonEmptyCount++;
      }
    });
    
    // The header row should have text in MOST of the mapped columns
    if (nonEmptyCount > bestNonEmptyCount) {
      bestNonEmptyCount = nonEmptyCount;
      bestMatchRowIndex = rowIndex;
    }
  });
  
  // Only use detected row if at least 3 mapped columns have content
  // Otherwise fallback to old detection method
  if (bestNonEmptyCount >= 3) {
    return bestMatchRowIndex;
  }
  
  // Fallback to old detection method
  const orderedColumns = Object.keys(sheetData[0])
    .filter(key => key !== '_rowIndex')
    .sort();
  const gridData = sheetData.map(row => {
    return orderedColumns.map(col => row[col] || '');
  });
  return detectHeaderRow(gridData);
}

/**
 * PERFORMANCE FIX: Compute header context once per sheet and cache results
 * This prevents repeated detectHeaderRow calls that freeze the UI
 * Now uses smart field-name-based detection when mappings are available
 */
export function computeHeaderContext(
  sheetData: SheetRow[], 
  mappings?: Array<{fieldName?: string}>,
  sheetName?: string
): HeaderContext {
  const displayNameCache = new Map<string, string>();
  
  if (sheetData.length === 0) {
    return {
      orderedColumns: ['A', 'B', 'C', 'D'],
      gridData: [],
      headerRowIndex: 0,
      displayNameCache
    };
  }
  
  // Get stable column order once
  const orderedColumns = Object.keys(sheetData[0])
    .filter(key => key !== '_rowIndex')
    .sort();
  
  // Convert to grid format once
  const gridData = sheetData.map(row => {
    return orderedColumns.map(col => row[col] || '');
  });
  
  // Use smart field-name-based detection if mappings are available
  let headerRowIndex = mappings && mappings.length > 0
    ? detectHeaderRowByFieldNames(sheetData, mappings)
    : detectHeaderRow(gridData);
  
  // SPECIAL HANDLING: Decommission Sync template - skip first 2 rows
  // Row 1 and 2 are instruction rows, row 3 is the header
  if (sheetName === "Decommission Sync") {
    headerRowIndex = 2; // Row 3 (0-indexed as 2)
  }
  
  return {
    orderedColumns,
    gridData,
    headerRowIndex,
    displayNameCache
  };
}

/**
 * Extracts table headers from sheet data with fallback to minimum columns
 */
export function extractTableHeaders(sheetData: SheetRow[]): string[] {
  if (sheetData.length > 0) {
    const actualHeaders = Object.keys(sheetData[0]).filter(key => key !== '_rowIndex');
    // Ensure we have at least A, B, C, D columns
    const minColumns = ['A', 'B', 'C', 'D'];
    const maxLength = Math.max(actualHeaders.length, minColumns.length);
    return Array.from({ length: maxLength }, (_, i) => 
      actualHeaders[i] || String.fromCharCode(65 + i)
    );
  } else {
    return ['A', 'B', 'C', 'D'];
  }
}

/**
 * PERFORMANCE FIX: Creates a column display name function using cached header context
 * This eliminates repeated expensive detectHeaderRow calls
 */
export function createColumnDisplayNameFunction(
  sheetData: SheetRow[], 
  mappings: SheetMapping[],
  headerContext?: HeaderContext
): (columnKey: string) => string {
  return (columnKey: string): string => {
    // Use cached context if provided
    if (headerContext && headerContext.displayNameCache.has(columnKey)) {
      return headerContext.displayNameCache.get(columnKey)!;
    }
    
    let displayName = '';
    
    // SMART HEADER FIX: Use detected header row instead of always row 0
    if (headerContext && sheetData.length > 0) {
      const { headerRowIndex } = headerContext;
      
      // Use the detected header row for column names
      if (headerRowIndex < sheetData.length && sheetData[headerRowIndex][columnKey]) {
        const headerValue = sheetData[headerRowIndex][columnKey].trim();
        if (headerValue) {
          displayName = headerValue;
        }
      }
    }
    
    // Fallback to mapped field name if available
    if (!displayName) {
      const mapping = mappings.find(m => m.columnLetter === columnKey);
      if (mapping?.fieldName) {
        displayName = mapping.fieldName;
      }
    }
    
    // Final fallback - return a generic name
    if (!displayName) {
      const columnIndex = columnKey.charCodeAt(0) - 65; // Convert A=0, B=1, etc.
      displayName = `Column ${columnIndex + 1}`;
    }
    
    // Cache the result if context is available
    if (headerContext) {
      headerContext.displayNameCache.set(columnKey, displayName);
    }
    
    return displayName;
  };
}

/**
 * SMART FIELD SELECTION: Filter headers to only show selected fields in original sheet order
 * Note: Includes hidden columns (marked with [HIDDEN]) in tableHeaders for auto-fill functionality
 * Hidden columns will be visually hidden via CSS in the DataTable component
 */
export function extractSelectedTableHeaders(sheetData: SheetRow[], mappings: SheetMapping[]): string[] {
  const allHeaders = extractTableHeaders(sheetData);
  
  if (mappings.length === 0) {
    // No mappings yet - show all headers (backward compatibility)
    return allHeaders;
  }
  
  // Create a map of column letter to mapping for efficient lookup
  // IMPORTANT: Include ALL mappings (including hidden ones) so auto-fill can find them
  // Hidden columns will be visually hidden via CSS based on the [HIDDEN] prefix
  const mappingMap = new Map(mappings.map(m => [m.columnLetter, m]));
  
  // Filter to only include columns that have mappings, preserving original sheet order
  // This maintains the exact order from allHeaders (A, B, C, ..., Z, AA, AB, etc.)
  // Hidden mappings are included here and will be hidden via CSS in the DataTable
  return allHeaders.filter(header => mappingMap.has(header));
}

/**
 * PERFORMANCE FIX: Filter out fake header rows using cached header context
 */
export function getDataRowsOnly(sheetData: SheetRow[], headerContext?: HeaderContext): SheetRow[] {
  if (sheetData.length === 0) return [];
  
  let headerRowIndex = 0;
  
  if (headerContext) {
    // Use cached header row index
    headerRowIndex = headerContext.headerRowIndex;
  } else {
    // Fallback to expensive detection (backward compatibility)
    const gridData = sheetData.map(row => {
      const columns = Object.keys(row).filter(key => key !== '_rowIndex').sort();
      return columns.map(col => row[col] || '');
    });
    headerRowIndex = detectHeaderRow(gridData);
  }
  
  return sheetData.slice(headerRowIndex + 1);
}

/**
 * ADD TYPE FIELD: Add hidden Type field for filtering without displaying in table
 * Priority: Type column first (most reliable), then keyword detection as fallback
 */
export function addTypeFieldToData(dataRows: SheetRow[]): SheetRow[] {
  if (dataRows.length === 0) return dataRows;
  
  return dataRows.map(row => {
    let detectedType = '';
    let detectedManufacturer = '';
    
    // Pre-compute rowValues for keyword detection (used for both type and manufacturer)
    const rowValues = Object.values(row).join(' ').toLowerCase();
    
    // PRIORITY 1: Check Type column first (most reliable)
    const typeColumnKey = Object.keys(row).find(key => {
      const keyLower = key.toLowerCase();
      return keyLower === 'type' || 
             keyLower.includes('device type') || 
             keyLower.includes('equipment type') ||
             keyLower.includes('item type');
    });
    
    if (typeColumnKey) {
      detectedType = (row[typeColumnKey] || '').toString().toLowerCase().trim();
    }
    
    // PRIORITY 2: Only use keyword detection if Type column is empty/missing
    // This prevents false matches (e.g., "Laptop Cart" in location making tablet appear as laptop)
    if (!detectedType) {
      if (rowValues.includes('laptop') || rowValues.includes('notebook')) {
        detectedType = 'laptop';
      } else if (rowValues.includes('tablet') || rowValues.includes('ipad')) {
        detectedType = 'tablet';
      } else if (rowValues.includes('desktop') || rowValues.includes('pc') || rowValues.includes('workstation')) {
        detectedType = 'desktop';
      } else if (rowValues.includes('monitor') || rowValues.includes('display') || rowValues.includes('screen')) {
        detectedType = 'monitor';
      } else if (rowValues.includes('printer')) {
        detectedType = 'printer';
      } else if (rowValues.includes('phone') || rowValues.includes('mobile')) {
        detectedType = 'phone';
      } else if (rowValues.includes('server')) {
        detectedType = 'server';
      }
    }
    
    // Detect manufacturer using keyword detection
    if (rowValues.includes('epson')) {
      detectedManufacturer = 'epson';
    } else if (rowValues.includes('hp') || rowValues.includes('hewlett')) {
      detectedManufacturer = 'hp';
    } else if (rowValues.includes('dell')) {
      detectedManufacturer = 'dell';
    } else if (rowValues.includes('lenovo')) {
      detectedManufacturer = 'lenovo';
    } else if (rowValues.includes('apple')) {
      detectedManufacturer = 'apple';
    } else if (rowValues.includes('canon')) {
      detectedManufacturer = 'canon';
    } else if (rowValues.includes('brother')) {
      detectedManufacturer = 'brother';
    } else if (rowValues.includes('asus')) {
      detectedManufacturer = 'asus';
    }
    
    return {
      ...row,
      '_type': detectedType, // Use underscore prefix to indicate internal field
      '_manufacturer': detectedManufacturer // Add manufacturer field
    };
  });
}

/**
 * SMART NAME ENHANCEMENT: Auto-populate Name fields with descriptive information
 */
export function enhanceDataWithSmartNames(
  dataRows: SheetRow[], 
  mappings: SheetMapping[],
  headerContext: HeaderContext
): SheetRow[] {
  if (dataRows.length === 0 || mappings.length === 0) return dataRows;
  
  // Find the Name column mapping
  const nameMapping = mappings.find(m => 
    m.fieldName.toLowerCase().includes('name') || 
    m.fieldName.toLowerCase() === 'name'
  );
  
  if (!nameMapping) return dataRows; // No name field mapped
  
  // Check if Model ID is explicitly mapped by user
  const hasExplicitModelIdMapping = mappings.some(m => 
    m.fieldName.toLowerCase().includes('model') && 
    (m.fieldName.toLowerCase().includes('id') || m.fieldName.toLowerCase() === 'model')
  );
  
  // Create field mappings for smart name generation
  const fieldKeyMappings = mappings.map(m => {
    // Map common display names to canonical field keys
    const displayName = m.fieldName.toLowerCase();
    let fieldKey = '';
    
    if (displayName.includes('model') && displayName.includes('id')) fieldKey = 'modelId';
    else if (displayName.includes('model')) fieldKey = 'modelId';
    else if (displayName.includes('manufacturer') || displayName.includes('brand')) fieldKey = 'manufacturer';
    else if (displayName.includes('product') && displayName.includes('number')) fieldKey = 'productNumber';
    else if (displayName.includes('serial') && displayName.includes('number')) fieldKey = 'serialNumber';
    else if (displayName.includes('asset') && displayName.includes('tag')) fieldKey = 'assetTag';
    else if (displayName.includes('type') || displayName.includes('category')) fieldKey = 'type';
    else if (displayName === 'name') fieldKey = 'name';
    
    return {
      fieldKey,
      columnLetter: m.columnLetter
    };
  }).filter(m => m.fieldKey); // Only include mapped fields

  // SMART LOGIC: If Model ID is NOT explicitly mapped, try to auto-detect it for name generation
  // but keep it hidden from the display columns
  if (!hasExplicitModelIdMapping && dataRows.length > 0) {
    const headerRowIndex = headerContext.headerRowIndex;
    const orderedColumns = headerContext.orderedColumns;
    const mappedColumns = new Set(mappings.map(m => m.columnLetter));
    
    // Look for Model ID column that's not explicitly mapped
    for (const columnLetter of orderedColumns) {
      if (mappedColumns.has(columnLetter)) continue; // Skip already mapped columns
      
      // Check if we have any sample data in this column
      const sampleValues = dataRows.slice(0, 5).map(row => row[columnLetter] || '').filter(Boolean);
      if (sampleValues.length === 0) continue;
      
      // Get the actual header value from the full grid data
      const columnIndex = orderedColumns.indexOf(columnLetter);
      const headerValue = (columnIndex >= 0 && headerRowIndex < headerContext.gridData.length) ? 
        (headerContext.gridData[headerRowIndex][columnIndex] || '') : '';
      if (!headerValue) continue;
      
      const normalizedHeader = headerValue.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
      
      // Check for Model ID headers
      const modelIdHeaders = [
        'model id', 'modelid', 'model', 'model number', 'model no', 'modelnumber',
        'product model', 'device model', 'equipment model'
      ];
      const isModelIdHeader = modelIdHeaders.some(header => 
        normalizedHeader === header || 
        normalizedHeader.includes(header + ' ') || 
        normalizedHeader.includes(' ' + header)
      );
      
      if (isModelIdHeader) {
        // Add this as a hidden Model ID mapping for name generation only
        fieldKeyMappings.push({
          fieldKey: 'modelId',
          columnLetter: columnLetter
        });
        break; // Only need one Model ID column
      }
    }
  }
  
  // Enhance each data row
  return dataRows.map(row => {
    const enhancedRow = { ...row };
    
    // Check if Name field is empty or just contains serial numbers/asset tags
    const currentName = row[nameMapping.columnLetter] || '';
    const shouldEnhance = !currentName || 
                         currentName.match(/^[A-Z0-9]+$/) || // Looks like serial/asset tag
                         currentName.length < 5; // Very short/generic
    
    if (shouldEnhance) {
      // Generate smart name using available data
      const smartName = generateSmartName(row, fieldKeyMappings);
      if (smartName && smartName !== 'Unknown Device') {
        enhancedRow[nameMapping.columnLetter] = smartName;
      }
    }
    
    return enhancedRow;
  });
}

/**
 * PERFORMANCE FIX: Creates a complete header configuration using cached context
 * Now supports smart field filtering based on saved mappings
 */
export function createHeaderConfig(
  sheetData: SheetRow[], 
  mappings: SheetMapping[],
  headerContext?: HeaderContext
): HeaderConfig {
  // Use smart filtering for selected fields, preserving original sheet order
  const tableHeaders = extractSelectedTableHeaders(sheetData, mappings);
  const getColumnDisplayName = createColumnDisplayNameFunction(sheetData, mappings, headerContext);
  
  return {
    tableHeaders,
    getColumnDisplayName
  };
}