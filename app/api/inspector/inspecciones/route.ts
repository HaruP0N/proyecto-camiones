import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
import { requireInspector } from "@/lib/shared/security/staff-auth";
import type { InspeccionState, NotaResultado } from "@/lib/inspection/types";

export const runtime = "nodejs";

/**
 * POST /api/inspector/inspecciones
 * Guardar una inspección completada con todos sus detalles
 */
export async function POST(req: NextRequest) {
  try {
    const session = requireInspector(req);
    if (!session || !session.userId) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as any;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    }

    const {
      inspeccionProgramadaId,
      camionId,
      estadoInspeccion,
      detalles,
      nota,
      resultado,
    } = body;

    // Validaciones básicas
    if (!Number.isInteger(camionId) || camionId <= 0) {
      return NextResponse.json({ ok: false, error: "camionId inválido" }, { status: 400 });
    }

    if (!Array.isArray(detalles)) {
      return NextResponse.json({ ok: false, error: "detalles debe ser un array" }, { status: 400 });
    }

    if (typeof nota !== "number" || nota < 0 || nota > 100) {
      return NextResponse.json({ ok: false, error: "nota inválida (0-100)" }, { status: 400 });
    }

    const pool = await getPool();

    // 1. Actualizar la inspección programada
    const inspeccionId = inspeccionProgramadaId || null;

    if (inspeccionId && Number.isInteger(inspeccionId)) {
      // Verificar que existe
      const check = await pool
        .request()
        .input("id", inspeccionId)
        .query(`
          SELECT TOP 1 id, camion_id
          FROM dbo.inspecciones
          WHERE id = @id AND estado = 'PROGRAMADA'
        `);

      if (check.recordset.length > 0) {
        // Actualizar con resultados
        await pool
          .request()
          .input("id", inspeccionId)
          .input("estado", estadoInspeccion || "COMPLETADA")
          .input("resultado", resultado || "APROBADO")
          .input("nota", nota)
          .input("inspector_id", session.userId)
          .input("fecha_inspeccion", new Date().toISOString())
          .query(`
            UPDATE dbo.inspecciones
            SET
              estado = @estado,
              resultado_general = @resultado,
              nota_final = @nota,
              inspector_id = @inspector_id,
              fecha_inspeccion = @fecha_inspeccion
            WHERE id = @id
          `);
      }
    }

    // 2. Guardar detalles de inspección
    for (const detalle of detalles) {
      const { itemId, estado, descripcionFalla, motivoNoAplica, fotos } = detalle;

      if (!itemId || !estado) continue;

      // Insertar detalle
      const detalleRes = await pool
        .request()
        .input("inspeccion_id", inspeccionId || null)
        .input("camion_id", camionId)
        .input("item_id", itemId)
        .input("estado", estado)
        .input("descripcion", descripcionFalla || null)
        .input("motivo_no_aplica", motivoNoAplica || null)
        .query(`
          INSERT INTO dbo.detalle_inspeccion
            (inspeccion_id, camion_id, item_id, estado, descripcion_falla, motivo_no_aplica)
          OUTPUT INSERTED.id
          VALUES
            (@inspeccion_id, @camion_id, @item_id, @estado, @descripcion, @motivo_no_aplica)
        `);

      const detalleId = detalleRes.recordset?.[0]?.id;

      // 3. Guardar fotos si existen
      if (Array.isArray(fotos) && fotos.length > 0 && detalleId) {
        for (const foto of fotos) {
          if (foto.base64 && foto.nombreArchivo) {
            await pool
              .request()
              .input("detalle_id", detalleId)
              .input("nombre_archivo", foto.nombreArchivo)
              .input("datos_binarios", Buffer.from(foto.base64, "base64"))
              .input("tipo_mime", foto.tipoMime || "image/jpeg")
              .input("fecha_captura", foto.fechaCaptura || new Date().toISOString())
              .query(`
                INSERT INTO dbo.fotos_inspeccion
                  (detalle_inspeccion_id, nombre_archivo, datos_binarios, tipo_mime, fecha_captura)
                VALUES
                  (@detalle_id, @nombre_archivo, @datos_binarios, @tipo_mime, @fecha_captura)
              `);
          }
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        inspeccionId,
        message: "Inspección guardada correctamente",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[API] POST /api/inspector/inspecciones error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

/**
 * GET /api/inspector/inspecciones
 * Obtener inspecciones del inspector actual
 */
export async function GET(req: NextRequest) {
  try {
    const session = requireInspector(req);
    if (!session || !session.userId) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const pool = await getPool();
    const inspectorId = session.userId;

    // Trae todas las inspecciones del día para el inspector
    const res = await pool
      .request()
      .input("inspectorId", inspectorId)
      .query(`
        SELECT i.id, i.camion_id, c.patente, i.estado, i.fecha_programada
        FROM dbo.inspecciones i
        INNER JOIN dbo.camiones c ON c.id = i.camion_id
        WHERE i.inspector_id = @inspectorId
          AND CAST(i.fecha_programada AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY i.fecha_programada DESC
      `);

    return NextResponse.json(
      {
        ok: true,
        inspecciones: res.recordset.map((x: any) => ({
          id: Number(x.id),
          camionId: Number(x.camion_id),
          patente: x.patente,
          estado: x.estado,
          resultado: x.resultado_general,
          nota: x.nota_final ?? null,
          fechaProgramada: x.fecha_programada,
          fechaInspeccion: x.fecha_inspeccion,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[API] GET /api/inspector/inspecciones error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
