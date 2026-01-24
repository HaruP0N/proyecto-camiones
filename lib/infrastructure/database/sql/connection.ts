// lib/azure-sql.ts
import sql from "mssql";
export { sql };

declare global {
  // eslint-disable-next-line no-var
  var __mssqlPoolPromise: Promise<sql.ConnectionPool> | undefined;
}

export function getPool() {
  if (!global.__mssqlPoolPromise) {
    const server = (process.env.AZURE_SQL_SERVER || "").trim();
    const database = (process.env.AZURE_SQL_DATABASE || "").trim();
    const user = (process.env.AZURE_SQL_USER || "").trim();
    const password = process.env.AZURE_SQL_PASSWORD || "";

    if (!server || !database || !user || !password) {
      throw new Error(
        "Faltan envs: AZURE_SQL_SERVER / AZURE_SQL_DATABASE / AZURE_SQL_USER / AZURE_SQL_PASSWORD"
      );
    }

    const isProd = process.env.NODE_ENV === "production";

    global.__mssqlPoolPromise = new sql.ConnectionPool({
      user,
      password,
      server,
      database,
      port: 1433,
      options: {
        encrypt: true,
        // ✅ en PROD false, en DEV true para evitar problemas de TLS local
        trustServerCertificate: !isProd,
      },
      connectionTimeout: 60000,
      requestTimeout: 60000,
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    }).connect();
  }

  return global.__mssqlPoolPromise;
}