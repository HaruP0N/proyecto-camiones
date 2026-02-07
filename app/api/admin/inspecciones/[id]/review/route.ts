import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";

export const runtime = "nodejs";

// =============================================================================
// 1. GET: PARA LEER LOS DATOS (Esto ya lo tenías, carga la inspección)
// =============================================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = await getPool();

    // 1. Cabecera
    const cabeceraQuery = `
      SELECT 
        i.id,
        i.fecha_inspeccion,
        i.nota_final,
        i.resultado_general,
        i.revision_admin,
        i.comentario_admin,
        c.patente,
        c.modelo,
        c.marca,
        e.nombre as empresa,
        u.nombre as inspector_nombre,
        u.email as inspector_email
      FROM dbo.inspecciones i
      LEFT JOIN dbo.camiones c ON c.id = i.camion_id
      LEFT JOIN dbo.proveedores p ON p.id = c.proveedor_id
      LEFT JOIN dbo.empresas e ON e.id = p.empresa_id
      LEFT JOIN dbo.usuarios u ON u.id = i.inspector_id
      WHERE i.id = @id
    `;
    const resultCabecera = await pool.request().input("id", id).query(cabeceraQuery);

    if (resultCabecera.recordset.length === 0) {
      return NextResponse.json({ error: "Inspección no encontrada" }, { status: 404 });
    }

    // 2. Detalles
    const detallesQuery = `
      SELECT 
        d.id, d.categoria, d.item_id, d.resultado as estado, 
        d.descripcion_falla as observaciones, d.motivo_no_aplica, d.seccion, d.nivel
      FROM dbo.detalle_inspeccion d
      WHERE d.inspeccion_id = @id
    `;
    const resultDetalles = await pool.request().input("id", id).query(detallesQuery);

    // 3. Fotos (con seguridad anti-caídas)
    let fotos: any[] = [];
    try {
      const fotosQuery = `
        SELECT f.nombre_archivo as url, f.fecha_captura, d.item_id, d.categoria
        FROM dbo.fotos_inspeccion f
        INNER JOIN dbo.detalle_inspeccion d ON f.detalle_inspeccion_id = d.id
        WHERE d.inspeccion_id = @id
      `;
      const resultFotos = await pool.request().input("id", id).query(fotosQuery);
      fotos = resultFotos.recordset;
    } catch (e) {
      console.warn("No se pudieron cargar fotos:", e);
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...resultCabecera.recordset[0],
        detalles: resultDetalles.recordset,
        fotos: fotos
      }
    });

  } catch (error) {
    console.error("GET Review Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// =============================================================================
// 2. POST: PARA GUARDAR LA DECISIÓN (ESTO ES LO QUE FALTABA)
// =============================================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, comentario } = body; // action será "ACEPTAR" o "RECHAZAR"

    const pool = await getPool();

    let nuevoEstadoRevision = "";
    let nuevoResultadoGeneral = "";

    // Definimos qué guardar según el botón que apretaste
    if (action === "ACEPTAR") {
        nuevoEstadoRevision = "APROBADA";   // El admin dio el visto bueno
        nuevoResultadoGeneral = "APROBADO"; // El camión pasa oficialmente
    } else if (action === "RECHAZAR") {
        nuevoEstadoRevision = "RECHAZADA";  // El admin rechazó
        nuevoResultadoGeneral = "RECHAZADO"; // El camión queda rechazado
    } else {
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }

    // Ejecutamos la actualización en la Base de Datos
    await pool.request()
        .input("id", id)
        .input("revision", nuevoEstadoRevision)
        .input("resultado", nuevoResultadoGeneral)
        .input("comentario", comentario || null) // Guardamos el motivo si hubo rechazo
        .query(`
            UPDATE dbo.inspecciones
            SET 
                revision_admin = @revision,
                resultado_general = @resultado,
                comentario_admin = @comentario
            WHERE id = @id
        `);

    return NextResponse.json({ ok: true, message: "Decisión guardada correctamente" });

  } catch (error) {
    console.error("POST Review Error:", error);
    return NextResponse.json({ error: "Error al guardar la decisión" }, { status: 500 });
  }
}