import { HttpClient } from "../utils/http-client";
import { SHEETS_ENDPOINTS } from "../constants/sheets";

export interface GoogleSheet {
  id: string;
  userId: string;
  sheetId: string;
  sheetName?: string;
  title: string;
  url: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SheetMapping {
  id: string;
  sheetId: string;
  fieldName: string;
  columnLetter: string;
  order: number;
}

export interface SheetMetadata {
  title: string;
  columnCount: number;
  rowCount: number;
  columns: string[];
}

export interface SheetTabMetadata extends SheetMetadata {
  sheetName: string;
}

export interface SheetRow {
  [column: string]: string;
}

export class SheetsService {
  static async getUserSheets(): Promise<GoogleSheet[]> {
    const response = await HttpClient.get<{ sheets: GoogleSheet[] }>(SHEETS_ENDPOINTS.SHEETS);
    return response.sheets;
  }

  static async addSheet(payload: string | { url: string; sheetName: string }): Promise<{ sheet: GoogleSheet; metadata: SheetMetadata }> {
    // Handle both string (legacy) and object (new) formats
    const requestBody = typeof payload === 'string' 
      ? { input: payload }
      : { input: payload.url, sheetName: payload.sheetName };
    
    return await HttpClient.post<{ sheet: GoogleSheet; metadata: SheetMetadata }>(
      SHEETS_ENDPOINTS.SHEETS,
      requestBody
    );
  }

  static async getSheet(id: string): Promise<GoogleSheet> {
    const response = await HttpClient.get<{ sheet: GoogleSheet }>(SHEETS_ENDPOINTS.SHEET_BY_ID(id));
    return response.sheet;
  }

  static async updateSheet(id: string, updates: { title?: string }): Promise<GoogleSheet> {
    const response = await HttpClient.put<{ sheet: GoogleSheet }>(SHEETS_ENDPOINTS.SHEET_BY_ID(id), updates);
    return response.sheet;
  }

  static async deleteSheet(id: string): Promise<void> {
    await HttpClient.delete(SHEETS_ENDPOINTS.SHEET_BY_ID(id));
  }

  static async getSheetTabs(id: string): Promise<SheetTabMetadata[]> {
    const response = await HttpClient.get<{ tabs: SheetTabMetadata[] }>(`/api/sheets/${id}/tabs`);
    return response.tabs;
  }

  static async getSheetMappings(id: string): Promise<SheetMapping[]> {
    const response = await HttpClient.get<{ mappings: SheetMapping[] }>(SHEETS_ENDPOINTS.SHEET_MAPPINGS(id));
    return response.mappings;
  }

  static async saveSheetMappings(id: string, mappings: Array<{ fieldName: string; columnLetter: string }>): Promise<SheetMapping[]> {
    const response = await HttpClient.post<{ mappings: SheetMapping[] }>(
      SHEETS_ENDPOINTS.SHEET_MAPPINGS(id),
      { mappings }
    );
    return response.mappings;
  }

  static async getSheetData(id: string): Promise<SheetRow[]> {
    const response = await HttpClient.get<{ data: SheetRow[] }>(SHEETS_ENDPOINTS.SHEET_DATA(id));
    return response.data;
  }

  static async refreshSheetData(id: string): Promise<{ data: SheetRow[]; syncedAt: string }> {
    return await HttpClient.post<{ data: SheetRow[]; syncedAt: string }>(
      SHEETS_ENDPOINTS.SHEET_SYNC(id)
    );
  }

  static async pushSheetChanges(id: string): Promise<{ message: string; pushedAt: string }> {
    return await HttpClient.post<{ message: string; pushedAt: string }>(
      SHEETS_ENDPOINTS.SHEET_PUSH(id)
    );
  }

  static async pushSheetData(id: string, data: SheetRow[]): Promise<{ message: string; pushedAt: string }> {
    return await HttpClient.post<{ message: string; pushedAt: string }>(
      SHEETS_ENDPOINTS.SHEET_PUSH(id),
      { data }
    );
  }

  // Keep the old method for backwards compatibility, but mark as deprecated
  /** @deprecated Use refreshSheetData instead */
  static async syncSheetData(id: string): Promise<{ data: SheetRow[]; syncedAt: string }> {
    return this.refreshSheetData(id);
  }
}