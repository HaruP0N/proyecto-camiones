import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { requireAdmin } from "@/lib/shared/security/staff-auth";

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

function isValidDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const from = (url.searchParams.get("from") || "").trim();
    const to = (url.searchParams.get("to") || "").trim();
    const patente = (url.searchParams.get("patente") || "").trim();
    const empresa = (url.searchParams.get("empresa") || "").trim();

    if (from && !isValidDate(from)) {
      return NextResponse.json({ ok: false, error: "from inválido (YYYY-MM-DD)" }, { status: 400 });
    }
    if (to && !isValidDate(to)) {
      return NextResponse.json({ ok: false, error: "to inválido (YYYY-MM-DD)" }, { status: 400 });
    }

    const pool = await getPool();

    // Fecha para filtrar: preferimos fecha_realizada (datetime2), si no existe usamos fecha_programada,
    // y como última opción fecha_inspeccion (DATE) convertida.
    // Rango: >= from y < (to + 1 día) para incluir todo el día "to".
    const q = `
      SELECT TOP 500
        i.id,
        c.patente,
        e.nombre AS empresaNombre,
        CONVERT(varchar(16),
          COALESCE(i.fecha_realizada, i.fecha_programada, CONVERT(datetime2, i.fecha_inspeccion)),
          120
        ) AS fechaInspeccion,
        u.nombre AS inspectorNombre,
        i.resultado_general AS resultado
      FROM dbo.inspecciones i
      INNER JOIN dbo.camiones c ON c.id = i.camion_id
      INNER JOIN dbo.proveedores p ON p.id = c.proveedor_id
      INNER JOIN dbo.empresas e ON e.id = p.empresa_id
      LEFT JOIN dbo.usuarios u ON u.id = i.inspector_id
      WHERE i.estado = 'REALIZADA'
        ${from ? "AND COALESCE(i.fecha_realizada, i.fecha_programada, CONVERT(datetime2, i.fecha_inspeccion)) >= CONVERT(date, @from)" : ""}
        ${to ? "AND COALESCE(i.fecha_realizada, i.fecha_programada, CONVERT(datetime2, i.fecha_inspeccion)) < DATEADD(day, 1, CONVERT(date, @to))" : ""}
        ${patente ? "AND UPPER(LTRIM(RTRIM(c.patente))) LIKE '%' + UPPER(@patente) + '%'" : ""}
        ${
          empresa
            ? "AND (UPPER(LTRIM(RTRIM(e.nombre))) LIKE '%' + UPPER(@empresa) + '%' OR UPPER(LTRIM(RTRIM(e.rut))) LIKE '%' + UPPER(@empresa) + '%')"
            : ""
        }
      ORDER BY COALESCE(i.fecha_realizada, i.fecha_programada, CONVERT(datetime2, i.fecha_inspeccion)) DESC;
    `;

    const r = pool.request();
    if (from) r.input("from", sql.VarChar(10), from);
    if (to) r.input("to", sql.VarChar(10), to);
    if (patente) r.input("patente", sql.VarChar(20), patente);
    if (empresa) r.input("empresa", sql.VarChar(150), empresa);

    const rs = await r.query(q);

    const rows = (rs.recordset || []).map((x: any) => ({
      id: Number(x.id),
      patente: x.patente ?? null,
      empresaNombre: x.empresaNombre ?? null,
      fechaInspeccion: x.fechaInspeccion ? String(x.fechaInspeccion).replace(" ", "T") : null,
      inspectorNombre: x.inspectorNombre ?? null,
      resultado: x.resultado ?? null,
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    console.error("GET /api/admin/inspecciones/realizadas error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

