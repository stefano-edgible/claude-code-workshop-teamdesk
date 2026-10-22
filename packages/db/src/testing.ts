// Test helper, not for app code: imports bun:sqlite, which a browser lacks.
import { Database as Sqlite } from "bun:sqlite";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { Database } from "./schema.ts";

// Relative to this file, not the working directory, so `bun test` works from
// the repo root and from each package.
const MIGRATIONS_FOLDER = resolve(import.meta.dir, "../migrations");

/** A fresh in-memory database with every migration applied. */
export function createTestDatabase(): Database {
  const db = drizzle(new Sqlite(":memory:"));
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}
