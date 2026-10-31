import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { config } from "../config.js";
import path from "node:path";
import fs from "node:fs";

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
}

export interface DatabaseConnection {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;
  exec: (sql: string) => Promise<void>;
  withTransaction: <T = Record<string, unknown>>(fn: (client: DbClient) => Promise<T>) => Promise<T>;
  mode: "pg" | "pglite";
}

let pgPool: pg.Pool | null = null;
let pgliteInstance: PGlite | null = null;
let mode: "pg" | "pglite" = "pglite";

export async function getDb(): Promise<DatabaseConnection> {
  if (config.DATABASE_URL && config.DATABASE_URL.trim() !== "") {
    if (!pgPool) {
      pgPool = new pg.Pool({
        connectionString: config.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000,
      });

      try {
        const client = await pgPool.connect();
        client.release();
        mode = "pg";
      } catch {
        console.warn(
          "⚠️ PostgreSQL via DATABASE_URL not reachable. Falling back to embedded PGlite instance."
        );
        pgPool = null;
      }
    }
  }

  if (!pgPool) {
    if (!pgliteInstance) {
      const dataDir = path.resolve(process.cwd(), config.PGLITE_DATA_DIR);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      pgliteInstance = new PGlite(dataDir);
      mode = "pglite";
    }
  }

  const query = async <T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> => {
    if (pgPool) {
      const res = await pgPool.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
    } else if (pgliteInstance) {
      const res = await pgliteInstance.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rows.length };
    }
    throw new Error("No database instance initialized");
  };

  const exec = async (sql: string): Promise<void> => {
    if (pgPool) {
      await pgPool.query(sql);
    } else if (pgliteInstance) {
      await pgliteInstance.exec(sql);
    }
  };

  const withTransaction = async <T = Record<string, unknown>>(
    fn: (client: DbClient) => Promise<T>
  ): Promise<T> => {
    if (pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query("BEGIN");
        const res = await fn({
          query: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
            const r = await client.query(sql, params);
            return { rows: r.rows as R[], rowCount: r.rowCount ?? r.rows.length };
          },
          exec: async (sql: string) => {
            await client.query(sql);
          },
        });
        await client.query("COMMIT");
        return res;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else if (pgliteInstance) {
      return await pgliteInstance.transaction(async (tx) => {
        return await fn({
          query: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
            const r = await tx.query(sql, params);
            return { rows: r.rows as R[], rowCount: r.rows.length };
          },
          exec: async (sql: string) => {
            await tx.exec(sql);
          },
        });
      });
    }
    throw new Error("No database instance initialized");
  };

  return { query, exec, withTransaction, mode };
}
