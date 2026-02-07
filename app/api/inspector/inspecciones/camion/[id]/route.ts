import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
import { requireInspector } from "@/lib/shared/security/staff-auth";

export const runtime = "nodejs";

/**
 * GET /api/inspector/inspecciones/camion/[id]
 * Obtiene los datos de un camión con detalles de la empresa
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const camionId = id;

    // Verificar JWT y rol
    const session = requireInspector(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!camionId || isNaN(Number(camionId))) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const pool = await getPool();

    // Consulta con JOIN para obtener datos del camión y empresa
    const result = await pool
      .request()
      .input("id", camionId)
      .query(`
        SELECT 
          c.id, 
          c.patente, 
          c.marca, 
          c.modelo, 
          c.anio, 
          c.tipo, 
          c.carroceria,
          c.created_at,
          
          -- Datos de la Empresa
          e.nombre AS empresa_nombre,
          e.rut AS empresa_rut,
          e.direccion AS empresa_direccion,
          e.telefono_contacto AS empresa_telefono,
          e.email_contacto AS empresa_email
          
        FROM dbo.camiones c
        LEFT JOIN dbo.proveedores p ON p.id = c.proveedor_id
        LEFT JOIN dbo.empresas e ON e.id = p.empresa_id
        WHERE c.id = @id
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Camión no encontrado" }, { status: 404 });
    }

    const row = result.recordset[0];

    // Obtener última inspección
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

    // ✅ Estructura de respuesta con empresa como objeto
    const data = {
      id: row.id,
      patente: row.patente,
      marca: row.marca,
      modelo: row.modelo,
      anio: row.anio,
      tipo: row.tipo,
      carroceria: row.carroceria,
      empresa: {
        nombre: row.empresa_nombre || "Sin empresa",
        rut: row.empresa_rut || "Sin RUT",
        direccion: row.empresa_direccion || "Dirección no registrada",
        contacto: row.empresa_telefono || row.empresa_email || "Sin contacto",
      },
      ultimaInspeccion,
    };

    return NextResponse.json({ ok: true, success: true, data });
  } catch (err) {
    console.error("Error API camion:", err);
    return NextResponse.json({ ok: false, error: "Error de servidor" }, { status: 500 });
  }
}
