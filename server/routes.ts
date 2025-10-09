import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { AuthService, GoogleOAuthService, GoogleAuthError } from "./auth";
import { requireAuth, requireRole, type AuthenticatedRequest } from "./middleware/rbac";
import { ApiResponse, handleAsyncRoute } from "./utils/response-helpers";
import { ValidationError, validateRequiredString } from "./utils/validation";
import { buildGoogleOAuthUrl } from "./utils/oauth-helpers";
import { ERROR_MESSAGES, USER_ROLES, SESSION_CLEANUP_INTERVAL_MS } from "./constants/auth";
import { OAuthCallbackService } from "./services/oauth-service";
import { AdminService } from "./services/admin-service";
import { GoogleSheetsService } from "./services/google-sheets-service";
import { SHEETS_ERROR_MESSAGES } from "./constants/sheets";
import { SyncService } from "./services/sync-service";

declare module "express-session" {
  interface SessionData {
    sessionId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get current user
  app.get("/api/auth/me", handleAsyncRoute(async (req: Request, res: Response) => {
    const sessionId = req.session.sessionId;
    if (!sessionId) {
      return ApiResponse.unauthorizedError(res);
    }
    
    const user = await AuthService.validateSession(sessionId);
    if (!user) {
      req.session.sessionId = undefined;
      return ApiResponse.unauthorizedError(res, ERROR_MESSAGES.SESSION_EXPIRED);
    }
    
    ApiResponse.success(res, { user: AuthService.toSafeUser(user) });
  }));

  // Google OAuth initiation
  app.get("/api/auth/google", handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      // In production autoscale, check multiple headers to get the actual domain
      const xForwardedHost = req.get('x-forwarded-host');
      const host = req.get('host');
      const origin = req.get('origin');
      
      // Extract host from origin if available (most reliable for production)
      let requestHost = xForwardedHost || host;
      if (origin && !xForwardedHost) {
        requestHost = origin.replace(/^https?:\/\//, '');
      }
      
      // Security: Only log non-sensitive OAuth flow information
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment) {
        console.log('OAuth initiation - requestHost:', requestHost);
      }
      
      const authUrl = buildGoogleOAuthUrl(requestHost);
      
      res.redirect(authUrl);
    } catch (error) {
      console.error('OAuth initiation error:', error);
      if (error instanceof ValidationError) {
        return ApiResponse.internalServerError(res, error.message);
      }
      throw error;
    }
  }));

  // Google OAuth callback
  app.get("/api/auth/google/callback", handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const redirectUrl = await OAuthCallbackService.handleGoogleCallback(req);
      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      const errorRedirectUrl = OAuthCallbackService.buildErrorRedirect(error as Error);
      res.redirect(errorRedirectUrl);
    }
  }));

  // Logout
  app.post("/api/auth/logout", handleAsyncRoute(async (req: Request, res: Response) => {
    const sessionId = req.session.sessionId;
    if (sessionId) {
      await storage.deleteSession(sessionId);
      req.session.sessionId = undefined;
    }
    
    ApiResponse.success(res, { success: true });
  }));

  // Update user profile
  app.patch("/api/profile", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updates: any = {};
      
      if (req.body.name) {
        updates.name = validateRequiredString(req.body.name, "Name");
      }
      
      if (req.body.email) {
        updates.email = validateRequiredString(req.body.email, "Email");
      }
      
      const updatedUser = await storage.updateUser(req.user!.id, updates);
      
      ApiResponse.success(res, { user: updatedUser });
    } catch (error) {
      if (error instanceof ValidationError) {
        return ApiResponse.error(res, error.message);
      }
      throw error;
    }
  }));

  // Delete user account
  app.delete("/api/profile", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    await storage.deleteAllUserSessions(req.user!.id);
    await storage.deleteUser(req.user!.id);
    
    req.session.sessionId = undefined;
    ApiResponse.success(res, { success: true });
  }));

  // Logout from all devices
  app.post("/api/auth/logout-all", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    await storage.deleteAllUserSessions(req.user!.id);
    
    req.session.sessionId = undefined;
    ApiResponse.success(res, { success: true });
  }));

  // Admin: Get all users
  app.get("/api/admin/users", requireAuth, requireRole(USER_ROLES.ADMIN), handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const users = await AdminService.getAllUsers();
    ApiResponse.success(res, { users });
  }));

  // Admin: Update user role
  app.patch("/api/admin/users/:userId/role", requireAuth, requireRole(USER_ROLES.ADMIN), handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      // Type validation: ensure role is a string
      if (!role || typeof role !== 'string') {
        return ApiResponse.error(res, "Role is required and must be a string");
      }
      
      const updatedUser = await AdminService.updateUserRole(userId, role, req.user!.id);
      ApiResponse.success(res, { user: updatedUser });
    } catch (error) {
      if (error instanceof ValidationError) {
        const statusCode = error.message === ERROR_MESSAGES.CANNOT_CHANGE_OWN_ROLE || 
                          error.message === ERROR_MESSAGES.CANNOT_REMOVE_LAST_ADMIN ? 403 : 400;
        return ApiResponse.error(res, error.message, statusCode);
      }
      throw error;
    }
  }));

  // Clean up expired sessions (run periodically)
  setInterval(async () => {
    try {
      await storage.deleteExpiredSessions();
    } catch (error) {
      console.error("Error cleaning up expired sessions:", error);
    }
  }, SESSION_CLEANUP_INTERVAL_MS);

  // Google Sheets routes
  app.get("/api/sheets", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const sheets = await storage.getUserGoogleSheets(req.user!.id);
    ApiResponse.success(res, { sheets });
  }));

  app.post("/api/sheets", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { input, sheetName } = req.body;
      
      // Type validation: ensure input is a string
      if (!input || typeof input !== 'string') {
        return ApiResponse.error(res, "Sheet URL or ID is required and must be a string");
      }
      
      // Type validation: ensure sheetName is undefined or a string
      if (sheetName !== undefined && typeof sheetName !== 'string') {
        return ApiResponse.error(res, "Sheet name must be a string");
      }

      const accessToken = await GoogleOAuthService.ensureValidAccessToken(req.user!);

      const sheetId = GoogleSheetsService.extractSheetId(input);
      const metadata = await GoogleSheetsService.getSheetMetadata(sheetId, accessToken, sheetName?.trim() || undefined);
      const url = GoogleSheetsService.buildSheetUrl(sheetId);

      const sheet = await storage.createGoogleSheet({
        userId: req.user!.id,
        sheetId,
        sheetName: sheetName?.trim() || null,
        title: metadata.title,
        url,
      });

      ApiResponse.success(res, { sheet, metadata });
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        return res.status(401).json({ message: error.message, code: error.code });
      }
      if (error instanceof Error) {
        return ApiResponse.error(res, error.message);
      }
      throw error;
    }
  }));

  // Get all tabs/sheets metadata for a specific sheet
  app.get("/api/sheets/:id/tabs", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sheet = await storage.getGoogleSheet(req.params.id);
      if (!sheet || sheet.userId !== req.user!.id) {
        return ApiResponse.notFoundError(res, "Sheet not found");
      }

      const accessToken = await GoogleOAuthService.ensureValidAccessToken(req.user!);
      const allTabsMetadata = await GoogleSheetsService.getAllSheetsMetadata(sheet.sheetId, accessToken);
      
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
      
      const filteredTabs = allTabsMetadata.filter(tab => 
        relevantPatterns.some(pattern => pattern.test(tab.sheetName))
      );
      
      console.log(`🚀 Performance: Filtered ${filteredTabs.length} relevant tabs from ${allTabsMetadata.length} total`);
      
      ApiResponse.success(res, { tabs: filteredTabs });
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        return res.status(401).json({ message: error.message, code: error.code });
      }
      if (error instanceof Error) {
        return ApiResponse.error(res, error.message);
      }
      throw error;
    }
  }));

  app.get("/api/sheets/:id", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const sheet = await storage.getGoogleSheet(req.params.id);
    if (!sheet || sheet.userId !== req.user!.id) {
      return ApiResponse.notFoundError(res, "Sheet not found");
    }
    ApiResponse.success(res, { sheet });
  }));

  app.put("/api/sheets/:id", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const sheet = await storage.getGoogleSheet(req.params.id);
    if (!sheet || sheet.userId !== req.user!.id) {
      return ApiResponse.notFoundError(res, "Sheet not found");
    }
    
    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      return ApiResponse.error(res, "Title is required and must be a string");
    }
    
    const updatedSheet = await storage.updateGoogleSheet(req.params.id, { title: title.trim() });
    if (!updatedSheet) {
      return ApiResponse.notFoundError(res, "Sheet not found");
    }
    
    ApiResponse.success(res, { sheet: updatedSheet });
  }));

  app.delete("/api/sheets/:id", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const sheet = await storage.getGoogleSheet(req.params.id);
    if (!sheet || sheet.userId !== req.user!.id) {
      return ApiResponse.notFoundError(res, "Sheet not found");
    }
    await storage.deleteGoogleSheet(req.params.id);
    ApiResponse.success(res, { success: true });
  }));

  app.get("/api/sheets/:id/mappings", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const sheet = await storage.getGoogleSheet(req.params.id);
    if (!sheet || sheet.userId !== req.user!.id) {
      return ApiResponse.notFoundError(res, "Sheet not found");
    }
    const mappings = await storage.getSheetMappings(req.params.id);
    ApiResponse.success(res, { mappings });
  }));

  app.post("/api/sheets/:id/mappings", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const sheet = await storage.getGoogleSheet(req.params.id);
    if (!sheet || sheet.userId !== req.user!.id) {
      return ApiResponse.notFoundError(res, "Sheet not found");
    }

    const { mappings } = req.body;
    if (!Array.isArray(mappings)) {
      return ApiResponse.error(res, "Mappings must be an array");
    }

    const insertMappings = mappings.map((m, index) => ({
      sheetId: req.params.id,
      fieldName: m.fieldName,
      columnLetter: m.columnLetter,
      order: index,
    }));

    const savedMappings = await storage.updateSheetMappings(req.params.id, insertMappings);
    ApiResponse.success(res, { mappings: savedMappings });
  }));

  app.get("/api/sheets/:id/data", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const sheet = await storage.getGoogleSheet(req.params.id);
    if (!sheet || sheet.userId !== req.user!.id) {
      return ApiResponse.notFoundError(res, "Sheet not found");
    }
    const data = await storage.getSheetData(req.params.id);
    ApiResponse.success(res, { data });
  }));

  app.post("/api/sheets/:id/sync", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const sheet = await storage.getGoogleSheet(req.params.id);
    if (!sheet || sheet.userId !== req.user!.id) {
      return ApiResponse.notFoundError(res, "Sheet not found");
    }

    try {
      const accessToken = await GoogleOAuthService.ensureValidAccessToken(req.user!);

      const sheetData = await GoogleSheetsService.getSheetData(sheet.sheetId, accessToken, sheet.sheetName || undefined);
      const dataRows = sheetData.map((row, index) => ({
        sheetId: req.params.id,
        rowIndex: index,
        data: row,
      }));

      await storage.updateSheetData(req.params.id, dataRows);
      
      await storage.updateGoogleSheet(req.params.id, { lastSyncAt: new Date() });

      ApiResponse.success(res, { data: sheetData, syncedAt: new Date() });
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        return res.status(401).json({ message: error.message, code: error.code });
      }
      if (error instanceof Error) {
        return ApiResponse.error(res, error.message);
      }
      throw error;
    }
  }));

  app.post("/api/sheets/:id/push", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const sheet = await storage.getGoogleSheet(req.params.id);
    if (!sheet || sheet.userId !== req.user!.id) {
      return ApiResponse.notFoundError(res, "Sheet not found");
    }

    try {
      const accessToken = await GoogleOAuthService.ensureValidAccessToken(req.user!);

      // Type validation: ensure data is an array if provided
      if (req.body.data !== undefined && !Array.isArray(req.body.data)) {
        return ApiResponse.error(res, "data must be an array", 400);
      }

      // Use data from request body if provided, otherwise fall back to database
      let dataToPush = req.body.data;
      if (!dataToPush || dataToPush.length === 0) {
        dataToPush = await storage.getSheetData(req.params.id);
      }
      
      if (dataToPush.length === 0) {
        return ApiResponse.error(res, "No data to push");
      }

      // Check if we're doing selective update (rows have _rowIndex)
      const isSelectiveUpdate = Array.isArray(req.body.data) && req.body.data.some((row: any) => row._rowIndex !== undefined);
      
      if (isSelectiveUpdate) {
        // Selective update: only push changed rows to specific positions
        await GoogleSheetsService.updateSelectiveRows(sheet.sheetId, accessToken, dataToPush, sheet.sheetName || undefined);
        
        // Update local storage with selective rows
        const dataRows = req.body.data.map((row: any) => {
          const { _rowIndex, ...rowData } = row; // Remove _rowIndex from actual data
          return {
            sheetId: req.params.id,
            rowIndex: parseInt(_rowIndex, 10),
            data: rowData,
          };
        });
        await storage.updateSelectiveRows(req.params.id, dataRows);
      } else {
        // Full update: push all data
        await GoogleSheetsService.updateSheetData(sheet.sheetId, accessToken, dataToPush, sheet.sheetName || undefined);
        
        // If we received data in the request, also update our local storage
        if (Array.isArray(req.body.data) && req.body.data.length > 0) {
          const dataRows = req.body.data.map((row: any, index: number) => ({
            sheetId: req.params.id,
            rowIndex: index,
            data: row,
          }));
          await storage.updateSheetData(req.params.id, dataRows);
        }
      }
      
      // Update the last sync timestamp
      await storage.updateGoogleSheet(req.params.id, { lastSyncAt: new Date() });

      // AUTO-SYNC: Check for decommissioned and missing items
      if (Array.isArray(req.body.data) && req.body.data.length > 0) {
        console.log('🔍 Checking for decommissioned and missing items in request data...');
        console.log('Request data rows:', req.body.data.length);
        
        const syncService = new SyncService();
        
        // STEP 1: Collect all decommissioned items and categorize them
        const decommissionedItems: Array<{
          queueId: string;
          rowData: any;
          rowIndex: number;
          serialNumber: string;
          assetTag: string;
          isLaptop: boolean;
          isDesktop: boolean;
        }> = [];
        
        // STEP 1b: Collect all missing items
        const missingItems: Array<{
          rowData: any;
          rowIndex: number;
          serialNumber: string;
          assetTag: string;
        }> = [];
        
        // STEP 1c: Collect all installed items
        const installedItems: Array<{
          rowData: any;
          rowIndex: number;
          serialNumber: string;
          assetTag: string;
        }> = [];
        
        for (const row of req.body.data) {
          const { _rowIndex, ...rowData } = row;
          const status = rowData.Status || rowData.status || rowData.C || rowData.A || rowData.B;
          
          if (status && status.toLowerCase().includes('decommission')) {
            try {
              console.log(`🎯 DECOMMISSIONED ITEM DETECTED: Row ${_rowIndex}`);
              
              // Add to queue
              const queueId = await syncService.addToDecommissionQueue(
                req.user!.id,
                req.params.id,
                parseInt(_rowIndex?.toString() || '0', 10),
                rowData
              );
              
              // Categorize device type
              const allRowValues = Object.values(rowData).join(' ').toLowerCase();
              const isLaptop = allRowValues.includes('laptop') || 
                             allRowValues.includes('notebook') ||
                             allRowValues.includes('hp elitebook') ||
                             allRowValues.includes('dell latitude') ||
                             allRowValues.includes('thinkpad') ||
                             allRowValues.includes('macbook');
              
              const isDesktop = allRowValues.includes('desktop') || 
                              allRowValues.includes('pc') ||
                              allRowValues.includes('workstation') ||
                              allRowValues.includes('optiplex') ||
                              allRowValues.includes('prodesk');
              
              decommissionedItems.push({
                queueId,
                rowData,
                rowIndex: parseInt(_rowIndex?.toString() || '0', 10),
                serialNumber: rowData.F || rowData['Serial Number'] || rowData['Serial number'] || '',
                assetTag: rowData.I || rowData['Asset Tag'] || rowData['Asset tag'] || '',
                isLaptop,
                isDesktop,
              });
            } catch (error) {
              console.error('❌ Failed to queue decommissioned item:', error);
            }
          } else if (status && status.toLowerCase().includes('missing')) {
            try {
              console.log(`🔍 MISSING ITEM DETECTED: Row ${_rowIndex}`);
              
              missingItems.push({
                rowData,
                rowIndex: parseInt(_rowIndex?.toString() || '0', 10),
                serialNumber: rowData.F || rowData['Serial Number'] || rowData['Serial number'] || '',
                assetTag: rowData.I || rowData['Asset Tag'] || rowData['Asset tag'] || '',
              });
            } catch (error) {
              console.error('❌ Failed to collect missing item:', error);
            }
          } else if (status && status.toLowerCase().includes('installed')) {
            try {
              console.log(`✅ INSTALLED ITEM DETECTED: Row ${_rowIndex}`);
              
              installedItems.push({
                rowData,
                rowIndex: parseInt(_rowIndex?.toString() || '0', 10),
                serialNumber: rowData.F || rowData['Serial Number'] || rowData['Serial number'] || '',
                assetTag: rowData.I || rowData['Asset Tag'] || rowData['Asset tag'] || '',
              });
            } catch (error) {
              console.error('❌ Failed to collect installed item:', error);
            }
          }
        }
        
        // STEP 2: Batch sync all decommissioned items if any were found
        if (decommissionedItems.length > 0) {
          console.log(`⚡ BATCH SYNCING ${decommissionedItems.length} decommissioned items...`);
          
          try {
            await syncService.batchSyncDecommissionedItems(
              req.user!.id,
              req.params.id,
              decommissionedItems,
              req.user!.email
            );
            console.log(`✅ Batch sync completed for ${decommissionedItems.length} decommissioned items`);
          } catch (syncError) {
            console.error(`❌ Decommissioned batch sync failed:`, syncError);
          }
        }
        
        // STEP 3: Batch update descriptions for missing items
        if (missingItems.length > 0) {
          console.log(`📝 Batch updating ${missingItems.length} missing item descriptions...`);
          
          try {
            await syncService.batchUpdateMissingDescriptions(
              req.user!.id,
              req.params.id,
              missingItems
            );
            console.log(`✅ Batch description update completed for ${missingItems.length} missing items`);
          } catch (descError) {
            console.error(`❌ Missing description batch update failed:`, descError);
          }
        }
        
        // STEP 4: Batch update descriptions for installed items
        if (installedItems.length > 0) {
          console.log(`📝 Batch updating ${installedItems.length} installed item descriptions...`);
          
          try {
            await syncService.batchUpdateInstalledDescriptions(
              req.user!.id,
              req.params.id,
              installedItems
            );
            console.log(`✅ Batch description update completed for ${installedItems.length} installed items`);
          } catch (descError) {
            console.error(`❌ Installed description batch update failed:`, descError);
          }
        }
      }

      // STEP 5: Sync to main Branch Verified Inventory if this is a smaller "bit" sheet
      if (sheet.sheetName && sheet.sheetName !== 'Branch Verified Inventory' && Array.isArray(req.body.data) && req.body.data.length > 0) {
        console.log(`🔄 Detected smaller sheet "${sheet.sheetName}" - checking for Branch Verified Inventory sync...`);
        
        try {
          const result = await syncService.syncToMainBranchVerifiedInventory(
            req.user!.id,
            req.params.id,
            req.body.data
          );
          
          if (result.synced > 0) {
            console.log(`✅ Synced ${result.synced} items to Branch Verified Inventory`);
          }
          if (result.notFound > 0) {
            console.log(`⚠️ ${result.notFound} items not found in Branch Verified Inventory`);
          }
        } catch (syncError: any) {
          // Don't fail the main sync, just log the error
          if (syncError.message.includes('Branch Verified Inventory tab not found')) {
            console.warn(`⚠️ Branch Verified Inventory tab not found - skipping cross-tab sync`);
          } else {
            console.error(`❌ Failed to sync to Branch Verified Inventory:`, syncError);
          }
        }
      }

      ApiResponse.success(res, { message: "Data pushed to Google Sheets", pushedAt: new Date() });
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        return res.status(401).json({ message: error.message, code: error.code });
      }
      if (error instanceof Error) {
        return ApiResponse.error(res, error.message);
      }
      throw error;
    }
  }));

  // Highlight rows in Google Sheets
  app.post("/api/sheets/:id/highlight", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const sheet = await storage.getGoogleSheet(req.params.id);
    if (!sheet || sheet.userId !== req.user!.id) {
      return ApiResponse.notFoundError(res, "Sheet not found");
    }

    try {
      const { rowIndices, color } = req.body;
      
      // Type validation
      if (!Array.isArray(rowIndices)) {
        return ApiResponse.error(res, "rowIndices must be an array", 400);
      }
      
      if (!color || typeof color !== 'object' || typeof color.red !== 'number' || typeof color.green !== 'number' || typeof color.blue !== 'number') {
        return ApiResponse.error(res, "color is required and must be an object with red, green, blue properties", 400);
      }

      const accessToken = await GoogleOAuthService.ensureValidAccessToken(req.user!);

      await GoogleSheetsService.highlightRows(
        sheet.sheetId,
        accessToken,
        rowIndices,
        color,
        sheet.sheetName || undefined
      );

      ApiResponse.success(res, { message: `Highlighted ${rowIndices.length} rows successfully` });
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        return res.status(401).json({ message: error.message, code: error.code });
      }
      if (error instanceof Error) {
        return ApiResponse.error(res, error.message);
      }
      throw error;
    }
  }));

  // Cross-tab sync endpoints
  const syncService = new SyncService();

  // Add item to decommission sync queue
  app.post("/api/sync/add-to-queue", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sourceSheetId, rowIndex, rowData } = req.body;
      
      // Type validation
      if (!sourceSheetId || typeof sourceSheetId !== 'string') {
        return ApiResponse.error(res, "sourceSheetId is required and must be a string", 400);
      }
      
      if (rowIndex === undefined || (typeof rowIndex !== 'number' && typeof rowIndex !== 'string')) {
        return ApiResponse.error(res, "rowIndex is required", 400);
      }
      
      if (!rowData || typeof rowData !== 'object') {
        return ApiResponse.error(res, "rowData is required and must be an object", 400);
      }

      // Convert rowIndex to number if it's a string
      const rowIndexNum = typeof rowIndex === 'string' ? parseInt(rowIndex, 10) : rowIndex;
      
      if (isNaN(rowIndexNum)) {
        return ApiResponse.error(res, "rowIndex must be a valid number", 400);
      }

      const queueId = await syncService.addToDecommissionQueue(
        req.user!.id,
        sourceSheetId,
        rowIndexNum,
        rowData
      );

      ApiResponse.success(res, { queueId, message: "Item added to sync queue" });
    } catch (error) {
      console.error("Error adding to sync queue:", error);
      ApiResponse.internalServerError(res, error instanceof Error ? error.message : "Failed to add to sync queue");
    }
  }));

  // Get pending sync items for user
  app.get("/api/sync/queue", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pendingItems = await syncService.getPendingSyncItems(req.user!.id);
      ApiResponse.success(res, { items: pendingItems });
    } catch (error) {
      console.error("Error getting sync queue:", error);
      ApiResponse.internalServerError(res, "Failed to get sync queue");
    }
  }));

  // Sync to Disposal Inventory
  app.post("/api/sync/disposal-inventory", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { queueId, targetSheetId } = req.body;
      
      // Type validation
      if (!queueId || typeof queueId !== 'string') {
        return ApiResponse.error(res, "queueId is required and must be a string", 400);
      }
      
      if (!targetSheetId || typeof targetSheetId !== 'string') {
        return ApiResponse.error(res, "targetSheetId is required and must be a string", 400);
      }

      const success = await syncService.syncToDisposalInventory(
        req.user!.id,
        queueId,
        targetSheetId
      );

      if (success) {
        ApiResponse.success(res, { message: "Successfully synced to Disposal Inventory" });
      } else {
        ApiResponse.internalServerError(res, "Failed to sync to Disposal Inventory");
      }
    } catch (error) {
      console.error("Error syncing to disposal inventory:", error);
      ApiResponse.internalServerError(res, error instanceof Error ? error.message : "Sync failed");
    }
  }));

  // Sync to Absolute Inventory
  app.post("/api/sync/absolute-inventory", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { queueId, targetSheetId } = req.body;
      
      // Type validation
      if (!queueId || typeof queueId !== 'string') {
        return ApiResponse.error(res, "queueId is required and must be a string", 400);
      }
      
      if (!targetSheetId || typeof targetSheetId !== 'string') {
        return ApiResponse.error(res, "targetSheetId is required and must be a string", 400);
      }

      const success = await syncService.syncToAbsoluteInventory(
        req.user!.id,
        queueId,
        targetSheetId
      );

      if (success) {
        ApiResponse.success(res, { message: "Successfully synced to Absolute Inventory" });
      } else {
        ApiResponse.internalServerError(res, "Failed to sync to Absolute Inventory");
      }
    } catch (error) {
      console.error("Error syncing to absolute inventory:", error);
      ApiResponse.internalServerError(res, error instanceof Error ? error.message : "Sync failed");
    }
  }));

  // Get sync history for a queue item
  app.get("/api/sync/history/:queueId", requireAuth, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { queueId } = req.params;
      const history = await syncService.getSyncHistory(queueId);
      ApiResponse.success(res, { history });
    } catch (error) {
      console.error("Error getting sync history:", error);
      ApiResponse.internalServerError(res, "Failed to get sync history");
    }
  }));

  const httpServer = createServer(app);
  return httpServer;
}
