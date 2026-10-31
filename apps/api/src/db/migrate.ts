import fs from "node:fs";
import path from "node:path";
import { getDb, DatabaseConnection } from "./pool.js";

export async function runMigrations(): Promise<void> {
  const db = await getDb();
  console.log(`[migrate] Running database migrations using ${db.mode.toUpperCase()} engine...`);

  // Ensure schema_migrations table exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const migrationsDir = path.resolve(process.cwd(), "db/migrations");
  if (!fs.existsSync(migrationsDir)) {
    const fallbackDir = path.resolve(process.cwd(), "../../db/migrations");
    if (fs.existsSync(fallbackDir)) {
      await applyMigrationsFromDir(db, fallbackDir);
      return;
    }
  }

  await applyMigrationsFromDir(db, migrationsDir);
}

async function applyMigrationsFromDir(
  db: DatabaseConnection,
  dir: string
): Promise<void> {
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const existing = await db.query(
      "SELECT id FROM schema_migrations WHERE migration_name = $1",
      [file]
    );

    if (existing.rows.length > 0) {
      console.log(`[migrate] Already applied: ${file}`);
      continue;
    }

    console.log(`[migrate] Applying: ${file}...`);
    let sql = fs.readFileSync(path.join(dir, file), "utf-8");

    if (db.mode === "pglite") {
      sql = sql.replace(
        "CREATE EXTENSION IF NOT EXISTS citext;",
        "CREATE DOMAIN citext AS text;"
      );
    }

    await db.withTransaction(async (client) => {
      await client.exec(sql);
      await client.query(
        "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
        [file]
      );
    });

    console.log(`[migrate] Successfully applied: ${file}`);
  }

  console.log("[migrate] All migrations applied successfully!");
}

if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[migrate] Error running migrations:", err);
      process.exit(1);
    });
}
