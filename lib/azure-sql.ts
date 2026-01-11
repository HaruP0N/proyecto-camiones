import sql from "mssql"

// Configuración de conexión a Azure SQL
const config: sql.config = {
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  server: process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  options: {
    encrypt: true, // Azure SQL requiere conexiones encriptadas
    trustServerCertificate: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

let pool: sql.ConnectionPool | null = null

export async function getPool() {
  if (!pool) {
    pool = await sql.connect(config)
  }
  return pool
}

export async function closePool() {
  if (pool) {
    await pool.close()
    pool = null
  }
}

export { sql }
