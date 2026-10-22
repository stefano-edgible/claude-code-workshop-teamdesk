// Creates the database file if needed and applies the migrations.
//   DB_PATH=./data/teamdesk.db bun run packages/db/scripts/migrate.ts
import { openDatabase } from "../src/sqlite.ts";

const path = process.env.DB_PATH ?? "./data/teamdesk.db";
openDatabase(path);
console.log(`migrated ${path}`);
