import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  picture: text("picture"),
  googleId: text("google_id").unique(),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiresAt: timestamp("google_token_expires_at"),
  role: text("role").default("user").notNull(),
  technicianEmail: text("technician_email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSignIn: timestamp("last_sign_in"),
  isVerified: boolean("is_verified").default(false).notNull(),
});

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const googleSheets = pgTable("google_sheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sheetId: text("sheet_id").notNull(),
  sheetName: text("sheet_name"),
  title: text("title"),
  url: text("url"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sheetMappings = pgTable("sheet_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sheetId: varchar("sheet_id").notNull().references(() => googleSheets.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(),
  columnLetter: text("column_letter").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sheetData = pgTable("sheet_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sheetId: varchar("sheet_id").notNull().references(() => googleSheets.id, { onDelete: "cascade" }),
  rowIndex: integer("row_index").notNull(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cross-tab sync queue to track items that need syncing
export const syncQueue = pgTable("sync_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceSheetId: varchar("source_sheet_id").notNull().references(() => googleSheets.id, { onDelete: "cascade" }),
  sourceRowIndex: integer("source_row_index").notNull(),
  itemType: text("item_type").notNull(), // "decommission", etc.
  itemData: jsonb("item_data").notNull(), // The row data that needs syncing
  status: text("status").default("pending").notNull(), // "pending", "synced", "failed"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

// Sync history to track successful cross-tab updates
export const syncHistory = pgTable("sync_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queueId: varchar("queue_id").notNull().references(() => syncQueue.id, { onDelete: "cascade" }),
  targetSheetId: varchar("target_sheet_id").notNull().references(() => googleSheets.id, { onDelete: "cascade" }),
  targetRowIndex: integer("target_row_index"),
  syncedFields: jsonb("synced_fields").notNull(), // Which fields were synced
  syncType: text("sync_type").notNull(), // "disposal_inventory", "absolute_inventory"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  googleSheets: many(googleSheets),
  syncQueue: many(syncQueue),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const googleSheetsRelations = relations(googleSheets, ({ one, many }) => ({
  user: one(users, {
    fields: [googleSheets.userId],
    references: [users.id],
  }),
  mappings: many(sheetMappings),
  data: many(sheetData),
}));

export const sheetMappingsRelations = relations(sheetMappings, ({ one }) => ({
  sheet: one(googleSheets, {
    fields: [sheetMappings.sheetId],
    references: [googleSheets.id],
  }),
}));

export const sheetDataRelations = relations(sheetData, ({ one }) => ({
  sheet: one(googleSheets, {
    fields: [sheetData.sheetId],
    references: [googleSheets.id],
  }),
}));

export const syncQueueRelations = relations(syncQueue, ({ one, many }) => ({
  user: one(users, {
    fields: [syncQueue.userId],
    references: [users.id],
  }),
  sourceSheet: one(googleSheets, {
    fields: [syncQueue.sourceSheetId],
    references: [googleSheets.id],
  }),
  history: many(syncHistory),
}));

export const syncHistoryRelations = relations(syncHistory, ({ one }) => ({
  queue: one(syncQueue, {
    fields: [syncHistory.queueId],
    references: [syncQueue.id],
  }),
  targetSheet: one(googleSheets, {
    fields: [syncHistory.targetSheetId],
    references: [googleSheets.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export const insertGoogleSheetSchema = createInsertSchema(googleSheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSheetMappingSchema = createInsertSchema(sheetMappings).omit({
  id: true,
  createdAt: true,
});

export const insertSheetDataSchema = createInsertSchema(sheetData).omit({
  id: true,
  updatedAt: true,
});

export const insertSyncQueueSchema = createInsertSchema(syncQueue).omit({
  id: true,
  createdAt: true,
});

export const insertSyncHistorySchema = createInsertSchema(syncHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type GoogleSheet = typeof googleSheets.$inferSelect;
export type InsertGoogleSheet = z.infer<typeof insertGoogleSheetSchema>;
export type SheetMapping = typeof sheetMappings.$inferSelect;
export type InsertSheetMapping = z.infer<typeof insertSheetMappingSchema>;
export type SheetData = typeof sheetData.$inferSelect;
export type InsertSheetData = z.infer<typeof insertSheetDataSchema>;
export type SyncQueue = typeof syncQueue.$inferSelect;
export type InsertSyncQueue = z.infer<typeof insertSyncQueueSchema>;
export type SyncHistory = typeof syncHistory.$inferSelect;
export type InsertSyncHistory = z.infer<typeof insertSyncHistorySchema>;

export const FIELD_TYPES = {
  MANAGER_SIGNOFF: "Manager sign-off",
  TECHNICIAN: "Technician",
} as const;

export type FieldType = typeof FIELD_TYPES[keyof typeof FIELD_TYPES];

export const COLUMN_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
] as const;

export type ColumnLetter = typeof COLUMN_LETTERS[number];
