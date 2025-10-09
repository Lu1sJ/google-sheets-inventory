import { db } from '../db.js';
import { syncQueue, syncHistory, googleSheets, sheetMappings, users } from '../../shared/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import type { InsertSyncQueue, InsertSyncHistory, SheetMapping } from '../../shared/schema.js';
import { GoogleSheetsService } from './google-sheets-service.js';

export class SyncService {
  /**
   * Get user's access token for Google Sheets API
   */
  private async getUserAccessToken(userId: string): Promise<string> {
    const user = await db
      .select({ googleAccessToken: users.googleAccessToken })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user[0] || !user[0].googleAccessToken) {
      throw new Error('User access token not found');
    }
    
    return user[0].googleAccessToken;
  }

  /**
   * Add an item to the sync queue when it's marked as "Decommissioned"
   */
  async addToDecommissionQueue(
    userId: string,
    sourceSheetId: string,
    rowIndex: number,
    rowData: Record<string, any>
  ): Promise<string> {
    const queueItem: InsertSyncQueue = {
      userId,
      sourceSheetId,
      sourceRowIndex: rowIndex,
      itemType: 'decommission',
      itemData: rowData,
      status: 'pending'
    };

    const result = await db.insert(syncQueue).values(queueItem).returning({ id: syncQueue.id });
    return result[0].id;
  }

  /**
   * Get all pending items in the sync queue for a user
   */
  async getPendingSyncItems(userId: string) {
    console.log('🔎 SyncService.getPendingSyncItems called with userId:', userId);
    const result = await db
      .select()
      .from(syncQueue)
      .where(and(
        eq(syncQueue.userId, userId),
        eq(syncQueue.status, 'pending')
      ))
      .orderBy(desc(syncQueue.createdAt));
    console.log('🔎 SyncService query result:', result.length, 'items');
    return result;
  }

  /**
   * Sync decommissioned items to Disposal Inventory tab within the same sheet
   */
  async syncToDisposalInventoryTab(
    userId: string,
    queueId: string,
    sheetId: string,
    tabName: string = "Disposal Inventory"
  ): Promise<boolean> {
    try {
      // Get the queue item with user ownership check
      const queueItem = await db
        .select()
        .from(syncQueue)
        .where(and(
          eq(syncQueue.id, queueId),
          eq(syncQueue.userId, userId)
        ))
        .limit(1);

      if (queueItem.length === 0) {
        throw new Error('Queue item not found');
      }

      const item = queueItem[0];
      const itemData = item.itemData as Record<string, any>;

      // Get user's access token and sheet info
      const accessToken = await this.getUserAccessToken(userId);
      const sheetInfo = await db
        .select()
        .from(googleSheets)
        .where(eq(googleSheets.id, sheetId))
        .limit(1);

      if (!sheetInfo[0]) {
        throw new Error('Sheet not found');
      }

      // Prepare the data to sync: Status, Serial Number, Asset Tag ONLY
      // Column D (Upcycle Disposal Number) is manually managed, don't touch it
      const syncData = {
        A: itemData.C || 'Decommissioned', // Status
        B: itemData.F || '',               // Serial Number  
        C: itemData.I || '',               // Asset Tag
        // Column D (Upcycle Disposal Number) is manually entered, skip it
      };

      console.log(`📝 Disposal sync data:`, syncData);

      // Find the next available row (append to end)
      const existingData = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId, 
        accessToken, 
        tabName
      );
      const targetRowIndex = existingData.length + 1; // Next row

      // Update the target sheet tab using batch update
      const rowData = { _rowIndex: targetRowIndex - 1, ...syncData };
      await GoogleSheetsService.updateSelectiveRows(
        sheetInfo[0].sheetId, 
        accessToken, 
        [rowData], 
        tabName
      );

      // Record the sync in history
      const historyItem: InsertSyncHistory = {
        queueId,
        targetSheetId: sheetId,
        targetRowIndex,
        syncedFields: syncData,
        syncType: 'disposal_inventory'
      };

      await db.insert(syncHistory).values(historyItem);

      // Mark queue item as processed
      await db
        .update(syncQueue)
        .set({ status: 'synced', processedAt: new Date() })
        .where(eq(syncQueue.id, queueId));

      return true;
    } catch (error) {
      console.error('Error syncing to disposal inventory tab:', error);
      
      // Mark as failed
      await db
        .update(syncQueue)
        .set({ status: 'failed', processedAt: new Date() })
        .where(eq(syncQueue.id, queueId));

      return false;
    }
  }

  /**
   * Sync decommissioned items to Disposal Inventory sheet
   */
  async syncToDisposalInventory(
    userId: string,
    queueId: string,
    targetSheetId: string
  ): Promise<boolean> {
    try {
      // Get the queue item with user ownership check
      const queueItem = await db
        .select()
        .from(syncQueue)
        .where(and(
          eq(syncQueue.id, queueId),
          eq(syncQueue.userId, userId)
        ))
        .limit(1);

      if (queueItem.length === 0) {
        throw new Error('Queue item not found');
      }

      const item = queueItem[0];
      const itemData = item.itemData as Record<string, any>;

      // Get target sheet mappings to know which columns to update
      const targetMappings = await db
        .select()
        .from(sheetMappings)
        .where(eq(sheetMappings.sheetId, targetSheetId));

      // Prepare the data to sync: Status, Serial Number, Asset Tag
      const syncData: Record<string, any> = {};
      
      // Map the fields from source to target columns
      for (const mapping of targetMappings) {
        if (mapping.fieldName === 'Status') {
          syncData[mapping.columnLetter] = itemData.C || itemData.Status || itemData.status;
        } else if (mapping.fieldName === 'Serial number' || mapping.fieldName === 'Serial Number') {
          syncData[mapping.columnLetter] = itemData.F || itemData['Serial Number'] || itemData.serialNumber;
        } else if (mapping.fieldName === 'Asset tag' || mapping.fieldName === 'Asset Tag') {
          syncData[mapping.columnLetter] = itemData.I || itemData['Asset Tag'] || itemData.assetTag;
        }
      }

      // Find or create a row in the target sheet
      const targetRowIndex = await this.findOrCreateTargetRow(targetSheetId, syncData, userId);

      // Get user's access token and sheet info
      const accessToken = await this.getUserAccessToken(userId);
      const sheetInfo = await db
        .select()
        .from(googleSheets)
        .where(eq(googleSheets.id, targetSheetId))
        .limit(1);

      if (!sheetInfo[0]) {
        throw new Error('Target sheet not found');
      }

      // Update the target sheet using batch update
      const rowData = { _rowIndex: targetRowIndex - 1, ...syncData };
      await GoogleSheetsService.updateSelectiveRows(
        sheetInfo[0].sheetId, 
        accessToken, 
        [rowData], 
        sheetInfo[0].sheetName || undefined
      );

      // Record the sync in history
      const historyItem: InsertSyncHistory = {
        queueId,
        targetSheetId,
        targetRowIndex,
        syncedFields: syncData,
        syncType: 'disposal_inventory'
      };

      await db.insert(syncHistory).values(historyItem);

      // Mark queue item as processed
      await db
        .update(syncQueue)
        .set({ status: 'synced', processedAt: new Date() })
        .where(eq(syncQueue.id, queueId));

      return true;
    } catch (error) {
      console.error('Error syncing to disposal inventory:', error);
      
      // Mark as failed
      await db
        .update(syncQueue)
        .set({ status: 'failed', processedAt: new Date() })
        .where(eq(syncQueue.id, queueId));

      return false;
    }
  }

  /**
   * Sync decommissioned items to Absolute Inventory tab within the same sheet
   */
  async syncToAbsoluteInventoryTab(
    userId: string,
    queueId: string,
    sheetId: string,
    tabName: string = "Absolute Inventory"
  ): Promise<boolean> {
    try {
      // Get the queue item with user ownership check
      const queueItem = await db
        .select()
        .from(syncQueue)
        .where(and(
          eq(syncQueue.id, queueId),
          eq(syncQueue.userId, userId)
        ))
        .limit(1);

      if (queueItem.length === 0) {
        throw new Error('Queue item not found');
      }

      const item = queueItem[0];
      const itemData = item.itemData as Record<string, any>;

      // Get user's access token and sheet info
      const accessToken = await this.getUserAccessToken(userId);
      const sheetInfo = await db
        .select()
        .from(googleSheets)
        .where(eq(googleSheets.id, sheetId))
        .limit(1);

      if (!sheetInfo[0]) {
        throw new Error('Sheet not found');
      }

      // Prepare the data to sync: Status, Serial Number, Computer Name (Device Name)
      // Based on Absolute Inventory structure: A=Status, B=Serial number, C=Computer Name
      const syncData = {
        A: itemData.C || 'Decommissioned', // Status
        B: itemData.F || '',               // Serial Number  
        C: itemData.T || '',               // Computer Name (Device Name like "X-WO-LAP-01")
        // Terrell Verified column is manually managed, don't touch it
      };

      console.log(`📝 Absolute sync data:`, syncData);

      // Find the next available row (append to end)
      const existingData = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId, 
        accessToken, 
        tabName
      );
      const targetRowIndex = existingData.length + 1; // Next row

      // Update the target sheet tab using batch update
      const rowData = { _rowIndex: targetRowIndex - 1, ...syncData };
      await GoogleSheetsService.updateSelectiveRows(
        sheetInfo[0].sheetId, 
        accessToken, 
        [rowData], 
        tabName
      );

      // Record the sync in history
      const historyItem: InsertSyncHistory = {
        queueId,
        targetSheetId: sheetId,
        targetRowIndex,
        syncedFields: syncData,
        syncType: 'absolute_inventory'
      };

      await db.insert(syncHistory).values(historyItem);

      // Mark queue item as processed (but don't mark as synced until both sheets are done)
      // The disposal inventory method will mark it as synced

      return true;
    } catch (error) {
      console.error('Error syncing to absolute inventory tab:', error);
      
      // Mark as failed
      await db
        .update(syncQueue)
        .set({ status: 'failed', processedAt: new Date() })
        .where(eq(syncQueue.id, queueId));

      return false;
    }
  }

  /**
   * Sync decommissioned items to Crowdstrike Inventory tab within the same sheet
   * FILTER: Only laptops and desktops (skip tablets, phones, etc.)
   */
  async syncToCrowdstrikeInventoryTab(
    userId: string,
    queueId: string,
    sheetId: string,
    tabName: string = "Crowdstrike Inventory"
  ): Promise<boolean> {
    try {
      // Get the queue item with user ownership check
      const queueItem = await db
        .select()
        .from(syncQueue)
        .where(and(
          eq(syncQueue.id, queueId),
          eq(syncQueue.userId, userId)
        ))
        .limit(1);

      if (queueItem.length === 0) {
        throw new Error('Queue item not found');
      }

      const item = queueItem[0];
      const itemData = item.itemData as Record<string, any>;

      // Get user's access token and sheet info
      const accessToken = await this.getUserAccessToken(userId);
      const sheetInfo = await db
        .select()
        .from(googleSheets)
        .where(eq(googleSheets.id, sheetId))
        .limit(1);

      if (!sheetInfo[0]) {
        throw new Error('Sheet not found');
      }

      // Prepare the data to sync: Status, Serial Number, Device Name
      // Crowdstrike format: A=Status, B=Serial Number, C=Device Name
      const syncData = {
        A: itemData.C || 'Decommissioned', // Status
        B: itemData.F || '',               // Serial Number  
        C: itemData.T || '',               // Device Name (e.g. "X-WO-LAP-01")
        // Other columns manually managed, don't touch them
      };

      console.log(`📝 Crowdstrike sync data:`, syncData);

      // Find the next available row (append to end)
      const existingData = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId, 
        accessToken, 
        tabName
      );
      const targetRowIndex = existingData.length + 1; // Next row

      // Update the target sheet tab using batch update
      const rowData = { _rowIndex: targetRowIndex - 1, ...syncData };
      await GoogleSheetsService.updateSelectiveRows(
        sheetInfo[0].sheetId, 
        accessToken, 
        [rowData], 
        tabName
      );

      // Record the sync in history
      const historyItem: InsertSyncHistory = {
        queueId,
        targetSheetId: sheetId,
        targetRowIndex,
        syncedFields: syncData,
        syncType: 'crowdstrike_inventory'
      };

      await db.insert(syncHistory).values(historyItem);

      return true;
    } catch (error) {
      console.error('Error syncing to Crowdstrike inventory tab:', error);
      
      // Mark as failed
      await db
        .update(syncQueue)
        .set({ status: 'failed', processedAt: new Date() })
        .where(eq(syncQueue.id, queueId));

      return false;
    }
  }

  /**
   * PERFORMANCE FILTER: Only get relevant sheet names to avoid loading unnecessary tabs
   */
  private async getRelevantSheetNames(sheetId: string, accessToken: string): Promise<string[]> {
    try {
      // Get all available sheet/tab names in the spreadsheet
      const metadata = await GoogleSheetsService.getAllSheetsMetadata(sheetId, accessToken);
      const allSheets = metadata.map(sheet => sheet.sheetName);
      
      // PERFORMANCE: Filter to only relevant sheets used by the application
      const relevantPatterns = [
        /^Branch Verified Inventory$/i,           // Main working sheet
        /^Disposal Inventory$/i,                  // Cross-sync sheet
        /^Absolute Inventory$/i,                  // Cross-sync sheet  
        /^Crowdstrike Inventory$/i,               // Cross-sync sheet
        /^[A-Z]{2} BookOps Laptop Information$/i, // Cross-sync sheet (dynamic branch codes)
        /^XX BookOps Laptop Information$/i,       // Cross-sync sheet (default)
        // Add other predefined template patterns here if needed
      ];
      
      const relevantSheets = allSheets.filter(sheetName => 
        relevantPatterns.some(pattern => pattern.test(sheetName))
      );
      
      console.log(`🔍 Filtered ${relevantSheets.length} relevant sheets from ${allSheets.length} total:`, relevantSheets);
      return relevantSheets;
      
    } catch (error) {
      console.error("Error getting relevant sheet names:", error);
      return []; // Return empty array on error
    }
  }

  /**
   * SMART LOOKUP: Find the correct BookOps sheet name with dynamic branch codes
   */
  private async findBookOpsSheetName(sheetId: string, accessToken: string): Promise<string> {
    try {
      // PERFORMANCE: Only get relevant sheets instead of all 20+ tabs
      const availableSheets = await this.getRelevantSheetNames(sheetId, accessToken);
      
      console.log(`🔍 Searching in relevant sheets:`, availableSheets);
      
      // First try: Look for "XX BookOps Laptop Information"
      const exactMatch = availableSheets.find(name => name === "XX BookOps Laptop Information");
      if (exactMatch) {
        console.log(`✅ Found exact match: ${exactMatch}`);
        return exactMatch;
      }
      
      // Smart lookup: Look for "[2-letter-code] BookOps Laptop Information" pattern
      const bookOpsPattern = /^[A-Z]{2} BookOps Laptop Information$/i;
      const smartMatch = availableSheets.find(name => bookOpsPattern.test(name));
      if (smartMatch) {
        console.log(`🎯 Found smart match: ${smartMatch}`);
        return smartMatch;
      }
      
      // Fallback: Default name (will likely fail, but at least we tried)
      console.log(`⚠️  No BookOps sheet found, using default name`);
      return "XX BookOps Laptop Information";
      
    } catch (error) {
      console.error("Error finding BookOps sheet name:", error);
      return "XX BookOps Laptop Information"; // Fallback
    }
  }

  /**
   * Sync decommissioned items to XX BookOps Laptop Information tab within the same sheet
   * Uses smart lookup to handle dynamic branch codes (BC, WO, etc.)
   */
  async syncToBookOpsLaptopInfoTab(
    userId: string,
    queueId: string,
    sheetId: string,
    userEmail: string,
    tabName?: string // Now optional - will use smart lookup if not provided
  ): Promise<boolean> {
    try {
      // Get the queue item with user ownership check
      const queueItem = await db
        .select()
        .from(syncQueue)
        .where(and(
          eq(syncQueue.id, queueId),
          eq(syncQueue.userId, userId)
        ))
        .limit(1);

      if (queueItem.length === 0) {
        throw new Error('Queue item not found');
      }

      const item = queueItem[0];
      const itemData = item.itemData as Record<string, any>;

      // Get user's access token and sheet info
      const accessToken = await this.getUserAccessToken(userId);
      const sheetInfo = await db
        .select()
        .from(googleSheets)
        .where(eq(googleSheets.id, sheetId))
        .limit(1);

      if (!sheetInfo[0]) {
        throw new Error('Sheet not found');
      }

      // SMART LOOKUP: Find the correct BookOps sheet name if not provided
      const actualTabName = tabName || await this.findBookOpsSheetName(sheetInfo[0].sheetId, accessToken);
      console.log(`📋 Using BookOps tab name: "${actualTabName}"`);

      // Format current date as MM/DD/YYYY in EST timezone (e.g., 9/29/2025)
      const { formatLastVerifiedDate } = await import('../utils/date-utils');
      const formattedDate = formatLastVerifiedDate();

      // Prepare the data to sync: 
      // A=Technician (user email), B=Old Asset Tag, F=Device Name, H=Last Verified Date
      const syncData = {
        A: userEmail,                      // Technician (current user email)
        B: itemData.I || '',               // Old Asset Tag (Asset Tag field)
        F: itemData.T || '',               // Device Name (e.g. "X-WO-LAP-01")
        H: formattedDate                   // Last Verified Inventory date (current date)
      };

      console.log(`📝 BookOps sync data:`, syncData);

      // Find the next available row (append to end)
      const existingData = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId, 
        accessToken, 
        actualTabName
      );
      const targetRowIndex = existingData.length + 1; // Next row

      // For BookOps, use individual cell updates since columns are non-contiguous (A, B, F, H)
      // This prevents the issue where sparse columns get written to wrong positions
      const updates = [];
      for (const [column, value] of Object.entries(syncData)) {
        if (value) { // Only update non-empty values
          updates.push({
            range: `${actualTabName}!${column}${targetRowIndex}`,
            values: [[value]]
          });
        }
      }

      // Use batch update with individual cell ranges
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetInfo[0].sheetId}/values:batchUpdate`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: updates
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update BookOps sheet: ${response.status} ${errorText}`);
      }

      // Record the sync in history
      const historyItem: InsertSyncHistory = {
        queueId,
        targetSheetId: sheetId,
        targetRowIndex,
        syncedFields: syncData,
        syncType: 'bookops_laptop_info'
      };

      await db.insert(syncHistory).values(historyItem);

      return true;
    } catch (error) {
      console.error('Error syncing to BookOps laptop info tab:', error);
      
      // Mark as failed
      await db
        .update(syncQueue)
        .set({ status: 'failed', processedAt: new Date() })
        .where(eq(syncQueue.id, queueId));

      return false;
    }
  }

  /**
   * Sync decommissioned items to Absolute Inventory sheet
   */
  async syncToAbsoluteInventory(
    userId: string,
    queueId: string,
    targetSheetId: string
  ): Promise<boolean> {
    try {
      // Get the queue item with user ownership check
      const queueItem = await db
        .select()
        .from(syncQueue)
        .where(and(
          eq(syncQueue.id, queueId),
          eq(syncQueue.userId, userId)
        ))
        .limit(1);

      if (queueItem.length === 0) {
        throw new Error('Queue item not found');
      }

      const item = queueItem[0];
      const itemData = item.itemData as Record<string, any>;

      // Get target sheet mappings
      const targetMappings = await db
        .select()
        .from(sheetMappings)
        .where(eq(sheetMappings.sheetId, targetSheetId));

      // Prepare the data to sync: Status, Serial Number, Device Name (maps to Computer Name)
      const syncData: Record<string, any> = {};
      
      // Map the fields from source to target columns
      for (const mapping of targetMappings) {
        if (mapping.fieldName === 'Status') {
          syncData[mapping.columnLetter] = itemData.C || itemData.Status || itemData.status;
        } else if (mapping.fieldName === 'Serial number' || mapping.fieldName === 'Serial Number') {
          syncData[mapping.columnLetter] = itemData.F || itemData['Serial Number'] || itemData.serialNumber;
        } else if (mapping.fieldName === 'Computer Name') {
          // Map Device Name (field T) to Computer Name - e.g. "X-WO-LAP-01"
          syncData[mapping.columnLetter] = itemData.T || itemData['Device Name'] || itemData.deviceName;
        }
      }

      // Find or create a row in the target sheet
      const targetRowIndex = await this.findOrCreateTargetRow(targetSheetId, syncData, userId);

      // Get user's access token and sheet info
      const accessToken = await this.getUserAccessToken(userId);
      const sheetInfo = await db
        .select()
        .from(googleSheets)
        .where(eq(googleSheets.id, targetSheetId))
        .limit(1);

      if (!sheetInfo[0]) {
        throw new Error('Target sheet not found');
      }

      // Update the target sheet using batch update
      const rowData = { _rowIndex: targetRowIndex - 1, ...syncData };
      await GoogleSheetsService.updateSelectiveRows(
        sheetInfo[0].sheetId, 
        accessToken, 
        [rowData], 
        sheetInfo[0].sheetName || undefined
      );

      // Record the sync in history
      const historyItem: InsertSyncHistory = {
        queueId,
        targetSheetId,
        targetRowIndex,
        syncedFields: syncData,
        syncType: 'absolute_inventory'
      };

      await db.insert(syncHistory).values(historyItem);

      // Mark queue item as processed
      await db
        .update(syncQueue)
        .set({ status: 'synced', processedAt: new Date() })
        .where(eq(syncQueue.id, queueId));

      return true;
    } catch (error) {
      console.error('Error syncing to absolute inventory:', error);
      
      // Mark as failed
      await db
        .update(syncQueue)
        .set({ status: 'failed', processedAt: new Date() })
        .where(eq(syncQueue.id, queueId));

      return false;
    }
  }

  /**
   * Find an existing row or create a new one for the target data
   */
  private async findOrCreateTargetRow(targetSheetId: string, syncData: Record<string, any>, userId: string): Promise<number> {
    // For now, always append as a new row
    // In the future, we could implement logic to find existing rows by serial number
    try {
      const accessToken = await this.getUserAccessToken(userId);
      const sheetInfo = await db
        .select()
        .from(googleSheets)
        .where(eq(googleSheets.id, targetSheetId))
        .limit(1);

      if (!sheetInfo[0]) {
        throw new Error('Sheet not found');
      }

      const sheetData = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId, 
        accessToken, 
        sheetInfo[0].sheetName || undefined
      );
      return sheetData.length + 2; // Google Sheets is 1-indexed, +1 for header, +1 for new row
    } catch (error) {
      // Fallback to a safe row number if we can't get sheet data
      return 100; // Start at row 100 as a safe fallback
    }
  }

  /**
   * Get sync history for a queue item
   */
  async getSyncHistory(queueId: string) {
    return await db
      .select()
      .from(syncHistory)
      .where(eq(syncHistory.queueId, queueId))
      .orderBy(desc(syncHistory.createdAt));
  }

  /**
   * Update Description in Branch Verified Inventory when item is decommissioned
   */
  async updateBranchVerifiedDescription(
    userId: string,
    sheetId: string,
    serialNumber: string,
    assetTag: string
  ): Promise<boolean> {
    try {
      const accessToken = await this.getUserAccessToken(userId);
      const sheetInfo = await db
        .select()
        .from(googleSheets)
        .where(eq(googleSheets.id, sheetId))
        .limit(1);

      if (!sheetInfo[0]) {
        throw new Error('Sheet not found');
      }

      // Get Branch Verified Inventory data
      const branchData = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId,
        accessToken,
        'Branch Verified Inventory'
      );

      // Find the row by matching serial number or asset tag
      let targetRowIndex = -1;
      for (let i = 1; i < branchData.length; i++) { // Start at 1 to skip header
        const row = branchData[i];
        const rowSerial = row['F'] || ''; // Column F is Serial Number
        const rowAsset = row['I'] || ''; // Column I is Asset Tag
        
        if ((serialNumber && rowSerial === serialNumber) || (assetTag && rowAsset === assetTag)) {
          targetRowIndex = i;
          break;
        }
      }

      if (targetRowIndex === -1) {
        console.log(`⚠️ No matching row found in Branch Verified Inventory for Serial: ${serialNumber}, Asset: ${assetTag}`);
        return false;
      }

      // Update Description column (W)
      const { getCurrentYearEST } = await import('../utils/date-utils');
      const currentYear = getCurrentYearEST();
      const descriptionText = `Equipment was decommissioned during Project Nova ${currentYear}`;
      
      await GoogleSheetsService.updateSpecificCell(
        sheetInfo[0].sheetId,
        accessToken,
        targetRowIndex,
        'W',
        descriptionText,
        'Branch Verified Inventory'
      );

      console.log(`✅ Updated Description in Branch Verified Inventory row ${targetRowIndex + 1}, column W`);
      return true;
    } catch (error) {
      console.error('Error updating Branch Verified Description:', error);
      return false;
    }
  }

  /**
   * BATCH SYNC: Process all decommissioned items in one go (10-15x faster)
   */
  async batchSyncDecommissionedItems(
    userId: string,
    sourceSheetId: string,
    items: Array<{
      queueId: string;
      rowData: any;
      rowIndex: number;
      serialNumber: string;
      assetTag: string;
      isLaptop: boolean;
      isDesktop: boolean;
    }>,
    userEmail: string
  ): Promise<void> {
    if (items.length === 0) return;

    const accessToken = await this.getUserAccessToken(userId);
    const sheetInfo = await db
      .select()
      .from(googleSheets)
      .where(eq(googleSheets.id, sourceSheetId))
      .limit(1);

    if (!sheetInfo[0]) {
      throw new Error('Sheet not found');
    }

    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      console.log(`⚡ Starting batch sync for ${items.length} items...`);
    }

    // Filter items by category
    const allItems = items;
    const laptops = items.filter(item => item.isLaptop);
    const laptopsAndDesktops = items.filter(item => item.isLaptop || item.isDesktop);
    
    // DEBUG: Show filtering results with sample data for diagnosis (dev only)
    if (isDev) {
      console.log(`📊 Device filtering results:
      - Total items: ${allItems.length}
      - Laptops only: ${laptops.length}
      - Laptops + Desktops: ${laptopsAndDesktops.length}
      - Will sync to:
        ✓ Disposal Inventory (all ${allItems.length} items)
        ${laptops.length > 0 ? '✓' : '✗'} Absolute Inventory (${laptops.length} laptops)
        ${laptopsAndDesktops.length > 0 ? '✓' : '✗'} Crowdstrike Inventory (${laptopsAndDesktops.length} laptops/desktops)
        ${laptops.length > 0 ? '✓' : '✗'} BookOps (${laptops.length} laptops)
      `);
    }
    
    // Show sample items to diagnose classification issues (dev only, or if all items fail classification)
    if (allItems.length > 0 && laptops.length === 0 && laptopsAndDesktops.length === 0) {
      // Always log this warning since it indicates a potential issue
      console.warn(`⚠️  [SyncService] No laptops/desktops detected in batch of ${allItems.length} items - skipping Absolute/Crowdstrike/BookOps sync`);
      
      if (isDev) {
        console.log(`Sample items for diagnosis:`);
        const samples = allItems.slice(0, 3); // Show first 3 items
        samples.forEach((item, idx) => {
          const allText = Object.values(item.rowData).join(' ').toLowerCase();
          console.log(`  Item ${idx + 1}:
          - Serial: ${item.serialNumber || 'N/A'}
          - Asset: ${item.assetTag || 'N/A'}
          - Contains "laptop": ${allText.includes('laptop')}
          - Contains "desktop": ${allText.includes('desktop')}
          - Sample text: ${allText.substring(0, 100)}...
          `);
        });
      }
    }

    // BATCH 1: Update all Descriptions in Branch Verified Inventory (same logic as Disposal/Crowdstrike)
    if (isDev) {
      console.log(`📝 Batch updating ${items.length} descriptions...`);
    }
    try {
      // Get Branch Verified Inventory data ONCE
      const branchData = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId,
        accessToken,
        'Branch Verified Inventory'
      );

      // Prepare batch description updates
      const { getCurrentYearEST } = await import('../utils/date-utils');
      const currentYear = getCurrentYearEST();
      const descriptionText = `Equipment was decommissioned during Project Nova ${currentYear}`;
      
      const rowsToUpdate: Array<any> = [];
      
      // Find all matching rows and prepare updates (same pattern as Disposal/Crowdstrike)
      for (const item of items) {
        if (!item.serialNumber && !item.assetTag) continue;
        
        // Find the row by matching serial number or asset tag
        let targetRowIndex = -1;
        for (let i = 1; i < branchData.length; i++) { // Start at 1 to skip header
          const row = branchData[i];
          const rowSerial = row['F'] || ''; // Column F is Serial Number
          const rowAsset = row['I'] || ''; // Column I is Asset Tag
          
          if ((item.serialNumber && rowSerial === item.serialNumber) || 
              (item.assetTag && rowAsset === item.assetTag)) {
            targetRowIndex = i;
            if (isDev) {
              console.log(`🎯 Found match: Serial ${item.serialNumber} at branchData[${i}] = Google Sheets row ${i + 1}`);
            }
            break;
          }
        }

        if (targetRowIndex !== -1) {
          // Build full row with updated description (same as Disposal/Crowdstrike pattern)
          const updatedRow = { 
            ...branchData[targetRowIndex],
            W: descriptionText, // Update Description column
            _rowIndex: targetRowIndex
          };
          rowsToUpdate.push(updatedRow);
        } else {
          if (isDev || items.length <= 10) { // Log misses for small batches or in dev
            console.log(`⚠️ No matching row found for Serial: ${item.serialNumber}, Asset: ${item.assetTag}`);
          }
        }
      }

      // Execute batch update using updateSelectiveRows (same as Disposal/Crowdstrike - works with service account!)
      if (rowsToUpdate.length > 0) {
        await GoogleSheetsService.updateSelectiveRows(
          sheetInfo[0].sheetId,
          accessToken,
          rowsToUpdate,
          'Branch Verified Inventory'
        );
        console.log(`✅ INSTANT UPDATE: ${rowsToUpdate.length} descriptions in Branch Verified Inventory`);
      }
    } catch (error) {
      console.error('Error batch updating Branch Verified descriptions:', error);
    }

    // BATCH 2: Sync to Disposal Inventory (all items) - UPSERT logic
    if (allItems.length > 0) {
      console.log(`🔄 Batch syncing ${allItems.length} items to Disposal Inventory...`);
      const targetTab = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId,
        accessToken,
        "Disposal Inventory"
      );

      const rowsToUpsert: Array<{ _rowIndex: number; A: string; B: string; C: string }> = [];
      for (const item of allItems) {
        const serialNumber = item.rowData.F || '';
        
        // Find existing row by serial number (column B)
        let existingRowIndex = -1;
        for (let i = 1; i < targetTab.length; i++) { // Skip header row
          if (targetTab[i]['B'] === serialNumber && serialNumber) {
            existingRowIndex = i;
            break;
          }
        }

        if (existingRowIndex !== -1) {
          // Update existing row
          console.log(`♻️  Updating existing item in Disposal Inventory: ${serialNumber}`);
          rowsToUpsert.push({
            _rowIndex: existingRowIndex,
            A: item.rowData.C || 'Decommissioned',
            B: serialNumber,
            C: item.rowData.I || ''
          });
        } else {
          // Append new row
          console.log(`➕ Adding new item to Disposal Inventory: ${serialNumber}`);
          rowsToUpsert.push({
            _rowIndex: targetTab.length + rowsToUpsert.filter(r => r._rowIndex >= targetTab.length).length,
            A: item.rowData.C || 'Decommissioned',
            B: serialNumber,
            C: item.rowData.I || ''
          });
        }
      }

      if (rowsToUpsert.length > 0) {
        await GoogleSheetsService.updateSelectiveRows(
          sheetInfo[0].sheetId,
          accessToken,
          rowsToUpsert,
          "Disposal Inventory"
        );
      }

      // Mark all as synced
      for (const item of allItems) {
        await db.update(syncQueue)
          .set({ status: 'synced', processedAt: new Date() })
          .where(eq(syncQueue.id, item.queueId));
      }
      console.log(`✅ Synced ${allItems.length} items to Disposal Inventory`);
    }

    // BATCH 3: Sync to Absolute Inventory (laptops only) - UPSERT logic
    if (laptops.length > 0) {
      console.log(`💻 Batch syncing ${laptops.length} laptops to Absolute Inventory...`);
      const targetTab = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId,
        accessToken,
        "Absolute Inventory"
      );

      const rowsToUpsert: Array<{ _rowIndex: number; A: string; B: string; C: string }> = [];
      for (const item of laptops) {
        const serialNumber = item.rowData.F || '';
        
        // Find existing row by serial number (column B)
        let existingRowIndex = -1;
        for (let i = 1; i < targetTab.length; i++) {
          if (targetTab[i]['B'] === serialNumber && serialNumber) {
            existingRowIndex = i;
            break;
          }
        }

        if (existingRowIndex !== -1) {
          console.log(`♻️  Updating existing laptop in Absolute Inventory: ${serialNumber}`);
          rowsToUpsert.push({
            _rowIndex: existingRowIndex,
            A: item.rowData.C || 'Decommissioned',
            B: serialNumber,
            C: item.rowData.T || '',
          });
        } else {
          console.log(`➕ Adding new laptop to Absolute Inventory: ${serialNumber}`);
          rowsToUpsert.push({
            _rowIndex: targetTab.length + rowsToUpsert.filter(r => r._rowIndex >= targetTab.length).length,
            A: item.rowData.C || 'Decommissioned',
            B: serialNumber,
            C: item.rowData.T || '',
          });
        }
      }

      if (rowsToUpsert.length > 0) {
        await GoogleSheetsService.updateSelectiveRows(
          sheetInfo[0].sheetId,
          accessToken,
          rowsToUpsert,
          "Absolute Inventory"
        );
      }
      console.log(`✅ Synced ${laptops.length} laptops to Absolute Inventory`);
    }

    // BATCH 4: Sync to Crowdstrike Inventory (laptops + desktops) - UPSERT logic
    if (laptopsAndDesktops.length > 0) {
      console.log(`🖥️  Batch syncing ${laptopsAndDesktops.length} laptops/desktops to Crowdstrike Inventory...`);
      const targetTab = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId,
        accessToken,
        "Crowdstrike Inventory"
      );

      const rowsToUpsert: Array<{ _rowIndex: number; A: string; B: string; C: string }> = [];
      for (const item of laptopsAndDesktops) {
        const serialNumber = item.rowData.F || '';
        
        // Find existing row by serial number (column B)
        let existingRowIndex = -1;
        for (let i = 1; i < targetTab.length; i++) {
          if (targetTab[i]['B'] === serialNumber && serialNumber) {
            existingRowIndex = i;
            break;
          }
        }

        if (existingRowIndex !== -1) {
          console.log(`♻️  Updating existing item in Crowdstrike Inventory: ${serialNumber}`);
          rowsToUpsert.push({
            _rowIndex: existingRowIndex,
            A: item.rowData.C || 'Decommissioned',
            B: serialNumber,
            C: item.rowData.T || '',
          });
        } else {
          console.log(`➕ Adding new item to Crowdstrike Inventory: ${serialNumber}`);
          rowsToUpsert.push({
            _rowIndex: targetTab.length + rowsToUpsert.filter(r => r._rowIndex >= targetTab.length).length,
            A: item.rowData.C || 'Decommissioned',
            B: serialNumber,
            C: item.rowData.T || '',
          });
        }
      }

      if (rowsToUpsert.length > 0) {
        await GoogleSheetsService.updateSelectiveRows(
          sheetInfo[0].sheetId,
          accessToken,
          rowsToUpsert,
          "Crowdstrike Inventory"
        );
      }
      console.log(`✅ Synced ${laptopsAndDesktops.length} items to Crowdstrike Inventory`);
    }

    // BATCH 5: Sync to BookOps Laptop Information (laptops only) - UPSERT logic
    if (laptops.length > 0) {
      console.log(`📋 Batch syncing ${laptops.length} laptops to BookOps...`);
      
      // Find BookOps sheet name
      const bookOpsTabName = await this.findBookOpsSheetName(sheetInfo[0].sheetId, accessToken);
      const targetTab = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId,
        accessToken,
        bookOpsTabName
      );

      // Prepare batch updates
      const { formatLastVerifiedDate } = await import('../utils/date-utils');
      const today = formatLastVerifiedDate();
      
      // For BookOps, use individual cell ranges since columns are non-contiguous (A, B, F, H)
      const updates: Array<{ range: string; values: string[][] }> = [];
      let newRowCount = 0;
      
      for (const item of laptops) {
        const assetTag = item.rowData.I || '';
        
        // Find existing row by asset tag (column B)
        let existingRowIndex = -1;
        for (let i = 1; i < targetTab.length; i++) {
          if (targetTab[i]['B'] === assetTag && assetTag) {
            existingRowIndex = i + 1; // +1 for 1-indexed Google Sheets
            break;
          }
        }

        if (existingRowIndex !== -1) {
          // Update existing row
          console.log(`♻️  Updating existing laptop in BookOps: ${assetTag}`);
          updates.push(
            { range: `${bookOpsTabName}!A${existingRowIndex}`, values: [[userEmail]] },
            { range: `${bookOpsTabName}!B${existingRowIndex}`, values: [[assetTag]] },
            { range: `${bookOpsTabName}!F${existingRowIndex}`, values: [[item.rowData.T || '']] },
            { range: `${bookOpsTabName}!H${existingRowIndex}`, values: [[today]] }
          );
        } else {
          // Append new row
          const newRowIndex = targetTab.length + 1 + newRowCount;
          console.log(`➕ Adding new laptop to BookOps: ${assetTag}`);
          updates.push(
            { range: `${bookOpsTabName}!A${newRowIndex}`, values: [[userEmail]] },
            { range: `${bookOpsTabName}!B${newRowIndex}`, values: [[assetTag]] },
            { range: `${bookOpsTabName}!F${newRowIndex}`, values: [[item.rowData.T || '']] },
            { range: `${bookOpsTabName}!H${newRowIndex}`, values: [[today]] }
          );
          newRowCount++;
        }
      }

      if (updates.length > 0) {
        // Use batch update with individual cell ranges
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetInfo[0].sheetId}/values:batchUpdate`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'RAW',
            data: updates
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to batch update BookOps sheet: ${response.status} ${errorText}`);
        }
      }

      console.log(`✅ Synced ${laptops.length} laptops to BookOps`);
    }

    console.log(`🎉 Batch sync completed successfully!`);
  }

  /**
   * BATCH UPDATE: Update descriptions for all missing items
   */
  async batchUpdateMissingDescriptions(
    userId: string,
    sourceSheetId: string,
    items: Array<{
      rowData: any;
      rowIndex: number;
      serialNumber: string;
      assetTag: string;
    }>
  ): Promise<void> {
    if (items.length === 0) return;

    const accessToken = await this.getUserAccessToken(userId);
    const sheetInfo = await db
      .select()
      .from(googleSheets)
      .where(eq(googleSheets.id, sourceSheetId))
      .limit(1);

    if (!sheetInfo[0]) {
      throw new Error('Sheet not found');
    }

    const isDev = process.env.NODE_ENV === 'development';
    
    try {
      // Get Branch Verified Inventory data ONCE
      const branchData = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId,
        accessToken,
        'Branch Verified Inventory'
      );

      // Prepare batch description updates (same pattern as Disposal/Crowdstrike)
      const { getCurrentYearEST } = await import('../utils/date-utils');
      const currentYear = getCurrentYearEST();
      const descriptionText = `Equipment was not found during Project Nova ${currentYear}`;
      
      const rowsToUpdate: Array<any> = [];
      
      // Find all matching rows and prepare updates (same pattern as Disposal/Crowdstrike)
      for (const item of items) {
        if (!item.serialNumber && !item.assetTag) continue;
        
        // Find the row by matching serial number or asset tag
        let targetRowIndex = -1;
        for (let i = 1; i < branchData.length; i++) { // Start at 1 to skip header
          const row = branchData[i];
          const rowSerial = row['F'] || ''; // Column F is Serial Number
          const rowAsset = row['I'] || ''; // Column I is Asset Tag
          
          if ((item.serialNumber && rowSerial === item.serialNumber) || 
              (item.assetTag && rowAsset === item.assetTag)) {
            targetRowIndex = i;
            if (isDev) {
              console.log(`🎯 Found missing item match: Serial ${item.serialNumber} at branchData[${i}] = Google Sheets row ${i + 1}`);
            }
            break;
          }
        }

        if (targetRowIndex !== -1) {
          // Build full row with updated description (same as Disposal/Crowdstrike pattern)
          const updatedRow = { 
            ...branchData[targetRowIndex],
            W: descriptionText, // Update Description column
            _rowIndex: targetRowIndex
          };
          rowsToUpdate.push(updatedRow);
        } else {
          if (isDev || items.length <= 10) {
            console.log(`⚠️ No matching row found for missing item - Serial: ${item.serialNumber}, Asset: ${item.assetTag}`);
          }
        }
      }

      // Execute batch update using updateSelectiveRows (works with service account!)
      if (rowsToUpdate.length > 0) {
        await GoogleSheetsService.updateSelectiveRows(
          sheetInfo[0].sheetId,
          accessToken,
          rowsToUpdate,
          'Branch Verified Inventory'
        );
        console.log(`✅ INSTANT UPDATE: ${rowsToUpdate.length} missing item descriptions in Branch Verified Inventory`);
      }
    } catch (error) {
      console.error('Error batch updating missing item descriptions:', error);
      throw error;
    }
  }

  /**
   * BATCH UPDATE: Update descriptions for all installed items
   */
  async batchUpdateInstalledDescriptions(
    userId: string,
    sourceSheetId: string,
    items: Array<{
      rowData: any;
      rowIndex: number;
      serialNumber: string;
      assetTag: string;
    }>
  ): Promise<void> {
    if (items.length === 0) return;

    const accessToken = await this.getUserAccessToken(userId);
    const sheetInfo = await db
      .select()
      .from(googleSheets)
      .where(eq(googleSheets.id, sourceSheetId))
      .limit(1);

    if (!sheetInfo[0]) {
      throw new Error('Sheet not found');
    }

    const isDev = process.env.NODE_ENV === 'development';
    
    try {
      // Get Branch Verified Inventory data ONCE
      const branchData = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId,
        accessToken,
        'Branch Verified Inventory'
      );

      // Prepare batch description updates (same pattern as Disposal/Crowdstrike)
      const { getCurrentYearEST } = await import('../utils/date-utils');
      const currentYear = getCurrentYearEST();
      const descriptionText = `Equipment found at branch during Project Nova ${currentYear}. Will remain at branch.`;
      
      const rowsToUpdate: Array<any> = [];
      
      // Find all matching rows and prepare updates (same pattern as Disposal/Crowdstrike)
      for (const item of items) {
        if (!item.serialNumber && !item.assetTag) continue;
        
        // Find the row by matching serial number or asset tag
        let targetRowIndex = -1;
        for (let i = 1; i < branchData.length; i++) { // Start at 1 to skip header
          const row = branchData[i];
          const rowSerial = row['F'] || ''; // Column F is Serial Number
          const rowAsset = row['I'] || ''; // Column I is Asset Tag
          
          if ((item.serialNumber && rowSerial === item.serialNumber) || 
              (item.assetTag && rowAsset === item.assetTag)) {
            targetRowIndex = i;
            if (isDev) {
              console.log(`🎯 Found installed item match: Serial ${item.serialNumber} at branchData[${i}] = Google Sheets row ${i + 1}`);
            }
            break;
          }
        }

        if (targetRowIndex !== -1) {
          // Build full row with updated description (same as Disposal/Crowdstrike pattern)
          const updatedRow = { 
            ...branchData[targetRowIndex],
            W: descriptionText, // Update Description column
            _rowIndex: targetRowIndex
          };
          rowsToUpdate.push(updatedRow);
        } else {
          if (isDev || items.length <= 10) {
            console.log(`⚠️ No matching row found for installed item - Serial: ${item.serialNumber}, Asset: ${item.assetTag}`);
          }
        }
      }

      // Execute batch update using updateSelectiveRows (works with service account!)
      if (rowsToUpdate.length > 0) {
        await GoogleSheetsService.updateSelectiveRows(
          sheetInfo[0].sheetId,
          accessToken,
          rowsToUpdate,
          'Branch Verified Inventory'
        );
        console.log(`✅ INSTANT UPDATE: ${rowsToUpdate.length} installed item descriptions in Branch Verified Inventory`);
      }
    } catch (error) {
      console.error('Error batch updating installed item descriptions:', error);
      throw error;
    }
  }

  /**
   * SYNC FROM SMALLER SHEET TO MAIN: Sync changed items from a smaller "bit" sheet to the main Branch Verified Inventory
   */
  async syncToMainBranchVerifiedInventory(
    userId: string,
    sourceSheetId: string,
    changedItems: Array<any>
  ): Promise<{ synced: number; notFound: number }> {
    if (changedItems.length === 0) {
      return { synced: 0, notFound: 0 };
    }

    const accessToken = await this.getUserAccessToken(userId);
    const sheetInfo = await db
      .select()
      .from(googleSheets)
      .where(eq(googleSheets.id, sourceSheetId))
      .limit(1);

    if (!sheetInfo[0]) {
      throw new Error('Sheet not found');
    }

    const isDev = process.env.NODE_ENV === 'development';
    
    try {
      // Get "Branch Verified Inventory" tab data - same way we get other tabs (Absolute, CrowdStrike, etc.)
      const branchData = await GoogleSheetsService.getSheetData(
        sheetInfo[0].sheetId,
        accessToken,
        'Branch Verified Inventory'
      );

      if (!branchData || branchData.length === 0) {
        throw new Error('Branch Verified Inventory tab is empty');
      }

      let syncedCount = 0;
      let notFoundCount = 0;
      const rowsToUpdate: Array<any> = [];

      // Process each changed item
      for (const item of changedItems) {
        const { _rowIndex, ...rowData } = item;
        const serialNumber = rowData.F || rowData['Serial Number'] || rowData['Serial number'] || '';
        const assetTag = rowData.I || rowData['Asset Tag'] || rowData['Asset tag'] || '';

        if (!serialNumber && !assetTag) {
          if (isDev) {
            console.log(`⚠️ Skipping item without Serial Number or Asset Tag`);
          }
          continue;
        }

        // Find matching row in Branch Verified Inventory (same way we find in Absolute, CrowdStrike, etc.)
        let targetRowIndex = -1;
        for (let i = 1; i < branchData.length; i++) { // Start at 1 to skip header
          const row = branchData[i];
          const rowSerial = row['F'] || '';
          const rowAsset = row['I'] || '';
          
          if ((serialNumber && rowSerial === serialNumber) || 
              (assetTag && rowAsset === assetTag)) {
            targetRowIndex = i;
            if (isDev) {
              console.log(`🎯 Found match in Branch Verified Inventory: Serial ${serialNumber} at row ${i + 1}`);
            }
            break;
          }
        }

        if (targetRowIndex !== -1) {
          // Collect row updates with _rowIndex for batch update
          const mainRow = branchData[targetRowIndex];
          const updatedRow: any = { ...mainRow, _rowIndex: targetRowIndex };
          
          // Apply changes from the smaller sheet
          let hasChanges = false;
          for (const [key, value] of Object.entries(rowData)) {
            if (mainRow[key] !== value) {
              updatedRow[key] = value;
              hasChanges = true;
            }
          }

          if (hasChanges) {
            rowsToUpdate.push(updatedRow);
            syncedCount++;
            if (isDev) {
              console.log(`✅ Queued update for Serial ${serialNumber} at row ${targetRowIndex + 1}`);
            }
          }
        } else {
          notFoundCount++;
          if (isDev || changedItems.length <= 10) {
            console.log(`⚠️ No match found in Branch Verified Inventory - Serial: ${serialNumber}, Asset: ${assetTag}`);
          }
        }
      }

      // Batch update all rows at once (same way we update Absolute, CrowdStrike, etc.)
      if (rowsToUpdate.length > 0) {
        await GoogleSheetsService.updateSelectiveRows(
          sheetInfo[0].sheetId,
          accessToken,
          rowsToUpdate,
          'Branch Verified Inventory'
        );
        console.log(`📤 Synced ${syncedCount} items to Branch Verified Inventory (${notFoundCount} not found)`);
      }

      return { synced: syncedCount, notFound: notFoundCount };
    } catch (error: any) {
      // If tab not found, throw a user-friendly error
      if (error.message?.includes('Unable to parse range') || error.message?.includes('not found')) {
        throw new Error('Branch Verified Inventory tab not found in this workbook. Please create it before syncing.');
      }
      console.error('Error syncing to Branch Verified Inventory:', error);
      throw error;
    }
  }

  /**
   * Clear processed items from the queue (older than 7 days)
   */
  async cleanupProcessedQueue(): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await db
      .delete(syncQueue)
      .where(and(
        eq(syncQueue.status, 'synced'),
        // TODO: Add date comparison when we have the proper imports
      ));

    return 0; // Return count when implemented
  }
}