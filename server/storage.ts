import { users, sessions, googleSheets, sheetMappings, sheetData, type User, type InsertUser, type Session, type InsertSession, type GoogleSheet, type InsertGoogleSheet, type SheetMapping, type InsertSheetMapping, type SheetData, type InsertSheetData } from "@shared/schema";
import { db } from "./db";
import { eq, and, gt, lt, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  getSessionWithUser(id: string): Promise<(Session & { user: User }) | undefined>;
  deleteSession(id: string): Promise<void>;
  deleteAllUserSessions(userId: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
  createGoogleSheet(sheet: InsertGoogleSheet): Promise<GoogleSheet>;
  getUserGoogleSheets(userId: string): Promise<GoogleSheet[]>;
  getGoogleSheet(id: string): Promise<GoogleSheet | undefined>;
  updateGoogleSheet(id: string, updates: Partial<GoogleSheet>): Promise<GoogleSheet | undefined>;
  deleteGoogleSheet(id: string): Promise<void>;
  createSheetMapping(mapping: InsertSheetMapping): Promise<SheetMapping>;
  getSheetMappings(sheetId: string): Promise<SheetMapping[]>;
  deleteSheetMappings(sheetId: string): Promise<void>;
  updateSheetMappings(sheetId: string, mappings: InsertSheetMapping[]): Promise<SheetMapping[]>;
  createSheetData(data: InsertSheetData): Promise<SheetData>;
  getSheetData(sheetId: string): Promise<SheetData[]>;
  updateSheetData(sheetId: string, data: InsertSheetData[]): Promise<void>;
  updateSelectiveRows(sheetId: string, dataRows: InsertSheetData[]): Promise<void>;
  deleteSheetData(sheetId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db
      .insert(sessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())));
    return session || undefined;
  }

  async getSessionWithUser(id: string): Promise<(Session & { user: User }) | undefined> {
    const [result] = await db
      .select()
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())));
    
    if (!result) return undefined;
    
    return {
      ...result.sessions,
      user: result.users,
    };
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }

  async createGoogleSheet(insertSheet: InsertGoogleSheet): Promise<GoogleSheet> {
    const [sheet] = await db
      .insert(googleSheets)
      .values(insertSheet)
      .returning();
    return sheet;
  }

  async getUserGoogleSheets(userId: string): Promise<GoogleSheet[]> {
    return await db
      .select()
      .from(googleSheets)
      .where(eq(googleSheets.userId, userId))
      .orderBy(desc(googleSheets.createdAt));
  }

  async getGoogleSheet(id: string): Promise<GoogleSheet | undefined> {
    const [sheet] = await db
      .select()
      .from(googleSheets)
      .where(eq(googleSheets.id, id));
    return sheet || undefined;
  }

  async updateGoogleSheet(id: string, updates: Partial<GoogleSheet>): Promise<GoogleSheet | undefined> {
    const [sheet] = await db
      .update(googleSheets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(googleSheets.id, id))
      .returning();
    return sheet || undefined;
  }

  async deleteGoogleSheet(id: string): Promise<void> {
    await db.delete(googleSheets).where(eq(googleSheets.id, id));
  }

  async createSheetMapping(insertMapping: InsertSheetMapping): Promise<SheetMapping> {
    const [mapping] = await db
      .insert(sheetMappings)
      .values(insertMapping)
      .returning();
    return mapping;
  }

  async getSheetMappings(sheetId: string): Promise<SheetMapping[]> {
    return await db
      .select()
      .from(sheetMappings)
      .where(eq(sheetMappings.sheetId, sheetId))
      .orderBy(sheetMappings.order);
  }

  async deleteSheetMappings(sheetId: string): Promise<void> {
    await db.delete(sheetMappings).where(eq(sheetMappings.sheetId, sheetId));
  }

  async updateSheetMappings(sheetId: string, mappings: InsertSheetMapping[]): Promise<SheetMapping[]> {
    await this.deleteSheetMappings(sheetId);
    const createdMappings = [];
    for (const mapping of mappings) {
      const created = await this.createSheetMapping(mapping);
      createdMappings.push(created);
    }
    return createdMappings;
  }

  async createSheetData(insertData: InsertSheetData): Promise<SheetData> {
    const [data] = await db
      .insert(sheetData)
      .values(insertData)
      .returning();
    return data;
  }

  async getSheetData(sheetId: string): Promise<any[]> {
    const records = await db
      .select()
      .from(sheetData)
      .where(eq(sheetData.sheetId, sheetId))
      .orderBy(sheetData.rowIndex);
    
    return records.map(record => record.data);
  }

  async updateSheetData(sheetId: string, dataRows: InsertSheetData[]): Promise<void> {
    await this.deleteSheetData(sheetId);
    for (const row of dataRows) {
      await this.createSheetData(row);
    }
  }

  async updateSelectiveRows(sheetId: string, dataRows: InsertSheetData[]): Promise<void> {
    // Update specific rows instead of clearing all data first
    // This is more efficient for selective updates
    await db.transaction(async (tx) => {
      for (const row of dataRows) {
        // Delete existing row at this position
        await tx.delete(sheetData)
          .where(and(
            eq(sheetData.sheetId, sheetId),
            eq(sheetData.rowIndex, row.rowIndex)
          ));
        
        // Insert the updated row
        await tx.insert(sheetData).values(row);
      }
    });
  }

  async deleteSheetData(sheetId: string): Promise<void> {
    await db.delete(sheetData).where(eq(sheetData.sheetId, sheetId));
  }
}

export const storage = new DatabaseStorage();
