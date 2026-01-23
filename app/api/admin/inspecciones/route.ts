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

    const camionId = (body as any).camionId;
    const fechaLocal = (body as any).fechaProgramada;
    const inspectorIdRaw = (body as any).inspectorId;
    const observaciones =
      typeof (body as any).observaciones === "string" ? (body as any).observaciones.trim() : null;

    if (!Number.isInteger(camionId) || camionId <= 0) {
      return NextResponse.json({ ok: false, error: "camionId inválido" }, { status: 400 });
    }
    if (!isValidDatetimeLocal(fechaLocal)) {
      return NextResponse.json({ ok: false, error: "fechaProgramada inválida" }, { status: 400 });
    }

    const inspectorId =
      inspectorIdRaw === null || inspectorIdRaw === undefined || inspectorIdRaw === ""
        ? null
        : Number(inspectorIdRaw);

    if (inspectorId !== null && (!Number.isInteger(inspectorId) || inspectorId <= 0)) {
      return NextResponse.json({ ok: false, error: "inspectorId inválido" }, { status: 400 });
    }

    const fechaSql = `${fechaLocal.replace("T", " ")}:00`;
    const pool = await getPool();

    // Verificar camión
    const cam = await pool.request()
      .input("camionId", sql.Int, camionId)
      .query(`SELECT TOP 1 id FROM dbo.camiones WHERE id = @camionId`);

    if (cam.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Camión no existe" }, { status: 404 });
    }

    // ✅ Verificar inspector (robusto: trim+lower y activo)
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

    // Evitar doble agenda futura
    const exists = await pool.request()
      .input("camionId", sql.Int, camionId)
      .query(`
        SELECT TOP 1 id
        FROM dbo.inspecciones
        WHERE camion_id = @camionId
          AND estado = 'PROGRAMADA'
          AND fecha_programada >= SYSDATETIME()
      `);

    if (exists.recordset.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Este camión ya tiene una inspección programada" },
        { status: 409 }
      );
    }

    // Validación futura en SQL (local)
    await pool.request()
      .input("fecha", sql.NVarChar(19), fechaSql)
      .query(`
        IF (CONVERT(datetime2, @fecha, 120) < DATEADD(minute, 1, SYSDATETIME()))
          THROW 50001, 'La fecha debe ser futura', 1;
      `);

    const ins = await pool.request()
      .input("camionId", sql.Int, camionId)
      .input("fecha", sql.NVarChar(19), fechaSql)
      .input("inspectorId", sql.Int, inspectorId)
      .input("obs", sql.NVarChar(sql.MAX), observaciones)
      .query(`
        INSERT INTO dbo.inspecciones
          (camion_id, inspector_id, fecha_inspeccion, fecha_programada, estado, resultado_general, observaciones_generales)
        OUTPUT INSERTED.id
        VALUES
          (@camionId, @inspectorId,
           CONVERT(datetime2, @fecha, 120),
           CONVERT(datetime2, @fecha, 120),
           'PROGRAMADA', 'observado', @obs)
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
