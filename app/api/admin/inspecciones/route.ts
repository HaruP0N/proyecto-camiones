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

function isValidIsoDate(s: unknown) {
  if (typeof s !== "string") return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
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

    const camionId = body.camionId;
    const fechaIso = body.fechaProgramada;
    const observaciones =
      typeof body.observaciones === "string" ? body.observaciones.trim() : null;

    if (!Number.isInteger(camionId) || camionId <= 0) {
      return NextResponse.json({ ok: false, error: "camionId inválido" }, { status: 400 });
    }
    if (!isValidIsoDate(fechaIso)) {
      return NextResponse.json({ ok: false, error: "fechaProgramada inválida" }, { status: 400 });
    }

    const fecha = new Date(fechaIso);
    if (fecha.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ ok: false, error: "La fecha debe ser futura" }, { status: 400 });
    }

    const pool = await getPool();

    // Verificar camión
    const cam = await pool.request()
      .input("camionId", sql.Int, camionId)
      .query(`SELECT TOP 1 id FROM dbo.camiones WHERE id = @camionId`);

    if (cam.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Camión no existe" }, { status: 404 });
    }

    // Evitar doble agenda futura
    const exists = await pool.request()
      .input("camionId", sql.Int, camionId)
      .query(`
        SELECT TOP 1 id
        FROM dbo.inspecciones
        WHERE camion_id = @camionId
          AND estado = 'PROGRAMADA'
          AND fecha_programada >= SYSUTCDATETIME()
      `);

    if (exists.recordset.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Este camión ya tiene una inspección programada" },
        { status: 409 }
      );
    }

    // ✅ Defaults para columnas NOT NULL
    const ESTADO_DEFAULT = "PROGRAMADA";
    const RESULTADO_DEFAULT = "observado";

    const ins = await pool.request()
      .input("camionId", sql.Int, camionId)
      .input("fecha", sql.DateTime2, fecha)
      .input("estado", sql.VarChar(20), ESTADO_DEFAULT)
      .input("resultado", sql.VarChar(20), RESULTADO_DEFAULT)
      .input("obs", sql.NVarChar(sql.MAX), observaciones)
      .query(`
        INSERT INTO dbo.inspecciones
          (camion_id, inspector_id, fecha_inspeccion, fecha_programada, estado, resultado_general, observaciones_generales)
        OUTPUT INSERTED.id
        VALUES
          (@camionId, NULL, @fecha, @fecha, @estado, @resultado, @obs)
      `);

    return NextResponse.json(
      { ok: true, inspeccionId: ins.recordset?.[0]?.id ?? null },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/admin/inspecciones error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
