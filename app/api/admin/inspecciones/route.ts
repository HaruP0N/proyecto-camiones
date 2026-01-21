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
    }).connect();
  }
  return poolPromise;
}

function normalizePatente(p: string) {
  return p.trim().toUpperCase().replace(/\s+/g, "");
}

function isValidIsoDate(value: string) {
  const d = new Date(value);
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

    const camionIdRaw = body.camionId;
    const patenteRaw = body.patente;
    const fechaProgramadaRaw = body.fechaProgramada;
    const inspectorIdRaw = body.inspectorId;
    const observacionesRaw = body.observaciones;

    const hasCamionId = camionIdRaw !== undefined && camionIdRaw !== null && camionIdRaw !== "";
    const hasPatente = typeof patenteRaw === "string" && patenteRaw.trim().length > 0;

    if (!hasCamionId && !hasPatente) {
      return NextResponse.json({ ok: false, error: "Debes enviar camionId o patente" }, { status: 400 });
    }

    if (typeof fechaProgramadaRaw !== "string" || !isValidIsoDate(fechaProgramadaRaw)) {
      return NextResponse.json(
        { ok: false, error: "fechaProgramada debe ser una fecha ISO válida" },
        { status: 400 }
      );
    }

    const fechaProgramada = new Date(fechaProgramadaRaw);

    let observaciones: string | null = null;
    if (observacionesRaw !== undefined && observacionesRaw !== null) {
      if (typeof observacionesRaw !== "string") {
        return NextResponse.json({ ok: false, error: "observaciones debe ser string" }, { status: 400 });
      }
      const txt = observacionesRaw.trim();
      if (txt.length > 500) {
        return NextResponse.json({ ok: false, error: "observaciones máximo 500 caracteres" }, { status: 400 });
      }
      observaciones = txt.length ? txt : null;
    }

    let inspectorId: number | null = null;
    if (inspectorIdRaw !== undefined && inspectorIdRaw !== null && inspectorIdRaw !== "") {
      const n = Number(inspectorIdRaw);
      if (!Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ ok: false, error: "inspectorId inválido" }, { status: 400 });
      }
      inspectorId = n;
    }

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    try {
      let camionId: number;

      if (hasCamionId) {
        const n = Number(camionIdRaw);
        if (!Number.isInteger(n) || n <= 0) {
          await tx.rollback();
          return NextResponse.json({ ok: false, error: "camionId inválido" }, { status: 400 });
        }
        camionId = n;
      } else {
        const patente = normalizePatente(String(patenteRaw));
        const r = await new sql.Request(tx)
          .input("patente", sql.VarChar(20), patente)
          .query(`SELECT TOP 1 id FROM dbo.camiones WHERE patente = @patente`);

        if (r.recordset.length === 0) {
          await tx.rollback();
          return NextResponse.json({ ok: false, error: "No existe un camión con esa patente" }, { status: 404 });
        }
        camionId = r.recordset[0].id as number;
      }

      // validar camión existe
      {
        const r = await new sql.Request(tx)
          .input("camionId", sql.Int, camionId)
          .query(`SELECT TOP 1 id FROM dbo.camiones WHERE id = @camionId`);
        if (r.recordset.length === 0) {
          await tx.rollback();
          return NextResponse.json({ ok: false, error: "camionId no existe" }, { status: 404 });
        }
      }

      // validar inspector si viene: rol operador y activo
      if (inspectorId !== null) {
        const r = await new sql.Request(tx)
          .input("inspectorId", sql.Int, inspectorId)
          .query(`SELECT TOP 1 id, rol, activo FROM dbo.usuarios WHERE id = @inspectorId`);

        if (r.recordset.length === 0) {
          await tx.rollback();
          return NextResponse.json({ ok: false, error: "inspectorId no existe" }, { status: 404 });
        }

        const row = r.recordset[0] as any;
        if (row.rol !== "operador") {
          await tx.rollback();
          return NextResponse.json({ ok: false, error: "El usuario no es operador (inspector)" }, { status: 400 });
        }
        if (Number(row.activo) !== 1) {
          await tx.rollback();
          return NextResponse.json({ ok: false, error: "El inspector está inactivo" }, { status: 400 });
        }
      }

      // evitar duplicado: PROGRAMADA mismo día
      {
        const r = await new sql.Request(tx)
          .input("camionId", sql.Int, camionId)
          .input("fecha", sql.DateTime2, fechaProgramada)
          .query(`
            SELECT TOP 1 id
            FROM dbo.inspecciones
            WHERE camion_id = @camionId
              AND estado = 'PROGRAMADA'
              AND CONVERT(date, fecha_programada) = CONVERT(date, @fecha)
          `);

        if (r.recordset.length > 0) {
          await tx.rollback();
          return NextResponse.json(
            { ok: false, error: "Ya existe una inspección PROGRAMADA para ese camión en esa fecha" },
            { status: 409 }
          );
        }
      }

      const ins = await new sql.Request(tx)
        .input("camionId", sql.Int, camionId)
        .input("inspectorId", sql.Int, inspectorId)
        .input("fechaProgramada", sql.DateTime2, fechaProgramada)
        .input("estado", sql.VarChar(20), "PROGRAMADA")
        .input("observaciones", sql.NVarChar(500), observaciones)
        .query(`
          INSERT INTO dbo.inspecciones
            (camion_id, inspector_id, fecha_programada, estado, observaciones, created_at)
          OUTPUT INSERTED.id
          VALUES
            (@camionId, @inspectorId, @fechaProgramada, @estado, @observaciones, SYSUTCDATETIME())
        `);

      const newId = ins.recordset[0].id as number;

      await tx.commit();

      return NextResponse.json(
        {
          ok: true,
          inspeccion: {
            id: newId,
            camionId,
            inspectorId,
            fechaProgramada: fechaProgramada.toISOString(),
            estado: "PROGRAMADA",
          },
        },
        { status: 201 }
      );
    } catch (e) {
      try { await tx.rollback(); } catch {}
      throw e;
    }
  } catch (err) {
    console.error("POST /api/admin/inspecciones error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
