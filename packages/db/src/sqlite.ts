// The app's database: one SQLite file, opened with bun:sqlite. Not for the
// browser (see `shared.ts`); the tests use `testing.ts` for an in-memory one.
import { Database as Sqlite } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { Database } from "./schema.ts";

// Relative to this file, so the migrations are found from any working
// directory. The built server is one bundle in another folder, so it sets
// MIGRATIONS_DIR instead.
const migrationsFolder = () =>
  process.env.MIGRATIONS_DIR ?? resolve(import.meta.dir, "../migrations");

/**
 * Opens (and creates) the database file at `path`, turns on WAL and foreign
 * keys, and applies any migrations it has not seen yet.
 */
export function openDatabase(path: string): Database {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new Sqlite(path, { create: true });
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run("PRAGMA busy_timeout = 5000");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: migrationsFolder() });
  return db;
}

/** Runs a SQL file (such as `seed.sql`) against the database at `path`. */
export function runSqlFile(path: string, sql: string): void {
  const sqlite = new Sqlite(path);
  try {
    sqlite.exec(sql);
  } finally {
    sqlite.close();
  }
}
