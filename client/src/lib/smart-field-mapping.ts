
export interface CanonicalField {
  key: string;
  displayName: string;
  aliases: string[];
  category: 'identification' | 'tracking' | 'location' | 'status' | 'technical' | 'admin';
  description: string;
}

export const CANONICAL_FIELDS: CanonicalField[] = [
  // Identification Fields
  {
    key: 'name',
    displayName: 'Name',
    aliases: ['name', 'item name', 'device name', 'equipment name', 'product name'],
    category: 'identification',
    description: 'Name or title of the inventory item'
  },
  {
    key: 'serialNumber',
    displayName: 'Serial Number', 
    aliases: ['serial number', 'serial no', 'sn', 'serial #', 'serial', 'serial_number'],
    category: 'identification',
    description: 'Manufacturer serial number'
  },
  {
    key: 'scannedSn',
    displayName: 'Scanned Sn',
    aliases: ['scanned sn', 'scanned serial', 'scanned serial number', 'scanned_sn', 'scan sn', 'scan serial', 'scan serial number'],
    category: 'tracking',
    description: 'Scanned serial number verification field'
  },
  {
    key: 'assetTag',
    displayName: 'Asset Tag',
    aliases: ['asset tag', 'asset #', 'asset number', 'tag', 'inventory tag', 'asset_tag'],
    category: 'identification', 
    description: 'NYPL asset tag identifier'
  },
  {
    key: 'scannedAsset',
    displayName: 'Scanned Asset',
    aliases: ['scanned asset', 'scanned asset tag', 'scanned tag', 'scanned_asset', 'scan asset', 'scan asset tag', 'scan tag'],
    category: 'tracking',
    description: 'Scanned asset tag verification field'
  },
  {
    key: 'productNumber',
    displayName: 'Product Number',
    aliases: ['product number', 'product #', 'product no', 'part number', 'model number', 'product_number'],
    category: 'technical',
    description: 'Manufacturer product/part number'
  },
  {
    key: 'modelId',
    displayName: 'Model ID',
    aliases: ['model id', 'model', 'model name', 'model_id'],
    category: 'technical',
    description: 'Product model identifier'
  },

  // Technical Specifications
  {
    key: 'type',
    displayName: 'Type',
    aliases: ['type', 'device type', 'equipment type', 'category', 'item type'],
    category: 'technical',
    description: 'Type or category of equipment'
  },
  {
    key: 'manufacturer',
    displayName: 'Manufacturer',
    aliases: ['manufacturer', 'brand', 'make', 'vendor', 'company'],
    category: 'technical',
    description: 'Equipment manufacturer or brand'
  },

  // Location Information
  {
    key: 'location',
    displayName: 'Location',
    aliases: ['location', 'room', 'building', 'site'],
    category: 'location',
    description: 'Primary location of the equipment'
  },
  {
    key: 'locationCode',
    displayName: 'Location Code',
    aliases: ['location code', 'site code', 'building code', 'location_code'],
    category: 'location',
    description: 'Coded location identifier'
  },
  {
    key: 'borough',
    displayName: 'Borough',
    aliases: ['borough', 'district', 'area', 'region'],
    category: 'location',
    description: 'NYC borough location'
  },
  {
    key: 'physicalLocation',
    displayName: 'Physical Location',
    aliases: ['physical location', 'exact location', 'specific location', 'physical_location'],
    category: 'location',
    description: 'Detailed physical location description'
  },

  // Assignment & Ownership
  {
    key: 'assignedTo',
    displayName: 'Assigned To',
    aliases: ['assigned to', 'assigned', 'user', 'owner', 'assigned_to'],
    category: 'admin',
    description: 'Person or department assigned to equipment'
  },
  {
    key: 'department',
    displayName: 'Department',
    aliases: ['department', 'dept', 'division', 'unit'],
    category: 'admin',
    description: 'Department responsible for equipment'
  },

  // Status & Tracking
  {
    key: 'status',
    displayName: 'Status',
    aliases: ['status', 'condition', 'state', 'current status'],
    category: 'status',
    description: 'Current operational status'
  },
  {
    key: 'equipmentMove',
    displayName: 'Equipment Move?',
    aliases: ['equipment move?', 'equipment move', 'move', 'relocated', 'equipment_move'],
    category: 'status',
    description: 'Indicates if equipment has been moved'
  },
  {
    key: 'technician',
    displayName: 'Technician',
    aliases: ['technician', 'tech', 'inspector', 'checked by', 'verified by'],
    category: 'tracking',
    description: 'Technician who performed the inventory check'
  },
  {
    key: 'managerSignoff',
    displayName: 'Manager Sign-off',
    aliases: ['manager sign-off', 'manager signoff', 'assistant manager sign-off', 'assistant manager signoff', 'approved by', 'supervisor', 'manager_signoff'],
    category: 'tracking',
    description: 'Manager approval and sign-off'
  },
  {
    key: 'lastVerifiedDate',
    displayName: 'Last Verified Inventory Date',
    aliases: ['last verified inventory date', 'last verified', 'verification date', 'last_verified_date', 'date verified'],
    category: 'tracking',
    description: 'Date when inventory was last verified'
  },

  // Additional Fields
  {
    key: 'deviceName',
    displayName: 'Device Name',
    aliases: ['device name', 'computer name', 'hostname', 'device_name'],
    category: 'identification',
    description: 'device name or hostname'
  },
  {
    key: 'image',
    displayName: 'Image',
    aliases: ['image', 'photo', 'picture', 'attachment'],
    category: 'tracking',
    description: 'Equipment photo or image'
  }
];

// Data validators to verify real data vs fake headers
export const VALIDATORS: Record<string, RegExp> = {
  assetTag: /^[A]\d{6}$/,                    // NYPL Asset Tag: A + 6 digits (A012345)
  serialNumber: /^[A-Za-z0-9-]{5,}$/,        // Serial numbers: alphanumeric + dashes, 5+ chars
  scannedSn: /^[A-Za-z0-9-]{5,}$/,          // Same as serial number
  scannedAsset: /^[A]\d{6}$/,               // Same as asset tag
  productNumber: /^[A-Za-z0-9-]{3,}$/,      // Product numbers: alphanumeric + dashes, 3+ chars
  modelId: /^[A-Za-z0-9-\s]{2,}$/,          // Model IDs: letters, numbers, dashes, spaces, 2+ chars
  locationCode: /^[A-Z0-9]{2,}$/,           // Location codes: uppercase letters/numbers, 2+ chars
  department: /^[A-Za-z\s]{2,}$/,           // Department names: letters and spaces, 2+ chars
};

// Check if a value matches the expected format for a field
export function validateFieldData(fieldKey: string, value: string): boolean {
  if (!value || value.trim() === '') return false;
  
  const validator = VALIDATORS[fieldKey];
  if (!validator) return true; // No validator means we accept any non-empty value
  
  return validator.test(value.trim());
}

// STRONG validators for enforcing strict data validation (Asset Tags, Serial Numbers etc.)
const STRONG_VALIDATORS = new Set(['assetTag', 'scannedAsset', 'serialNumber', 'scannedSn', 'productNumber']);

// Check if a field requires strong validation to be considered real data
export function isStrongValidator(fieldKey: string): boolean {
  return STRONG_VALIDATORS.has(fieldKey);
}

// Validate field data with strong enforcement - only returns true for fields with strict patterns
export function validateStrongFieldData(fieldKey: string, value: string): boolean {
  if (!value || value.trim() === '') return false;
  if (!isStrongValidator(fieldKey)) return false;
  
  const validator = VALIDATORS[fieldKey];
  if (!validator) return false;
  
  return validator.test(value.trim());
}

// Normalization utilities for fuzzy matching
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
}

// Calculate similarity score between two strings
export function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeText(str1);
  const normalized2 = normalizeText(str2);
  
  // Exact match gets highest score
  if (normalized1 === normalized2) return 1.0;
  
  // Calculate Jaro-Winkler similarity for fuzzy matching
  return jaroWinklerSimilarity(normalized1, normalized2);
}

// Simplified Jaro-Winkler implementation for fuzzy string matching
function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1.length === 0 && s2.length === 0) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  const matchWindow = Math.max(s1.length, s2.length) / 2 - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = s2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0.0;
  
  // Find transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  
  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
  
  // Winkler prefix scaling
  let prefix = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  
  return jaro + 0.1 * prefix * (1 - jaro);
}

// Smart field matching engine
export interface FieldMatch {
  field: CanonicalField;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy';
  matchedAlias?: string;
}

export function findBestFieldMatch(headerText: string, minimumConfidence = 0.7): FieldMatch | null {
  let bestMatch: FieldMatch | null = null;
  
  for (const field of CANONICAL_FIELDS) {
    // Check exact match with display name
    if (normalizeText(headerText) === normalizeText(field.displayName)) {
      return {
        field,
        confidence: 1.0,
        matchType: 'exact'
      };
    }
    
    // Check alias matches
    for (const alias of field.aliases) {
      const similarity = calculateSimilarity(headerText, alias);
      
      if (similarity >= minimumConfidence) {
        const matchType = similarity === 1.0 ? 'alias' : 'fuzzy';
        
        if (!bestMatch || similarity > bestMatch.confidence) {
          bestMatch = {
            field,
            confidence: similarity,
            matchType,
            matchedAlias: alias
          };
        }
      }
    }
  }
  
  return bestMatch;
}

// Enhanced header detection that intelligently ignores generic/fake headers
// NOW WITH NEXT-ROW DATA VALIDATION: Only accepts headers followed by real data
export function detectHeaderRow(sheetData: string[][], maxRowsToScan = 5): number {
  let bestRowIndex = 0;
  let bestScore = -1; // Start with negative score to handle penalties
  
  const rowsToCheck = Math.min(maxRowsToScan, sheetData.length);
  
  
  // Patterns for generic/fake headers that should be heavily penalized
  const genericPatterns = [
    /^column\s*\d+$/i,           // "Column 1", "Column 2", etc.
    /^field\s*\d+$/i,           // "Field 1", "Field 2", etc. 
    /^[a-z]+\s*\d+$/i,          // Generic "name number" patterns
    /selects?\s+from\s+drop[-\s]?down/i,  // "SD selects from drop-down"
    /this\s+field\s+prefills?/i,         // "This field prefills"
    /^untitled/i,               // "Untitled", "Untitled 1", etc.
    /^sheet\s*\d*/i,            // "Sheet", "Sheet1", etc.
    /^inventory$/i,             // Just "INVENTORY" by itself
  ];

  for (let rowIndex = 0; rowIndex < rowsToCheck; rowIndex++) {
    const row = sheetData[rowIndex];
    let matchScore = 0;
    let penaltyScore = 0;
    let realFieldMatches = 0;
    let strongFieldMatches = 0; // Count of strong fields (Asset Tag, Serial etc) found in headers
    let strongValidatedMatches = 0; // Count of strong fields with validated next-row data
    
    for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
      const cellValue = row[cellIndex];
      if (!cellValue || typeof cellValue !== 'string') continue;
      
      const cleanValue = cellValue.trim();
      if (!cleanValue) continue;
      
      // Check for generic/fake header patterns and apply penalties
      let isGeneric = false;
      for (const pattern of genericPatterns) {
        if (pattern.test(cleanValue)) {
          penaltyScore += 2.0; // Heavy penalty for generic headers
          isGeneric = true;
          break;
        }
      }
      
      // Only check for field matches if not a generic header
      if (!isGeneric) {
        const match = findBestFieldMatch(cleanValue, 0.4); // Slightly lower threshold
        if (match) {
          matchScore += match.confidence;
          realFieldMatches++;
          
          // Bonus for high-confidence matches (exact or close aliases)
          if (match.confidence >= 0.9) {
            matchScore += 0.5; // Bonus for excellent matches
          }
          
          // CRITICAL NEW FEATURE: Strong validation with adaptive look-ahead
          const fieldKey = match.field.key;
          const isStrong = isStrongValidator(fieldKey);
          
          if (isStrong) {
            strongFieldMatches++;
            let foundStrongData = false;
            
            // Adaptive look-ahead depth: up to 5 rows or remaining data
            const maxLookAhead = Math.min(5, sheetData.length - rowIndex - 1);
            
            for (let lookAhead = 1; lookAhead <= maxLookAhead; lookAhead++) {
              const checkRow = sheetData[rowIndex + lookAhead];
              if (checkRow && checkRow[cellIndex]) {
                const checkValue = checkRow[cellIndex].trim();
                
                // STRONG VALIDATION: Only count Asset Tags (A012345), Serial Numbers etc as real data
                if (validateStrongFieldData(fieldKey, checkValue)) {
                  strongValidatedMatches++;
                  foundStrongData = true;
                  break; // Found valid data, stop looking
                }
              }
            }
            
            // Per-field penalty for strong fields missing validated data  
            if (!foundStrongData) {
              penaltyScore += 1.0; // Penalty per unvalidated strong field
            }
          }
        }
      }
    }
    
    // Calculate final score with bonuses and penalties
    let finalScore = matchScore - penaltyScore;
    
    // Bonus for rows with multiple real field matches (indicates real headers)
    if (realFieldMatches >= 2) {
      finalScore += realFieldMatches * 0.3; // Bonus scaling with matches
    }
    
    // MAJOR BONUS: Headers with STRONG validated data (Asset Tags like A012345)
    if (strongValidatedMatches >= 1) {
      finalScore += strongValidatedMatches * 1.2; // Strong bonus for validated strong fields
    }
    
    // CRITICAL PENALTY: Only penalize when strong fields exist but none are validated
    if (strongFieldMatches > 0 && strongValidatedMatches === 0) {
      finalScore -= 2.0; // Penalty for headers claiming Asset Tag/Serial but no A012345 found
    }
    
    // Normalize by row length but maintain bonuses
    const normalizedScore = row.length > 0 ? finalScore / row.length : finalScore;
    
    
    if (normalizedScore > bestScore) {
      bestScore = normalizedScore;
      bestRowIndex = rowIndex;
    }
  }
  
  return bestRowIndex;
}

// Smart Name Generation - Create descriptive names from available data
export function generateSmartName(rowData: Record<string, string>, mappings: Array<{fieldKey: string, columnLetter: string}>): string {
  // Create a map for easy field lookup
  const fieldMap = new Map<string, string>();
  
  mappings.forEach(mapping => {
    const value = rowData[mapping.columnLetter];
    if (value && value.trim()) {
      fieldMap.set(mapping.fieldKey, value.trim());
    }
  });
  
  // Special handling for "Model ID - Serial Number" format (NYPL requirement)
  const modelId = fieldMap.get('modelId');
  const serialNumber = fieldMap.get('serialNumber');
  
  if (modelId && serialNumber) {
    // Always format as "Model ID - Serial Number" when both are available
    return `${modelId} - ${serialNumber}`;
  }
  
  // Priority order for building descriptive names when we don't have both Model ID and Serial Number
  const components: string[] = [];
  
  // 1. Model ID (highest priority for tech equipment)
  if (modelId) {
    components.push(modelId);
  }
  
  // 2. Manufacturer/Brand
  if (fieldMap.has('manufacturer')) {
    components.push(fieldMap.get('manufacturer')!);
  }
  
  // 3. Product Number (if different from model)
  const productNumber = fieldMap.get('productNumber');
  if (productNumber && productNumber !== modelId) {
    components.push(productNumber);
  }
  
  // 4. Type/Category
  if (fieldMap.has('type')) {
    components.push(fieldMap.get('type')!);
  }
  
  // 5. Serial Number (only if we don't have model ID)
  if (!modelId && serialNumber) {
    components.push(serialNumber);
  }
  
  // 6. Asset Tag (fallback)
  if (components.length === 0 && fieldMap.has('assetTag')) {
    components.push(`Asset ${fieldMap.get('assetTag')!}`);
  }
  
  // Return combined name or fallback
  if (components.length > 0) {
    return components.join(' ');
  }
  
  // Ultimate fallback to any available identifier
  const fallbacks = ['name', 'deviceName', 'equipmentName'];
  for (const fallback of fallbacks) {
    if (fieldMap.has(fallback)) {
      return fieldMap.get(fallback)!;
    }
  }
  
  return 'Unknown Device';
}

// Auto-map selected fields to sheet columns
export interface AutoMappingResult {
  mappings: Array<{
    fieldKey: string;
    columnIndex: number;
    columnLetter: string;
    confidence: number;
    matchType: string;
  }>;
  unmatchedFields: string[];
  ambiguousMatches: Array<{
    fieldKey: string;
    possibleColumns: Array<{
      columnIndex: number;
      columnLetter: string;
      confidence: number;
    }>;
  }>;
}

export function autoMapFieldsToColumns(
  selectedFieldKeys: string[], 
  headerRow: string[], 
  startColumnIndex = 0
): AutoMappingResult {
  const mappings: AutoMappingResult['mappings'] = [];
  const unmatchedFields: string[] = [];
  const ambiguousMatches: AutoMappingResult['ambiguousMatches'] = [];
  const usedColumns = new Set<number>();
  
  for (const fieldKey of selectedFieldKeys) {
    const field = CANONICAL_FIELDS.find(f => f.key === fieldKey);
    if (!field) {
      unmatchedFields.push(fieldKey);
      continue;
    }
    
    const possibleMatches: Array<{
      columnIndex: number;
      columnLetter: string;
      confidence: number;
      matchType: string;
    }> = [];
    
    // Check each column header for matches
    headerRow.forEach((headerText, columnIndex) => {
      if (usedColumns.has(columnIndex) || !headerText) return;
      
      const match = findBestFieldMatch(headerText);
      if (match && match.field.key === fieldKey) {
        possibleMatches.push({
          columnIndex: columnIndex + startColumnIndex,
          columnLetter: String.fromCharCode(65 + columnIndex + startColumnIndex), // A, B, C, etc.
          confidence: match.confidence,
          matchType: match.matchType
        });
      }
    });
    
    if (possibleMatches.length === 0) {
      unmatchedFields.push(fieldKey);
    } else if (possibleMatches.length === 1) {
      const match = possibleMatches[0];
      mappings.push({ ...match, fieldKey });
      usedColumns.add(match.columnIndex - startColumnIndex);
    } else {
      // Multiple matches - let user resolve ambiguity
      ambiguousMatches.push({
        fieldKey,
        possibleColumns: possibleMatches
      });
    }
  }
  
  return {
    mappings,
    unmatchedFields,
    ambiguousMatches
  };
}

// Get fields grouped by category for UI display
export function getFieldsByCategory(): Record<string, CanonicalField[]> {
  const categories: Record<string, CanonicalField[]> = {};
  
  for (const field of CANONICAL_FIELDS) {
    if (!categories[field.category]) {
      categories[field.category] = [];
    }
    categories[field.category].push(field);
  }
  
  return categories;
}

// Search fields by name or alias
export function searchFields(query: string): CanonicalField[] {
  if (!query.trim()) return CANONICAL_FIELDS;
  
  const normalizedQuery = normalizeText(query);
  
  return CANONICAL_FIELDS.filter(field => {
    // Check display name
    if (normalizeText(field.displayName).includes(normalizedQuery)) return true;
    
    // Check aliases
    return field.aliases.some(alias => 
      normalizeText(alias).includes(normalizedQuery)
    );
  });
}