import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
import { requireAdmin } from "@/lib/shared/security/staff-auth";

export const runtime = "nodejs";

function toSqlDatetime2String(local: string) {
  // "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DD HH:mm:00"
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

    const todayStart = toSqlDatetime2String(searchParams.get("todayStart") || "");
    const todayEnd = toSqlDatetime2String(searchParams.get("todayEnd") || "");
    const weekStart = toSqlDatetime2String(searchParams.get("weekStart") || "");
    const weekEnd = toSqlDatetime2String(searchParams.get("weekEnd") || "");
    const nowLocal = toSqlDatetime2String(searchParams.get("nowLocal") || "");

    if (!todayStart || !todayEnd || !weekStart || !weekEnd || !nowLocal) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Faltan o son inválidos los parámetros de fecha (todayStart/todayEnd/weekStart/weekEnd/nowLocal). Formato esperado: YYYY-MM-DDTHH:mm",
        },
        { status: 400 }
      );
    }

    const pool = await getPool();

    const camionesTotalQ = pool.request().query(`SELECT COUNT(1) AS n FROM dbo.camiones`);
    const empresasTotalQ = pool.request().query(`SELECT COUNT(1) AS n FROM dbo.empresas`);

    const hoyQ = pool
      .request()
      .input("todayStart", todayStart)
      .input("todayEnd", todayEnd)
      .query(`
        SELECT COUNT(1) AS n
        FROM dbo.inspecciones
        WHERE estado = 'PROGRAMADA'
          AND fecha_programada >= CONVERT(datetime2, @todayStart, 120)
          AND fecha_programada <= CONVERT(datetime2, @todayEnd, 120)
      `);

    const semanaQ = pool
      .request()
      .input("weekStart", weekStart)
      .input("weekEnd", weekEnd)
      .query(`
        SELECT COUNT(1) AS n
        FROM dbo.inspecciones
        WHERE estado = 'PROGRAMADA'
          AND fecha_programada >= CONVERT(datetime2, @weekStart, 120)
          AND fecha_programada <= CONVERT(datetime2, @weekEnd, 120)
      `);

    const vencidasQ = pool
      .request()
      .input("nowLocal", nowLocal)
      .query(`
        SELECT COUNT(1) AS n
        FROM dbo.inspecciones
        WHERE estado = 'PROGRAMADA'
          AND fecha_programada < CONVERT(datetime2, @nowLocal, 120)
      `);

    const [camionesTotalR, empresasTotalR, hoyR, semanaR, vencidasR] = await Promise.all([
      camionesTotalQ,
      empresasTotalQ,
      hoyQ,
      semanaQ,
      vencidasQ,
    ]);

    const data = {
      camionesTotal: camionesTotalR.recordset?.[0]?.n ?? 0,
      empresasTotal: empresasTotalR.recordset?.[0]?.n ?? 0,
      inspeccionesHoyProgramadas: hoyR.recordset?.[0]?.n ?? 0,
      inspeccionesSemanaProgramadas: semanaR.recordset?.[0]?.n ?? 0,
      inspeccionesVencidas: vencidasR.recordset?.[0]?.n ?? 0,
    };

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    console.error("GET /api/admin/kpis error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}
