import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
import { requireInspector } from "@/lib/shared/security/staff-auth";

/**
 * GET /api/inspector/inspecciones/camion/[id]
 * Obtiene los datos de un camión específico con su última inspección
 * Solo accesible por inspectores autenticados
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: camionId } = await params;

    // Verificar JWT y rol
    const session = requireInspector(req);
    if (!session) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const pool = await getPool();

    // Obtener datos del camión con su empresa
   const camionResult = await pool
  .request()
  .input("camion_id", camionId)
  .query(`
    SELECT
      c.id,
      c.patente,
      c.marca,
      c.modelo,
      c.anio,
      c.tipo,
      c.carroceria, -- Cambiar tipo_remolque por carroceria
      e.nombre as empresa
    FROM camiones c
    LEFT JOIN proveedores p ON c.proveedor_id = p.id
    LEFT JOIN empresas e ON p.empresa_id = e.id
    WHERE c.id = @camion_id
  `);

    if (camionResult.recordset.length === 0) {
      return NextResponse.json(
        { error: "Camión no encontrado" },
        { status: 404 }
      );
    }

    const camion = camionResult.recordset[0];

    // Obtener última inspección realizada de este camión
    const ultimaInspeccionResult = await pool
      .request()
      .input("camion_id", camionId)
      .query(`
        SELECT TOP 1
          i.id,
          i.fecha_inspeccion as fecha,
          i.nota_final as nota,
          i.resultado_general as resultado,
          i.estado
        FROM inspecciones i
        WHERE i.camion_id = @camion_id
          AND i.estado = 'REALIZADA'
        ORDER BY i.fecha_inspeccion DESC
      `);

    const ultimaInspeccion = ultimaInspeccionResult.recordset.length > 0
      ? {
          fecha: ultimaInspeccionResult.recordset[0].fecha,
          nota: ultimaInspeccionResult.recordset[0].nota || 0,
          resultado: ultimaInspeccionResult.recordset[0].resultado || "Sin resultado",
        }
      : null;

   return NextResponse.json({
  success: true,
  data: {
    id: camion.id,
    patente: camion.patente,
    marca: camion.marca,
    modelo: camion.modelo,
    anio: camion.anio,
    tipo: camion.tipo,
    carroceria: camion.carroceria, // Se reemplaza tipo_remolque por carroceria
    empresa: camion.empresa || "Sin empresa",
    ultimaInspeccion,
  },
});
  } catch (error) {
    console.error("Error obteniendo camión:", error);
    return NextResponse.json(
      { error: "Error al obtener datos del camión" },
      { status: 500 }
    );
  }
}
