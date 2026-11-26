import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { requireAdmin } from "@/lib/shared/security/staff-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const admin = requireAdmin(req);
    if (!admin) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const pool = await getPool();

    // 1. Resultados de inspecciones (últimos 30 días)
    const resultadosQ = pool.request().query(`
      SELECT
        resultado_general,
        COUNT(*)::integer as cantidad
      FROM public.inspecciones
      WHERE estado = 'REALIZADA'
        AND fecha_inspeccion >= (CURRENT_TIMESTAMP - INTERVAL '30 days')
      GROUP BY resultado_general
    `);

    // 2. Tasa de cumplimiento (este mes)
    const cumplimientoQ = pool.request().query(`
      SELECT
        COUNT(CASE WHEN estado = 'REALIZADA' THEN 1 END)::integer as realizadas,
        COUNT(CASE WHEN estado = 'PROGRAMADA' AND fecha_programada < CURRENT_TIMESTAMP THEN 1 END)::integer as vencidas,
        COUNT(*)::integer as total
      FROM public.inspecciones
      WHERE date_trunc('month', fecha_programada AT TIME ZONE 'America/Santiago') = date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')
    `);

    // 3. Inspecciones por categoría (últimos 30 días)
    const categoriasQ = pool.request().query(`
      SELECT
        d.categoria,
        COUNT(DISTINCT d.inspeccion_id)::integer as cantidad
      FROM public.detalle_inspeccion d
      INNER JOIN public.inspecciones i ON i.id = d.inspeccion_id
      WHERE i.estado = 'REALIZADA'
        AND i.fecha_inspeccion >= (CURRENT_TIMESTAMP - INTERVAL '30 days')
      GROUP BY d.categoria
      ORDER BY cantidad DESC
    `);

    // 4. Top 5 empresas con más inspecciones
    const empresasQ = pool.request().query(`
      SELECT e.nombre,
        COUNT(i.id)::integer as total_inspecciones
      FROM public.empresas e
      INNER JOIN public.proveedores p ON p.empresa_id = e.id
      INNER JOIN public.camiones c ON c.proveedor_id = p.id
      INNER JOIN public.inspecciones i ON i.camion_id = c.id
      WHERE i.estado = 'REALIZADA'
        AND i.fecha_inspeccion >= (CURRENT_TIMESTAMP - INTERVAL '30 days')
      GROUP BY e.id, e.nombre
      ORDER BY total_inspecciones DESC
     LIMIT 5`);

    const [resultadosR, cumplimientoR, categoriasR, empresasR] = await Promise.all([
      resultadosQ,
      cumplimientoQ,
      categoriasQ,
      empresasQ,
    ]);

    // Procesar resultados
    const resultados = {
      aprobado: Number(resultadosR.recordset?.find((r: any) => r.resultado_general === "APROBADO")?.cantidad || 0),
      observado: Number(resultadosR.recordset?.find((r: any) => r.resultado_general === "OBSERVADO")?.cantidad || 0),
      rechazado: Number(resultadosR.recordset?.find((r: any) => r.resultado_general === "RECHAZADO")?.cantidad || 0),
    };

    const cumplimiento = {
      realizadas: Number(cumplimientoR.recordset?.[0]?.realizadas || 0),
      vencidas: Number(cumplimientoR.recordset?.[0]?.vencidas || 0),
      total: Number(cumplimientoR.recordset?.[0]?.total || 0),
    };

    const categorias = (categoriasR.recordset || []).map((r: any) => ({
      categoria: String(r.categoria),
      cantidad: Number(r.cantidad || 0),
    }));

    const topEmpresas = (empresasR.recordset || []).map((r: any) => ({
      nombre: String(r.nombre),
      total: Number(r.total_inspecciones || 0),
    }));

    console.log("📊 Dashboard stats:", { resultados, cumplimiento, categorias, topEmpresas });

    return NextResponse.json({
      ok: true,
      resultados,
      cumplimiento,
      categorias,
      topEmpresas,
    }, { status: 200 });

  } catch (e: any) {
    console.error("❌ GET /api/admin/dashboard-stats error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}
