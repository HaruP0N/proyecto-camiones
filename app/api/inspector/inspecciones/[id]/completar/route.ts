// app/api/inspector/inspecciones/[id]/completar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
import { requireInspector } from "@/lib/shared/security/staff-auth";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: camion_id_param } = await params;
    const camion_id = Number(camion_id_param);

    const session = requireInspector(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const inspector_id = session.userId;
    const body = await req.json();
    const { respuestas, notaFinal, observacionesGenerales, fotos_evidencia } = body;

    const pool = await getPool();

    // 1. Validar que la inspección existe y es del inspector
    const inspeccionCheck = await pool
      .request()
      .input("camion_id", camion_id)
      .input("inspector_id", inspector_id)
      .query(`
        SELECT id FROM inspecciones
        WHERE camion_id = @camion_id
        AND inspector_id = @inspector_id
        AND estado = 'PROGRAMADA'
      `);

    if (inspeccionCheck.recordset.length === 0) {
      return NextResponse.json({ error: "Inspección no disponible." }, { status: 404 });
    }

    const inspeccion_id = inspeccionCheck.recordset[0].id;

    // 2. ACTUALIZACIÓN CLAVE:
    // El estado pasa a REALIZADA (Inspector terminó), 
    // pero el resultado queda PENDIENTE para que el Admin decida.
    await pool
      .request()
      .input("inspeccion_id", inspeccion_id)
      .input("notaFinal", notaFinal || 0) // Guardamos la nota sugerida, pero no decide
      .input("observaciones", observacionesGenerales || null)
      .input("fechaCompletacion", new Date())
      .query(`
        UPDATE inspecciones
        SET
          nota_final = @notaFinal,
          resultado_detallado = @observaciones,
          estado = 'REALIZADA',           -- El inspector ya cumplió
          fecha_inspeccion = @fechaCompletacion,
          resultado_general = 'PENDIENTE', -- <--- CAMBIO IMPORTANTE: Espera al Admin
          revision_admin = 'PENDIENTE'     -- <--- CAMBIO IMPORTANTE: Flag para el dashboard Admin
        WHERE id = @inspeccion_id
      `);

    // 3. Guardar los detalles (Respuestas)
    for (const respuesta of respuestas) {
      const { itemId, estado, descripcionFalla, motivoNoAplica, categoria = "General", nivel = 1, seccion = "General" } = respuesta;

      // Upsert de detalles
      const exists = await pool.request()
        .input("inspeccion_id", inspeccion_id)
        .input("item_id", itemId)
        .query(`SELECT id FROM detalle_inspeccion WHERE inspeccion_id = @inspeccion_id AND item_id = @item_id`);

      const reqDetalle = pool.request()
        .input("inspeccion_id", inspeccion_id)
        .input("camion_id", camion_id)
        .input("item_id", itemId)
        .input("resultado", estado)
        .input("estado_item", estado)
        .input("descripcion", descripcionFalla || null)
        .input("observacion", descripcionFalla || null)
        .input("motivo", motivoNoAplica || null)
        .input("categoria", categoria)
        .input("nivel", nivel)
        .input("seccion", seccion);

      if (exists.recordset.length > 0) {
        reqDetalle.input("detalle_id", exists.recordset[0].id);
        await reqDetalle.query(`
          UPDATE detalle_inspeccion SET resultado=@resultado, estado_item=@estado_item, descripcion_falla=@descripcion, observacion=@observacion, motivo_no_aplica=@motivo, categoria=@categoria, nivel=@nivel, seccion=@seccion WHERE id=@detalle_id
        `);
      } else {
        await reqDetalle.query(`
          INSERT INTO detalle_inspeccion (inspeccion_id, camion_id, item_id, resultado, estado_item, descripcion_falla, observacion, motivo_no_aplica, categoria, nivel, seccion)
          VALUES (@inspeccion_id, @camion_id, @item_id, @resultado, @estado_item, @descripcion, @observacion, @motivo, @categoria, @nivel, @seccion)
        `);
      }
    }

    // 4. Guardar Fotos
    if (fotos_evidencia && Array.isArray(fotos_evidencia)) {
      for (const foto_url of fotos_evidencia) {
        await pool.request()
          .input("inspeccion_id", inspeccion_id)
          .input("url", foto_url)
          .input("fecha", new Date())
          .query(`INSERT INTO fotos_inspeccion (inspeccion_id, nombre_archivo, fecha_captura) VALUES (@inspeccion_id, @url, @fecha)`);
      }
    }

    return NextResponse.json({ success: true, message: "Enviado a revisión" });

  } catch (error) {
    console.error("Error API Completar:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}





