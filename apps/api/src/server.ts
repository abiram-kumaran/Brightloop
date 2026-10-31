import { buildApp } from "./app.js";
import { config } from "./config.js";
import { getDb } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";

async function main() {
  // Ensure database migrations are applied at launch
  try {
    await runMigrations();
  } catch (err) {
    console.error("[server] Failed to run database migrations on boot:", err);
  }

  const db = await getDb();
  console.log(`[server] Connected to database in ${db.mode.toUpperCase()} mode.`);

  const app = buildApp();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`🚀 Brightloop API server listening on http://${config.HOST}:${config.PORT}`);
    console.log(`📖 OpenAPI documentation available at http://localhost:${config.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
