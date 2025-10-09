import { GoogleSheetsServiceAccount } from './google-sheets-service-account';

export interface SheetInfo {
  id: string;
  title: string;
  url: string;
}

export interface SheetRow {
  [column: string]: string;
}

export interface SheetMetadata {
  title: string;
  columnCount: number;
  rowCount: number;
  columns: string[];
}

export class GoogleSheetsService {
  private static readonly API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

  /**
   * Check if error is an authentication/permission error that should trigger service account fallback
   */
  private static isAuthError(error: any): boolean {
    if (error?.status === 401 || error?.status === 403) {
      return true;
    }
    if (error?.message?.includes('Access denied') || error?.message?.includes('Permission denied')) {
      return true;
    }
    return false;
  }

  static extractSheetId(input: string): string {
    const trimmed = input.trim();
    
    if (trimmed.includes('/spreadsheets/d/')) {
      const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) throw new Error("Invalid Google Sheets URL");
      return match[1];
    }
    
    if (/^[a-zA-Z0-9-_]+$/.test(trimmed)) {
      return trimmed;
    }
    
    throw new Error("Invalid Google Sheets URL or ID");
  }

  static async getAllSheetsMetadata(sheetId: string, accessToken: string): Promise<Array<SheetMetadata & { sheetName: string }>> {
    try {
      const url = `${this.API_BASE}/${sheetId}?fields=properties.title,sheets.properties`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Sheet not found or you don't have access to it");
        }
        if (response.status === 401 || response.status === 403) {
          // Try service account fallback
          if (GoogleSheetsServiceAccount.isConfigured()) {
            console.log('OAuth failed, trying service account fallback for getAllSheetsMetadata');
            return await GoogleSheetsServiceAccount.getAllSheetsMetadata(sheetId);
          }
          throw new Error("Access denied. Please sign in again to access Google Sheets");
        }
        throw new Error("Failed to access Google Sheet. Please try again");
      }
      
      const data = await response.json();
      
      if (!data.sheets || data.sheets.length === 0) {
        throw new Error("No sheets found in spreadsheet");
      }
      
      // Return metadata for all sheets/tabs
      const sheetsMetadata = [];
      for (const sheet of data.sheets) {
        const sheetProps = sheet.properties;
        const actualDataRange = await this.getActualDataRange(sheetId, accessToken, sheetProps.title);
        
        sheetsMetadata.push({
          title: data.properties?.title || "Untitled",
          sheetName: sheetProps.title,
          columnCount: actualDataRange.columnCount,
          rowCount: actualDataRange.rowCount,
          columns: this.generateColumnLetters(actualDataRange.columnCount),
        });
      }
      
      return sheetsMetadata;
    } catch (error: any) {
      // Fallback to service account if auth error and not already tried
      if (this.isAuthError(error) && GoogleSheetsServiceAccount.isConfigured() && !error.message.includes('service account')) {
        console.log('OAuth error, trying service account fallback for getAllSheetsMetadata');
        return await GoogleSheetsServiceAccount.getAllSheetsMetadata(sheetId);
      }
      throw error;
    }
  }

  static async getSheetMetadata(sheetId: string, accessToken: string, sheetName?: string): Promise<SheetMetadata> {
    try {
      const url = `${this.API_BASE}/${sheetId}?fields=properties.title,sheets.properties`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Sheet not found or you don't have access to it");
        }
        if (response.status === 401 || response.status === 403) {
          // Try service account fallback
          if (GoogleSheetsServiceAccount.isConfigured()) {
            console.log('OAuth failed, trying service account fallback for getSheetMetadata');
            return await GoogleSheetsServiceAccount.getSheetMetadata(sheetId, sheetName);
          }
          throw new Error("Access denied. Please sign in again to access Google Sheets");
        }
        throw new Error("Failed to access Google Sheet. Please try again");
      }
      
      const data = await response.json();
      
      if (!data.sheets || data.sheets.length === 0) {
        throw new Error("No sheets found in spreadsheet");
      }
      
      // Find the specific sheet by name, or use the first one if no name provided
      let targetSheet;
      if (sheetName) {
        targetSheet = data.sheets.find((sheet: any) => sheet.properties?.title === sheetName);
        if (!targetSheet) {
          throw new Error(`Sheet/tab '${sheetName}' not found in spreadsheet`);
        }
      } else {
        targetSheet = data.sheets[0];
      }
      
      const sheet = targetSheet.properties;
      const gridProps = sheet.gridProperties;
      const actualDataRange = await this.getActualDataRange(sheetId, accessToken, sheetName);
      
      // When targeting a specific sheet, prioritize actual data range over grid properties
      const columnCount = sheetName 
        ? actualDataRange.columnCount 
        : Math.max(gridProps?.columnCount || 0, actualDataRange.columnCount);
      const rowCount = sheetName 
        ? actualDataRange.rowCount 
        : Math.max(gridProps?.rowCount || 0, actualDataRange.rowCount);
      const columns = this.generateColumnLetters(columnCount);
      
      return {
        title: data.properties?.title || "Untitled",
        columnCount,
        rowCount,
        columns,
      };
    } catch (error: any) {
      // Fallback to service account if auth error
      if (this.isAuthError(error) && GoogleSheetsServiceAccount.isConfigured()) {
        console.log('OAuth error, trying service account fallback for getSheetMetadata');
        return await GoogleSheetsServiceAccount.getSheetMetadata(sheetId, sheetName);
      }
      throw error;
    }
  }

  private static async getActualDataRange(sheetId: string, accessToken: string, sheetName?: string): Promise<{ columnCount: number; rowCount: number }> {
    // Use safe range building to target the correct sheet
    const range = this.buildSafeRange("A1:ZZ1000", sheetName);
    const url = this.buildApiUrl(sheetId, range, "majorDimension=ROWS");
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      // If a specific sheet name was provided and we get a 400, it likely means the sheet doesn't exist
      if (response.status === 400 && sheetName) {
        throw new Error(`Sheet/tab '${sheetName}' not found or invalid range. Please check the sheet name.`);
      }
      // For other errors or when no sheet name is provided, return defaults
      return { columnCount: 26, rowCount: 1000 };
    }
    
    const data = await response.json();
    const rows = data.values || [];
    
    if (rows.length === 0) {
      return { columnCount: 1, rowCount: 1 };
    }
    
    // Filter out completely empty rows (rows with no data or only whitespace)
    const nonEmptyRows = rows.filter((row: string[]) => 
      row && row.some(cell => cell && cell.toString().trim() !== '')
    );
    
    const maxColumnCount = Math.max(...rows.map((row: string[]) => row.length));
    return {
      columnCount: Math.max(maxColumnCount, 1),
      rowCount: nonEmptyRows.length
    };
  }

  static async getSheetData(sheetId: string, accessToken: string, sheetName?: string): Promise<SheetRow[]> {
    try {
      // Use safe range building with proper quoting and encoding
      const range = this.buildSafeRange("A:Z", sheetName);
      const url = this.buildApiUrl(sheetId, range);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Sheet not found or you don't have access to it");
        }
        if (response.status === 401 || response.status === 403) {
          // Try service account fallback
          if (GoogleSheetsServiceAccount.isConfigured()) {
            console.log('OAuth failed, trying service account fallback for getSheetData');
            return await GoogleSheetsServiceAccount.getSheetData(sheetId, sheetName);
          }
          throw new Error("Access denied. Please sign in again to access Google Sheets");
        }
        if (response.status === 400 && sheetName) {
          throw new Error(`Sheet/tab '${sheetName}' not found or invalid range. Please check the sheet name.`);
        }
        throw new Error("Failed to access Google Sheet data. Please try again");
      }
      
      const data = await response.json();
      const rows = data.values || [];
      
      if (rows.length === 0) {
        return [];
      }
      
      // Filter out empty rows and rows with only placeholder/default values
      const nonEmptyRowsWithIndices = rows
        .map((row: string[], originalIndex: number) => ({ row, originalIndex }))
        .filter(({ row, originalIndex }: { row: string[], originalIndex: number }) => {
          if (!row) return false;
          
          // Check if row has at least one cell with substantial data
          // Ignore common placeholders and empty values
          const placeholderPatterns = [
            /^-+$/,                           // Just dashes: "-", "--", "---"
            /^select\s+(status|move|location)/i,  // Dropdown placeholders
            /^$/,                             // Empty
            /^\s*$/,                          // Whitespace only
          ];
          
          return row.some((cell: any) => {
            if (!cell) return false;
            const cellValue = cell.toString().trim();
            if (cellValue === '') return false;
            
            // Check if this is a placeholder value
            const isPlaceholder = placeholderPatterns.some(pattern => pattern.test(cellValue));
            return !isPlaceholder;
          });
        });
      
      if (nonEmptyRowsWithIndices.length === 0) {
        return [];
      }
      
      // Extract just the rows for column calculation
      const nonEmptyRows = nonEmptyRowsWithIndices.map(({ row }: { row: string[] }) => row);
      
      // Calculate columns from actual data
      const maxColumns = Math.max(...nonEmptyRows.map((row: string[]) => row.length));
      const columns = this.generateColumnLetters(maxColumns);
      
      return this.transformRowsToObjects(nonEmptyRowsWithIndices, columns);
    } catch (error: any) {
      // Fallback to service account if auth error
      if (this.isAuthError(error) && GoogleSheetsServiceAccount.isConfigured()) {
        console.log('OAuth error, trying service account fallback for getSheetData');
        return await GoogleSheetsServiceAccount.getSheetData(sheetId, sheetName);
      }
      throw error;
    }
  }

  static generateColumnLetters(count: number): string[] {
    const letters = [];
    for (let i = 0; i < Math.min(count, 26); i++) {
      letters.push(String.fromCharCode(65 + i));
    }
    return letters;
  }

  private static transformRowsToObjects(rowsData: Array<{ row: string[], originalIndex: number }> | string[][], columns: string[]): SheetRow[] {
    // Handle both formats: array of objects with originalIndex, or simple array of rows
    if (rowsData.length > 0 && typeof rowsData[0] === 'object' && 'row' in rowsData[0]) {
      // New format: preserve original indices
      return (rowsData as Array<{ row: string[], originalIndex: number }>).map(({ row, originalIndex }) => {
        const rowData: SheetRow = {};
        columns.forEach((col, colIndex) => {
          rowData[col] = row[colIndex] || "";
        });
        (rowData as any)._rowIndex = originalIndex;
        return rowData;
      });
    } else {
      // Legacy format: use sequential indices
      return (rowsData as string[][]).map((row, index) => {
        const rowData: SheetRow = {};
        columns.forEach((col, colIndex) => {
          rowData[col] = row[colIndex] || "";
        });
        (rowData as any)._rowIndex = index;
        return rowData;
      });
    }
  }

  static async updateSheetData(sheetId: string, accessToken: string, data: SheetRow[], sheetName?: string): Promise<void> {
    if (data.length === 0) {
      throw new Error("No data to update");
    }

    try {
      // Get the columns from the first row
      const columns = Object.keys(data[0]).filter(key => key !== '_rowIndex').sort();
      
      // Convert objects back to 2D array
      const values = data.map(row => 
        columns.map(col => row[col] || "")
      );

      // Determine range based on data size, use safe range building
      const endColumn = String.fromCharCode(65 + columns.length - 1); // A, B, C, etc.
      const endRow = values.length;
      const baseRange = `A1:${endColumn}${endRow}`;
      const range = this.buildSafeRange(baseRange, sheetName);

      const url = this.buildApiUrl(sheetId, range, "valueInputOption=USER_ENTERED");
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: values
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Google Sheets API error: ${response.status} - ${errorText}`);
        
        if (response.status === 404) {
          throw new Error("Sheet not found or you don't have access to it");
        }
        if (response.status === 401 || response.status === 403) {
          // Try service account fallback
          if (GoogleSheetsServiceAccount.isConfigured()) {
            console.log('OAuth failed, trying service account fallback for updateSheetData');
            return await GoogleSheetsServiceAccount.updateSheetData(sheetId, data, sheetName);
          }
          throw new Error("Access denied. Please sign in again to modify Google Sheets");
        }
        throw new Error(`Failed to update Google Sheet (${response.status}): ${errorText}`);
      }
    } catch (error: any) {
      // Fallback to service account if auth error
      if (this.isAuthError(error) && GoogleSheetsServiceAccount.isConfigured()) {
        console.log('OAuth error, trying service account fallback for updateSheetData');
        return await GoogleSheetsServiceAccount.updateSheetData(sheetId, data, sheetName);
      }
      throw error;
    }
  }

  /**
   * OPTIMIZED: Update specific columns using contiguous range blocks in ONE batch call
   * Groups scattered rows (e.g., 5,6,7,10,12,13,14) into blocks and sends all in single API request
   */
  static async updateColumnBatch(
    sheetId: string,
    accessToken: string,
    column: string,
    updates: Array<{ rowIndex: number; value: string }>,
    sheetName?: string
  ): Promise<void> {
    if (updates.length === 0) return;

    try {
      // Sort updates by row index
      const sortedUpdates = [...updates].sort((a, b) => a.rowIndex - b.rowIndex);
      
      // Group into contiguous blocks for efficient range updates
      const blocks: Array<{ startRow: number; values: string[][] }> = [];
      let currentBlock: { startRow: number; values: string[][] } | null = null;
      
      for (const update of sortedUpdates) {
        if (!currentBlock) {
          // Start new block
          currentBlock = { startRow: update.rowIndex, values: [[update.value]] };
        } else {
          const expectedRow: number = currentBlock.startRow + currentBlock.values.length;
          if (update.rowIndex === expectedRow) {
            // Continue current block
            currentBlock.values.push([update.value]);
          } else {
            // Save current block and start new one
            blocks.push(currentBlock);
            currentBlock = { startRow: update.rowIndex, values: [[update.value]] };
          }
        }
      }
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      
      // Build batch update requests for all blocks (ONE API call)
      const isDev = process.env.NODE_ENV === 'development';
      const requests = blocks.map((block, idx) => {
        const startRow = block.startRow + 1; // 1-based
        const endRow = startRow + block.values.length - 1;
        const range = this.buildSafeRange(`${column}${startRow}:${column}${endRow}`, sheetName);
        
        if (isDev) {
          console.log(`  Block ${idx + 1}: ${range} (${block.values.length} cells from rowIndex ${block.startRow})`);
        }
        
        return {
          range,
          majorDimension: 'ROWS',
          values: block.values
        };
      });
      
      // Send all blocks in ONE batch request (instant update!)
      const url = `${this.API_BASE}/${sheetId}/values:batchUpdate`;
      if (isDev) {
        console.log(`📤 [GoogleSheets] batchUpdate: column=${column}, sheet=${sheetName || 'default'}, blocks=${blocks.length}, cells=${updates.length}`);
      }
      
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: requests
        }),
      });
      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [GoogleSheets] batchUpdate FAILED (${duration}ms):`, {
          sheetId: sheetId.substring(0, 8) + '...',
          column,
          sheetName: sheetName || 'default',
          status: response.status,
          statusText: response.statusText,
          updates: updates.length,
          blocks: blocks.length,
          error: errorText.substring(0, 200)
        });
        
        if (response.status === 401 || response.status === 403) {
          // Try service account fallback
          if (GoogleSheetsServiceAccount.isConfigured()) {
            console.log('OAuth failed, trying service account fallback for updateColumnBatch');
            return await GoogleSheetsServiceAccount.updateColumnBatch(sheetId, column, updates, sheetName);
          }
          throw new Error("Access denied. Please sign in again to modify Google Sheets");
        }
        throw new Error(`Failed to update column batch (${response.status}): ${errorText}`);
      }
      
      console.log(`✅ INSTANT UPDATE: Column ${column}, ${updates.length} cells in ${blocks.length} block(s), ONE API call`);
    } catch (error: any) {
      if (this.isAuthError(error) && GoogleSheetsServiceAccount.isConfigured()) {
        console.log('OAuth error, trying service account fallback for updateColumnBatch');
        return await GoogleSheetsServiceAccount.updateColumnBatch(sheetId, column, updates, sheetName);
      }
      throw error;
    }
  }

  static async updateSelectiveRows(sheetId: string, accessToken: string, rows: any[], sheetName?: string): Promise<void> {
    try {
      // Build batch update requests for each row with its specific position
      const requests = rows.map((row) => {
        const { _rowIndex, ...rowData } = row;
        const rowNumber = Number(_rowIndex) + 1; // Convert 0-based index to 1-based row number
        const baseRange = `A${rowNumber}`; // Start cell only - width inferred from values array
        const range = this.buildSafeRange(baseRange, sheetName);
        
        // Convert row object to array of values in column order
        const values = Object.keys(rowData).sort().map(key => rowData[key] || '');
        
        return {
          range,
          majorDimension: 'ROWS',
          values: [values]
        };
      });

      // Use batchUpdate for efficient selective updates
      const url = `${this.API_BASE}/${sheetId}/values:batchUpdate`;
      
      // Structured logging with environment gating
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        console.log(`📤 [GoogleSheets] updateSelectiveRows: sheet=${sheetName || 'default'}, rows=${rows.length}`);
      }
      
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: requests
        }),
      });
      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        
        if (response.status === 401 || response.status === 403) {
          // Try service account fallback
          if (GoogleSheetsServiceAccount.isConfigured()) {
            if (isDev) {
              console.log(`OAuth failed (${response.status}), trying service account fallback for updateSelectiveRows`);
            }
            return await GoogleSheetsServiceAccount.updateSelectiveRows(sheetId, rows, sheetName);
          }
          throw new Error("Access denied. Please sign in again to modify Google Sheets");
        }
        // For non-auth errors, log and throw
        console.error(`❌ [GoogleSheets] updateSelectiveRows FAILED (${duration}ms):`, {
          sheetId: sheetId.substring(0, 8) + '...',
          sheetName: sheetName || 'default',
          status: response.status,
          statusText: response.statusText,
          rows: rows.length,
          ranges: requests.length,
          error: errorText.substring(0, 200)
        });
        throw new Error(`Failed to update specific rows in Google Sheet (${response.status}): ${errorText}`);
      }
    } catch (error: any) {
      // Fallback to service account if auth error
      if (this.isAuthError(error) && GoogleSheetsServiceAccount.isConfigured()) {
        console.log('OAuth error, trying service account fallback for updateSelectiveRows');
        return await GoogleSheetsServiceAccount.updateSelectiveRows(sheetId, rows, sheetName);
      }
      throw error;
    }
  }

  /**
   * Update a specific cell in a specific row and column
   */
  static async updateSpecificCell(
    sheetId: string, 
    accessToken: string, 
    rowIndex: number, 
    columnLetter: string, 
    value: string, 
    sheetName?: string
  ): Promise<void> {
    try {
      const rowNumber = rowIndex + 1; // Convert 0-based index to 1-based row number
      const cellRange = `${columnLetter}${rowNumber}`;
      const range = this.buildSafeRange(cellRange, sheetName);
      
      const url = `${this.API_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[value]]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Sheets cell update error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          range
        });
        
        if (response.status === 401 || response.status === 403) {
          // Try service account fallback
          if (GoogleSheetsServiceAccount.isConfigured()) {
            console.log('OAuth failed, trying service account fallback for updateSpecificCell');
            return await GoogleSheetsServiceAccount.updateSpecificCell(sheetId, rowIndex, columnLetter, value, sheetName);
          }
          throw new Error("Access denied. Please sign in again to modify Google Sheets");
        }
        throw new Error(`Failed to update cell in Google Sheet (${response.status}): ${errorText}`);
      }
    } catch (error: any) {
      // Fallback to service account if auth error
      if (this.isAuthError(error) && GoogleSheetsServiceAccount.isConfigured()) {
        console.log('OAuth error, trying service account fallback for updateSpecificCell');
        return await GoogleSheetsServiceAccount.updateSpecificCell(sheetId, rowIndex, columnLetter, value, sheetName);
      }
      throw error;
    }
  }

  private static buildSafeRange(baseRange: string, sheetName?: string): string {
    if (!sheetName) {
      return baseRange;
    }
    // Escape single quotes in sheet name by doubling them
    const escapedSheetName = sheetName.replace(/'/g, "''");
    // Quote the sheet name to handle spaces and special characters
    const quotedSheetName = `'${escapedSheetName}'`;
    return `${quotedSheetName}!${baseRange}`;
  }

  private static buildApiUrl(sheetId: string, range: string, additionalParams?: string): string {
    const encodedRange = encodeURIComponent(range);
    const baseUrl = `${this.API_BASE}/${sheetId}/values/${encodedRange}`;
    return additionalParams ? `${baseUrl}?${additionalParams}` : baseUrl;
  }

  static buildSheetUrl(sheetId: string): string {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  }

  /**
   * Highlight rows in Google Sheets based on status value
   * @param sheetId - The spreadsheet ID
   * @param accessToken - User's OAuth access token
   * @param rowIndices - Array of row indices to highlight (0-based, where 0 is the header)
   * @param color - RGB color object { red, green, blue } (values 0-1)
   * @param sheetName - Optional sheet/tab name
   */
  static async highlightRows(
    sheetId: string,
    accessToken: string,
    rowIndices: number[],
    color: { red: number; green: number; blue: number },
    sheetName?: string
  ): Promise<void> {
    try {
      // Get sheet ID (gid) for the specific tab
      const url = `${this.API_BASE}/${sheetId}?fields=sheets.properties`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        // Try service account fallback for the entire highlight operation
        if (response.status === 401 || response.status === 403) {
          if (GoogleSheetsServiceAccount.isConfigured()) {
            console.log('OAuth failed, trying service account fallback for highlightRows');
            return await GoogleSheetsServiceAccount.highlightRows(sheetId, rowIndices, color, sheetName);
          }
        }
        throw new Error(`Failed to get sheet properties: ${response.status}`);
      }

      const data = await response.json();
      const targetSheet = data.sheets.find((s: any) => 
        !sheetName || s.properties.title === sheetName
      );

      if (!targetSheet) {
        throw new Error(`Sheet tab "${sheetName}" not found`);
      }

      const sheetId_gid = targetSheet.properties.sheetId;

      // Build formatting requests for each row
      const requests = rowIndices.map(rowIndex => ({
        repeatCell: {
          range: {
            sheetId: sheetId_gid,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: color,
            },
          },
          fields: 'userEnteredFormat.backgroundColor',
        },
      }));

      // Send batch update request
      const batchUrl = `${this.API_BASE}/${sheetId}:batchUpdate`;
      const batchResponse = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });

      if (!batchResponse.ok) {
        const errorText = await batchResponse.text();
        if (batchResponse.status === 401 || batchResponse.status === 403) {
          // Try service account fallback
          if (GoogleSheetsServiceAccount.isConfigured()) {
            console.log('OAuth failed, trying service account fallback for highlightRows');
            return await GoogleSheetsServiceAccount.highlightRows(sheetId, rowIndices, color, sheetName);
          }
          throw new Error("Access denied. Please sign in again to modify Google Sheets");
        }
        throw new Error(`Failed to highlight rows: ${errorText}`);
      }

      console.log(`✅ Highlighted ${rowIndices.length} rows in sheet "${sheetName || 'default'}"`);
    } catch (error: any) {
      // Fallback to service account if auth error
      if (this.isAuthError(error) && GoogleSheetsServiceAccount.isConfigured()) {
        console.log('OAuth error, trying service account fallback for highlightRows');
        return await GoogleSheetsServiceAccount.highlightRows(sheetId, rowIndices, color, sheetName);
      }
      throw error;
    }
  }
}