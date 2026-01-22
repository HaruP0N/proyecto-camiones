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

// PATCH: reagendar o cancelar
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const inspeccionId = Number(ctx.params.id);
    if (!Number.isInteger(inspeccionId) || inspeccionId <= 0) {
      return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    }

    const action = body.action;

    const pool = await getPool();

    // Debe existir y estar en PROGRAMADA para permitir cambios desde admin
    const current = await pool.request()
      .input("id", sql.Int, inspeccionId)
      .query(`
        SELECT TOP 1 id, estado
        FROM dbo.inspecciones
        WHERE id = @id
      `);

    if (current.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Inspección no existe" }, { status: 404 });
    }

    const estadoActual = String(current.recordset[0].estado);

    if (estadoActual !== "PROGRAMADA") {
      return NextResponse.json(
        { ok: false, error: "Solo se puede modificar una inspección PROGRAMADA" },
        { status: 409 }
      );
    }

    if (action === "CANCELAR") {
      // CHECK estado permite CANCELADA
      await pool.request()
        .input("id", sql.Int, inspeccionId)
        .query(`
          UPDATE dbo.inspecciones
          SET estado = 'CANCELADA'
          WHERE id = @id
        `);

      return NextResponse.json({ ok: true });
    }

    if (action === "REAGENDAR") {
      const fechaIso = body.fechaProgramada;
      const obs = typeof body.observaciones === "string" ? body.observaciones.trim() : null;

      if (!isValidIsoDate(fechaIso)) {
        return NextResponse.json({ ok: false, error: "fechaProgramada inválida" }, { status: 400 });
      }

      const fecha = new Date(fechaIso);
      if (fecha.getTime() < Date.now() - 60_000) {
        return NextResponse.json({ ok: false, error: "La fecha debe ser futura" }, { status: 400 });
      }

      // Mantener consistencia: fecha_programada y fecha_inspeccion
      await pool.request()
        .input("id", sql.Int, inspeccionId)
        .input("fecha", sql.DateTime2, fecha)
        .input("obs", sql.NVarChar(sql.MAX), obs)
        .query(`
          UPDATE dbo.inspecciones
          SET
            fecha_programada = @fecha,
            fecha_inspeccion = @fecha,
            observaciones_generales = COALESCE(NULLIF(@obs, ''), observaciones_generales)
          WHERE id = @id
        `);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Acción inválida" }, { status: 400 });
  } catch (err) {
    console.error("PATCH /api/admin/inspecciones/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
