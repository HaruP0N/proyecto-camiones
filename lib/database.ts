import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { bindParameters } from "./database/parameters";

declare global {
  // eslint-disable-next-line no-var
  var __postgresPool: Pool | undefined;
}

export function connectionConfig() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("Falta configurar DATABASE_URL (PostgreSQL de Supabase)");
  const url = new URL(connectionString);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // The URL must not override certificate verification through pg's SSL parameters.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: local ? false as const : {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA.replace(/\\n/g, "\n") } : {}),
    },
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 60_000,
    allowExitOnIdle: true,
  };
}

type Executor = { query(text: string, values: unknown[]): Promise<QueryResult> };

// Keep the existing request/result shape while executing only native PostgreSQL.
export class Request {
  private parameters = new Map<string, unknown>();
  constructor(private executor: Executor) {}

  input(name: string, value: unknown) {
    this.parameters.set(name, value ?? null);
    return this;
  }

  async query<T extends QueryResultRow = QueryResultRow>(statement: string) {
    const { text, values } = bindParameters(statement, this.parameters);
    const result = await this.executor.query(text, values);
    return { recordset: result.rows as T[], rowsAffected: [result.rowCount ?? 0] };
  }
}

export class Database {
  constructor(readonly pool: Pool) {}
  request() { return new Request(this.pool); }
}

export class Transaction {
  private client?: PoolClient;
  constructor(private database: Database) {}

  async begin() {
    if (this.client) throw new Error("La transacción ya está activa");
    const client = await this.database.pool.connect();
    try {
      await client.query("BEGIN");
      this.client = client;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async query(text: string, values: unknown[]) {
    if (!this.client) throw new Error("La transacción no está activa");
    return this.client.query(text, values);
  }

  request() { return new Request(this); }

  async commit() { await this.finish("COMMIT"); }
  async rollback() { await this.finish("ROLLBACK"); }

  private async finish(command: "COMMIT" | "ROLLBACK") {
    if (!this.client) return;
    const client = this.client;
    this.client = undefined;
    try { await client.query(command); }
    finally { client.release(); }
  }
}

export async function getPool() {
  if (!global.__postgresPool) {
    const pool = new Pool(connectionConfig());
    // Avoid unhandled idle connection errors, without logging credentials.
    pool.on("error", () => console.error("Se perdió una conexión inactiva a PostgreSQL"));
    global.__postgresPool = pool;
  }
  return new Database(global.__postgresPool);
}
