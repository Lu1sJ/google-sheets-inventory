import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? true : false,
  // Optimize for scale-to-zero: close idle connections quickly
  idleTimeoutMillis: 30000, // Close connections after 30s of inactivity
  max: 2 // Limit pool size to reduce resource usage
});
export const db = drizzle(pool, { schema });