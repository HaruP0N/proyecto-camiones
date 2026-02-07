// app/api/inspector/inspecciones/hoy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
// 1. Importamos la seguridad
import { requireInspector } from "@/lib/shared/security/staff-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // 2. Obtenemos el inspector logueado
    const session = requireInspector(req);
    if (!session) {
      // Si no hay sesión, devolvemos array vacío o error 401
      return NextResponse.json({ ok: true, data: [] });
    }

    const pool = await getPool();

    // 3. Usamos session.userId en la consulta obligatoriamente
    let q = `
      SELECT
        i.id,
        i.camion_id,
        c.patente,
        c.marca,
        c.modelo,
        e.nombre AS empresa_nombre,
        i.inspector_id,
        i.estado,
        CONVERT(varchar(30), i.fecha_programada, 126) AS fecha_programada,
        CONVERT(varchar(30), i.fecha_inspeccion, 126) AS fecha_inspeccion,
        i.resultado_general,
        i.observaciones_generales
      FROM dbo.inspecciones i
      LEFT JOIN dbo.camiones c ON c.id = i.camion_id
      LEFT JOIN dbo.proveedores p ON p.id = c.proveedor_id
      LEFT JOIN dbo.empresas e ON e.id = p.empresa_id
      WHERE 
        i.inspector_id = @inspectorId  -- ✅ Filtro de seguridad obligatorio
        AND CAST(i.fecha_programada AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific SA Standard Time' AS DATE) 
        = 
        CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATE)
    `;

    const request = pool.request();
    // 4. Inyectamos el ID real de la sesión
    request.input("inspectorId", session.userId);

    q += " ORDER BY i.fecha_programada ASC";

    const res = await request.query(q);
    return NextResponse.json({ ok: true, data: res.recordset ?? [] });
  } catch (err) {
    console.error("GET /api/inspector/inspecciones/hoy error:", err);
    return NextResponse.json(
      { ok: false, error: "Error interno al obtener inspecciones" },
      { status: 500 }
    );
  }
}