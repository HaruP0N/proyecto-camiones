import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { requireAdmin } from "@/lib/shared/security/staff-auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

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

function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const pool = await getPool();

    // ✅ incluir activo (para dashboard) y NO filtrar solo activos
    const r = await pool.request().query(`
      SELECT id, nombre, email, rol, activo
      FROM dbo.usuarios
      WHERE LOWER(LTRIM(RTRIM(rol))) = 'inspector'
      ORDER BY ISNULL(activo, 0) DESC, nombre ASC
    `);

    const data = r.recordset.map((x: any) => ({
      id: Number(x.id),
      nombre: x.nombre ?? "",
      email: x.email ?? "",
      rol: (x.rol ?? "inspector").toString(),
      activo: !!x.activo,
    }));

    return NextResponse.json(
      {
        ok: true,
        // ✅ formato usado por Agenda (dropdown)
        inspectores: data.map(({ id, nombre, email }) => ({ id, nombre, email })),
        // ✅ formato dashboard (incluye activo)
        data,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/admin/inspectores error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    }

    const nombre = (body as any).nombre?.toString().trim();
    const emailRaw = (body as any).email?.toString();
    const passwordInicial = (body as any).passwordInicial?.toString();

    if (!nombre || !emailRaw || !passwordInicial) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos: nombre, email, passwordInicial" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(emailRaw);

    const pool = await getPool();

    // Evitar duplicado email
    const exists = await pool.request().input("email", sql.VarChar(200), email).query(`
      SELECT TOP 1 id
      FROM dbo.usuarios
      WHERE LOWER(LTRIM(RTRIM(email))) = @email
    `);

    if (exists.recordset.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Ya existe un usuario con ese email." },
        { status: 409 }
      );
    }

    const hash = await bcrypt.hash(passwordInicial, 10);

    const ins = await pool
      .request()
      .input("nombre", sql.NVarChar(200), nombre)
      .input("email", sql.VarChar(200), email)
      .input("password_hash", sql.VarChar(255), hash)
      .input("rol", sql.VarChar(50), "inspector")
      .input("activo", sql.Bit, 1)
      .query(`
        INSERT INTO dbo.usuarios (nombre, email, password_hash, rol, activo)
        OUTPUT INSERTED.id
        VALUES (@nombre, @email, @password_hash, @rol, @activo)
      `);

    const newId = ins.recordset?.[0]?.id ? Number(ins.recordset[0].id) : null;

    return NextResponse.json({ ok: true, id: newId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/inspectores error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
