import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
import { requireAdmin } from "@/lib/shared/security/staff-auth";

export const runtime = "nodejs";

function isDateOnly(s: string | null) {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toSqlDatetime2String(local: string) {
  if (!local) return "";
  const s = String(local).trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return "";
  return s.replace("T", " ") + ":00";
}

export async function GET(req: NextRequest) {
  try {
    const admin = requireAdmin(req);
    if (!admin) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");
    const clienteRaw = (searchParams.get("cliente") || "").trim();
    const nowLocal = toSqlDatetime2String(searchParams.get("nowLocal") || "");

    if (!isDateOnly(fechaInicio) || !isDateOnly(fechaFin)) {
      return NextResponse.json(
        { ok: false, error: "fechaInicio y fechaFin deben venir como YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const clienteLike = clienteRaw ? `%${clienteRaw}%` : null;

    const pool = await getPool();

    // ✅ JOIN CORRECTO: camiones → proveedores → empresas
    const realizadasQ = pool
      .request()
      .input("fechaInicio", fechaInicio)
      .input("fechaFin", fechaFin)
      .input("clienteLike", clienteLike)
      .query(`
        SELECT
          CAST(i.fecha_inspeccion AS date) AS dia,
          COUNT(*) AS total
        FROM dbo.inspecciones i
        INNER JOIN dbo.camiones c ON c.id = i.camion_id
        INNER JOIN dbo.proveedores p ON p.id = c.proveedor_id
        INNER JOIN dbo.empresas e ON e.id = p.empresa_id
        WHERE
          i.estado = 'REALIZADA'
          AND i.fecha_inspeccion IS NOT NULL
          AND i.fecha_inspeccion >= CONVERT(date, @fechaInicio, 23)
          AND i.fecha_inspeccion <= CONVERT(date, @fechaFin, 23)
          AND (
            @clienteLike IS NULL
            OR e.nombre LIKE @clienteLike
            OR e.rut LIKE @clienteLike
          )
        GROUP BY CAST(i.fecha_inspeccion AS date)
        ORDER BY dia ASC;
      `);

    const pendientesQ = pool
      .request()
      .input("fechaInicio", fechaInicio)
      .input("fechaFin", fechaFin)
      .input("clienteLike", clienteLike)
      .input("nowLocal", nowLocal || null)
      .query(`
        DECLARE @now datetime2 = CASE
          WHEN @nowLocal IS NULL OR @nowLocal = '' THEN SYSDATETIME()
          ELSE CONVERT(datetime2, @nowLocal, 120)
        END;

        SELECT
          SUM(CASE
                WHEN i.estado = 'PROGRAMADA'
                 AND i.fecha_programada IS NOT NULL
                 AND i.fecha_programada >= @now
              THEN 1 ELSE 0 END) AS programadas,
          SUM(CASE
                WHEN i.estado = 'PROGRAMADA'
                 AND i.fecha_programada IS NOT NULL
                 AND i.fecha_programada < @now
              THEN 1 ELSE 0 END) AS vencidas
        FROM dbo.inspecciones i
        INNER JOIN dbo.camiones c ON c.id = i.camion_id
        INNER JOIN dbo.proveedores p ON p.id = c.proveedor_id
        INNER JOIN dbo.empresas e ON e.id = p.empresa_id
        WHERE
          i.estado = 'PROGRAMADA'
          AND CAST(i.fecha_programada AS date) >= CONVERT(date, @fechaInicio, 23)
          AND CAST(i.fecha_programada AS date) <= CONVERT(date, @fechaFin, 23)
          AND (
            @clienteLike IS NULL
            OR e.nombre LIKE @clienteLike
            OR e.rut LIKE @clienteLike
          );
      `);

    const [realizadasR, pendientesR] = await Promise.all([realizadasQ, pendientesQ]);

    const realizadas = (realizadasR.recordset || []).map((r: any) => ({
      label: String(r.dia).slice(0, 10), // "YYYY-MM-DD"
      value: Number(r.total || 0),
    }));

    const pendientes = {
      programadas: Number(pendientesR.recordset?.[0]?.programadas || 0),
      vencidas: Number(pendientesR.recordset?.[0]?.vencidas || 0),
    };

    console.log("📊 Dashboard data:", { realizadas, pendientes });

    return NextResponse.json({ ok: true, realizadas, pendientes }, { status: 200 });
  } catch (e: any) {
    console.error("❌ GET /api/admin/dashboard error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}