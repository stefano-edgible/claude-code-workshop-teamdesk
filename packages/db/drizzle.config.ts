import { defineConfig } from "drizzle-kit";

// `bun run generate` writes plain SQL migrations here. They are applied when
// the app opens the database (`openDatabase` in src/sqlite.ts), not by
// drizzle-kit, so this config needs no database credentials.
export default defineConfig({
  dialect: "sqlite",
  out: "./migrations",
  schema: "./src/schema.ts",
});
