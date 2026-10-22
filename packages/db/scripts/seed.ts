// Loads the demo team and rooms (seed.sql) into the database. Safe to repeat.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase, runSqlFile } from "../src/sqlite.ts";

const path = process.env.DB_PATH ?? "./data/teamdesk.db";
openDatabase(path);
runSqlFile(path, readFileSync(resolve(import.meta.dir, "../seed.sql"), "utf8"));
console.log(`seeded ${path}`);
