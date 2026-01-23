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

function isValidDatetimeLocal(s: unknown) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);
}

// ✅ parser robusto del id (params o pathname)
function parseInspeccionId(req: NextRequest, params?: { id?: string }) {
  const fromParams = params?.id;
  const fromPath = req.nextUrl.pathname.split("/").filter(Boolean).pop(); // último segmento

  const raw = (fromParams ?? fromPath ?? "").trim();

  // extra: si viniera algo raro, nos quedamos con dígitos
  const onlyDigits = raw.replace(/[^\d]/g, "");
  const n = Number(onlyDigits);

  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const inspeccionId = parseInspeccionId(req, params);
    if (!inspeccionId) {
      return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    }

    const action = (body as any).action;
    const pool = await getPool();

    // Debe existir
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

    // ✅ CANCELAR
    if (action === "CANCELAR") {
      await pool.request()
        .input("id", sql.Int, inspeccionId)
        .query(`
          UPDATE dbo.inspecciones
          SET estado = 'CANCELADA'
          WHERE id = @id
        `);

      return NextResponse.json({ ok: true });
    }

    // ✅ REAGENDAR (con inspector opcional)
    if (action === "REAGENDAR") {
      const fechaLocal = (body as any).fechaProgramada;
      const obs = typeof (body as any).observaciones === "string" ? (body as any).observaciones.trim() : null;

      const inspectorIdRaw = (body as any).inspectorId;
      const inspectorId =
        inspectorIdRaw === null || inspectorIdRaw === undefined || inspectorIdRaw === ""
          ? null
          : Number(inspectorIdRaw);

      if (!isValidDatetimeLocal(fechaLocal)) {
        return NextResponse.json({ ok: false, error: "fechaProgramada inválida" }, { status: 400 });
      }
      if (inspectorId !== null && (!Number.isInteger(inspectorId) || inspectorId <= 0)) {
        return NextResponse.json({ ok: false, error: "inspectorId inválido" }, { status: 400 });
      }

      const fechaSql = `${fechaLocal.replace("T", " ")}:00`;

      // Validar inspector robusto
      if (inspectorId !== null) {
        const insp = await pool.request()
          .input("id", sql.Int, inspectorId)
          .query(`
            SELECT TOP 1 id
            FROM dbo.usuarios
            WHERE id = @id
              AND ISNULL(activo, 0) = 1
              AND LOWER(LTRIM(RTRIM(rol))) = 'inspector'
          `);

        if (insp.recordset.length === 0) {
          return NextResponse.json(
            { ok: false, error: "Inspector no existe o no está activo" },
            { status: 404 }
          );
        }
      }

      // Validación futura (local)
      await pool.request()
        .input("fecha", sql.NVarChar(19), fechaSql)
        .query(`
          IF (CONVERT(datetime2, @fecha, 120) < DATEADD(minute, 1, SYSDATETIME()))
            THROW 50001, 'La fecha debe ser futura', 1;
        `);

      await pool.request()
        .input("id", sql.Int, inspeccionId)
        .input("fecha", sql.NVarChar(19), fechaSql)
        .input("inspectorId", sql.Int, inspectorId)
        .input("obs", sql.NVarChar(sql.MAX), obs)
        .query(`
          UPDATE dbo.inspecciones
          SET
            fecha_programada = CONVERT(datetime2, @fecha, 120),
            fecha_inspeccion = CONVERT(datetime2, @fecha, 120),
            inspector_id = @inspectorId,
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
