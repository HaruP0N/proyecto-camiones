import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
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
        COUNT(*) as cantidad
      FROM dbo.inspecciones
      WHERE estado = 'REALIZADA'
        AND fecha_inspeccion >= DATEADD(day, -30, GETDATE())
      GROUP BY resultado_general
    `);

    // 2. Tasa de cumplimiento (este mes)
    const cumplimientoQ = pool.request().query(`
      SELECT
        COUNT(CASE WHEN estado = 'REALIZADA' THEN 1 END) as realizadas,
        COUNT(CASE WHEN estado = 'PROGRAMADA' AND fecha_programada < GETDATE() THEN 1 END) as vencidas,
        COUNT(*) as total
      FROM dbo.inspecciones
      WHERE MONTH(fecha_programada) = MONTH(GETDATE())
        AND YEAR(fecha_programada) = YEAR(GETDATE())
    `);

    // 3. Inspecciones por categoría (últimos 30 días)
    const categoriasQ = pool.request().query(`
      SELECT 
        d.categoria,
        COUNT(DISTINCT d.inspeccion_id) as cantidad
      FROM dbo.detalle_inspeccion d
      INNER JOIN dbo.inspecciones i ON i.id = d.inspeccion_id
      WHERE i.estado = 'REALIZADA'
        AND i.fecha_inspeccion >= DATEADD(day, -30, GETDATE())
      GROUP BY d.categoria
      ORDER BY cantidad DESC
    `);

    // 4. Top 5 empresas con más inspecciones
    const empresasQ = pool.request().query(`
      SELECT TOP 5
        e.nombre,
        COUNT(i.id) as total_inspecciones
      FROM dbo.empresas e
      INNER JOIN dbo.proveedores p ON p.empresa_id = e.id
      INNER JOIN dbo.camiones c ON c.proveedor_id = p.id
      INNER JOIN dbo.inspecciones i ON i.camion_id = c.id
      WHERE i.estado = 'REALIZADA'
        AND i.fecha_inspeccion >= DATEADD(day, -30, GETDATE())
      GROUP BY e.id, e.nombre
      ORDER BY total_inspecciones DESC
    `);

    const [resultadosR, cumplimientoR, categoriasR, empresasR] = await Promise.all([
      resultadosQ,
      cumplimientoQ,
      categoriasQ,
      empresasQ,
    ]);

    // Procesar resultados
    const resultados = {
      aprobado: Number(resultadosR.recordset?.find((r: any) => r.resultado_general === "aprobado")?.cantidad || 0),
      observado: Number(resultadosR.recordset?.find((r: any) => r.resultado_general === "observado")?.cantidad || 0),
      rechazado: Number(resultadosR.recordset?.find((r: any) => r.resultado_general === "rechazado")?.cantidad || 0),
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
