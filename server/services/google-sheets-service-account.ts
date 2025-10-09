import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

/**
 * Google Sheets Service Account Authentication
 * Used as a fallback when user OAuth fails (e.g., for sheets shared with service account)
 */
export class GoogleSheetsServiceAccount {
  private static jwtClient: JWT | null = null;

  /**
   * Get authenticated JWT client for service account
   */
  private static getJWTClient(): JWT {
    if (this.jwtClient) {
      return this.jwtClient;
    }

    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
    }

    try {
      const credentials = JSON.parse(serviceAccountJson);
      
      console.log('Service account email:', credentials.client_email);
      console.log('Private key exists:', !!credentials.private_key);
      console.log('Private key length:', credentials.private_key?.length);
      
      this.jwtClient = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.readonly',
        ],
      });

      return this.jwtClient;
    } catch (error) {
      console.error('Service account error details:', error);
      throw new Error(`Invalid service account credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sheets API client
   */
  private static getSheetsClient() {
    const auth = this.getJWTClient();
    return google.sheets({ version: 'v4', auth });
  }

  /**
   * Get all sheets metadata for a spreadsheet
   */
  static async getAllSheetsMetadata(sheetId: string): Promise<Array<{ title: string; sheetName: string; columnCount: number; rowCount: number; columns: string[] }>> {
    const sheets = this.getSheetsClient();
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'properties.title,sheets.properties',
    });

    const spreadsheetTitle = response.data.properties?.title || 'Untitled';
    const sheetsList = response.data.sheets || [];

    const sheetsMetadata = [];
    for (const sheet of sheetsList) {
      const sheetProps = sheet.properties;
      const actualDataRange = await this.getActualDataRange(sheetId, sheetProps?.title || '');
      
      sheetsMetadata.push({
        title: spreadsheetTitle,
        sheetName: sheetProps?.title || '',
        columnCount: actualDataRange.columnCount,
        rowCount: actualDataRange.rowCount,
        columns: this.generateColumnLetters(actualDataRange.columnCount),
      });
    }
    
    return sheetsMetadata;
  }

  /**
   * Get metadata for a specific sheet
   */
  static async getSheetMetadata(sheetId: string, sheetName?: string): Promise<{ title: string; columnCount: number; rowCount: number; columns: string[] }> {
    const sheets = this.getSheetsClient();
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'properties.title,sheets.properties',
    });

    const spreadsheetTitle = response.data.properties?.title || 'Untitled';
    const sheetsList = response.data.sheets || [];

    // Find target sheet
    let targetSheet;
    if (sheetName) {
      targetSheet = sheetsList.find(s => s.properties?.title === sheetName);
      if (!targetSheet) {
        throw new Error(`Sheet/tab '${sheetName}' not found in spreadsheet`);
      }
    } else {
      targetSheet = sheetsList[0];
    }

    const actualDataRange = await this.getActualDataRange(sheetId, sheetName);
    
    return {
      title: spreadsheetTitle,
      columnCount: actualDataRange.columnCount,
      rowCount: actualDataRange.rowCount,
      columns: this.generateColumnLetters(actualDataRange.columnCount),
    };
  }

  /**
   * Get actual data range for a sheet
   */
  private static async getActualDataRange(sheetId: string, sheetName?: string): Promise<{ columnCount: number; rowCount: number }> {
    const sheets = this.getSheetsClient();
    const range = this.buildSafeRange('A1:ZZ1000', sheetName);

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
        majorDimension: 'ROWS',
      });

      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        return { columnCount: 1, rowCount: 1 };
      }

      const maxColumnCount = Math.max(...rows.map((row: any[]) => row.length));
      return {
        columnCount: Math.max(maxColumnCount, 1),
        rowCount: rows.length,
      };
    } catch (error) {
      return { columnCount: 26, rowCount: 1000 };
    }
  }

  /**
   * Get sheet data
   */
  static async getSheetData(sheetId: string, sheetName?: string): Promise<Record<string, string>[]> {
    const sheets = this.getSheetsClient();
    const range = this.buildSafeRange('A:Z', sheetName);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return [];
    }

    // Filter out empty rows and rows with only placeholder/default values
    const placeholderPatterns = [
      /^-+$/,                           // Just dashes: "-", "--", "---"
      /^select\s+(status|move|location)/i,  // Dropdown placeholders
      /^$/,                             // Empty
      /^\s*$/,                          // Whitespace only
    ];
    
    const nonEmptyRowsWithIndices = rows
      .map((row: any[], originalIndex: number) => ({ row, originalIndex }))
      .filter(({ row }: { row: any[] }) => {
        if (!row) return false;
        
        // Check if row has at least one cell with substantial data
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

    const nonEmptyRows = nonEmptyRowsWithIndices.map(({ row }: { row: any[] }) => row);
    const maxColumns = Math.max(...nonEmptyRows.map((row: any[]) => row.length));
    const columns = this.generateColumnLetters(maxColumns);
    
    return this.transformRowsToObjects(nonEmptyRowsWithIndices, columns);
  }

  /**
   * Update sheet data
   */
  static async updateSheetData(sheetId: string, data: Record<string, string>[], sheetName?: string): Promise<void> {
    if (data.length === 0) {
      throw new Error('No data to update');
    }

    const sheets = this.getSheetsClient();
    const columns = Object.keys(data[0]).filter(key => key !== '_rowIndex').sort();
    
    const values = data.map(row => 
      columns.map(col => row[col] || '')
    );

    const endColumn = String.fromCharCode(65 + columns.length - 1);
    const endRow = values.length;
    const range = this.buildSafeRange(`A1:${endColumn}${endRow}`, sheetName);

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
  }

  /**
   * Update selective rows
   */
  static async updateSelectiveRows(sheetId: string, rows: any[], sheetName?: string): Promise<void> {
    const sheets = this.getSheetsClient();
    
    const requests = rows.map((row) => {
      const { _rowIndex, ...rowData } = row;
      const rowNumber = Number(_rowIndex) + 1;
      const range = this.buildSafeRange(`A${rowNumber}`, sheetName);
      const values = Object.keys(rowData).sort().map(key => rowData[key] || '');
      
      return {
        range,
        majorDimension: 'ROWS',
        values: [values],
      };
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: requests,
      },
    });
  }

  /**
   * Update specific cell
   */
  static async updateSpecificCell(
    sheetId: string,
    rowIndex: number,
    columnLetter: string,
    value: string,
    sheetName?: string
  ): Promise<void> {
    const sheets = this.getSheetsClient();
    const rowNumber = rowIndex + 1;
    const range = this.buildSafeRange(`${columnLetter}${rowNumber}`, sheetName);

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]],
      },
    });
  }

  /**
   * Batch update a column with multiple values
   */
  static async updateColumnBatch(
    sheetId: string,
    columnLetter: string,
    updates: Array<{ rowIndex: number; value: string }>,
    sheetName?: string
  ): Promise<void> {
    const sheets = this.getSheetsClient();
    
    // Prepare batch update requests
    const requests = updates.map(update => {
      const rowNumber = update.rowIndex + 1;
      const range = this.buildSafeRange(`${columnLetter}${rowNumber}`, sheetName);
      
      return {
        range,
        majorDimension: 'ROWS',
        values: [[update.value]],
      };
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: requests,
      },
    });
  }

  /**
   * Generate column letters
   */
  private static generateColumnLetters(count: number): string[] {
    const letters = [];
    for (let i = 0; i < Math.min(count, 26); i++) {
      letters.push(String.fromCharCode(65 + i));
    }
    return letters;
  }

  /**
   * Transform rows to objects
   */
  private static transformRowsToObjects(rowsData: Array<{ row: any[], originalIndex: number }> | any[][], columns: string[]): Record<string, string>[] {
    // Handle both formats: array of objects with originalIndex, or simple array of rows
    if (rowsData.length > 0 && typeof rowsData[0] === 'object' && 'row' in rowsData[0]) {
      // New format: preserve original indices
      return (rowsData as Array<{ row: any[], originalIndex: number }>).map(({ row, originalIndex }) => {
        const rowData: Record<string, string> = {};
        columns.forEach((col, colIndex) => {
          rowData[col] = row[colIndex] || '';
        });
        (rowData as any)._rowIndex = originalIndex;
        return rowData;
      });
    } else {
      // Legacy format: use sequential indices
      return (rowsData as any[][]).map((row, index) => {
        const rowData: Record<string, string> = {};
        columns.forEach((col, colIndex) => {
          rowData[col] = row[colIndex] || '';
        });
        (rowData as any)._rowIndex = index;
        return rowData;
      });
    }
  }

  /**
   * Build safe range with sheet name
   */
  private static buildSafeRange(baseRange: string, sheetName?: string): string {
    if (!sheetName) {
      return baseRange;
    }
    const escapedSheetName = sheetName.replace(/'/g, "''");
    const quotedSheetName = `'${escapedSheetName}'`;
    return `${quotedSheetName}!${baseRange}`;
  }

  /**
   * Check if service account is configured
   */
  static isConfigured(): boolean {
    return !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }

  /**
   * Highlight rows in Google Sheets using service account
   * @param sheetId - The spreadsheet ID
   * @param rowIndices - Array of row indices to highlight (0-based)
   * @param color - RGB color object { red, green, blue } (values 0-1)
   * @param sheetName - Optional sheet/tab name
   */
  static async highlightRows(
    sheetId: string,
    rowIndices: number[],
    color: { red: number; green: number; blue: number },
    sheetName?: string
  ): Promise<void> {
    const sheets = this.getSheetsClient();

    // Get sheet ID (gid) for the specific tab
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'sheets.properties',
    });

    const targetSheet = spreadsheet.data.sheets?.find(
      (s) => !sheetName || s.properties?.title === sheetName
    );

    if (!targetSheet) {
      throw new Error(`Sheet tab "${sheetName}" not found`);
    }

    const sheetId_gid = targetSheet.properties?.sheetId;

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
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests },
    });

    console.log(`✅ [ServiceAccount] Highlighted ${rowIndices.length} rows in sheet "${sheetName || 'default'}"`);
  }
}
