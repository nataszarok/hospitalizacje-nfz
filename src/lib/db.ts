import "server-only";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as { healthDashboardPool?: Pool };

export function getPool(): Pool {
  if (globalForDb.healthDashboardPool) return globalForDb.healthDashboardPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to .env.local and set the Supabase PostgreSQL URL.");
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
    ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });

  if (process.env.NODE_ENV !== "production") globalForDb.healthDashboardPool = pool;
  return pool;
}
