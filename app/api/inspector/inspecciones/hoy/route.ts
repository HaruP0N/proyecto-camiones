// app/api/inspector/inspecciones/hoy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";
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
      WITH base AS (
        SELECT
          i.id,
          i.camion_id,
          c.patente,
          c.marca,
          c.modelo,
          c.tipo,
          c.carroceria,
          e.telefono_contacto AS telefono_cliente,
          e.direccion AS ubicacion,
          e.nombre AS empresa_nombre,
          i.inspector_id,
          i.estado,
          to_char(i.fecha_programada AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_programada,
          to_char(i.fecha_inspeccion AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inspeccion,
          i.resultado_general,
          i.observaciones_generales,
          i.revision_admin,
          i.comentario_admin,
          ROW_NUMBER() OVER (
            PARTITION BY i.camion_id
            ORDER BY i.fecha_programada DESC, i.id DESC
          ) AS rn
        FROM public.inspecciones i
        LEFT JOIN public.camiones c ON c.id = i.camion_id
        LEFT JOIN public.proveedores p ON p.id = c.proveedor_id
        LEFT JOIN public.empresas e ON e.id = p.empresa_id
        WHERE
          i.inspector_id = @inspectorId  -- ✅ Filtro de seguridad obligatorio
          AND i.estado = 'PROGRAMADA'
          AND CAST(i.fecha_programada AT TIME ZONE 'America/Santiago' AS DATE)
          =
          CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' AS DATE)
      )
      SELECT * FROM base WHERE rn = 1
    `;

    const request = pool.request();
    // 4. Inyectamos el ID real de la sesión
    request.input("inspectorId", session.userId);

    q += " ORDER BY fecha_programada ASC";

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
