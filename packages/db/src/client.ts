import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./pg-schema.js";
import { sql } from "drizzle-orm";

export type Db = ReturnType<typeof createDb>;

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Postgres mode");
  }
  const client = postgres(connectionString, { max: 10 });
  return drizzle(client, { schema });
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function checkDatabaseReadiness(db: Db | null): Promise<boolean> {
  if (!db) return false;
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
