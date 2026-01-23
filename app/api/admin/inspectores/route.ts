import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { requireAdmin } from "@/lib/staff-auth";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      server: process.env.AZURE_SQL_SERVER!,
      database: process.env.AZURE_SQL_DATABASE!,
      options: { encrypt: true, trustServerCertificate: false },
      connectionTimeout: 30000,
      requestTimeout: 30000,
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    }).connect();
  }
  return poolPromise;
}

export async function GET(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const pool = await getPool();

    // ✅ Robustez: trims + lowercase (evita problemas por espacios o mayúsculas)
    const r = await pool.request().query(`
      SELECT id, nombre, email
      FROM dbo.usuarios
      WHERE ISNULL(activo, 0) = 1
        AND LOWER(LTRIM(RTRIM(rol))) = 'inspector'
      ORDER BY nombre ASC
    `);

    const inspectores = r.recordset.map((x: any) => ({
      id: Number(x.id),
      nombre: x.nombre ?? null,
      email: x.email ?? null,
    }));

    return NextResponse.json({ ok: true, inspectores }, { status: 200 });
  } catch (err) {
    console.error("GET /api/admin/inspectores error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
