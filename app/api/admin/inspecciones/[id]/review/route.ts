import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool } from "@/lib/azure-sql";
import { requireAdmin } from "@/lib/shared/security/staff-auth";

export const runtime = "nodejs";

// =============================================================================
// 1. GET: PARA LEER LOS DATOS (Esto ya lo tenías, carga la inspección)
// =============================================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const pool = await getPool();

    // 1. Cabecera
    const cabeceraQuery = `
      SELECT 
        i.id,
        i.inspector_id,
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
      IF COL_LENGTH('dbo.detalle_inspeccion', 'resultado_admin') IS NULL
      BEGIN
        SELECT 
          d.id,
          d.categoria,
          d.item_id AS itemId,
          d.resultado AS estado,
          d.descripcion_falla AS descripcionFalla,
          d.motivo_no_aplica AS motivoNoAplica,
          d.seccion,
          d.nivel,
          CAST(NULL AS varchar(20)) AS estadoAdmin,
          CAST(NULL AS nvarchar(2000)) AS comentarioAdmin
        FROM dbo.detalle_inspeccion d
        WHERE d.inspeccion_id = @id
      END
      ELSE
      BEGIN
        SELECT 
          d.id,
          d.categoria,
          d.item_id AS itemId,
          d.resultado AS estado,
          d.descripcion_falla AS descripcionFalla,
          d.motivo_no_aplica AS motivoNoAplica,
          d.seccion,
          d.nivel,
          d.resultado_admin AS estadoAdmin,
          d.comentario_admin AS comentarioAdmin
        FROM dbo.detalle_inspeccion d
        WHERE d.inspeccion_id = @id
      END
    `;
    const resultDetalles = await pool.request().input("id", id).query(detallesQuery);

    // 3. Fotos (con seguridad anti-caídas)
    let fotos: any[] = [];
    try {
      const fotosQuery = `
        SELECT 
          COALESCE(f.url_archivo, f.nombre_archivo) as url,
          f.nombre_archivo,
          f.fecha_captura, 
          d.item_id, 
          d.categoria
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
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, comentario, items, reagenda, edits } = body;

    const pool = await getPool();

    let nuevoEstadoRevision = "";
    let nuevoResultadoGeneral = "";

    // Definimos qué guardar según el botón
    let nuevoEstadoInspeccion: "REALIZADA" | "CANCELADA" = "REALIZADA";

    if (action === "ACEPTAR" || action === "ACEPTAR_OK") {
      nuevoEstadoRevision = "APROBADA_OK";
      nuevoResultadoGeneral = "APROBADO";
    } else if (action === "ACEPTAR_FALLAS") {
      nuevoEstadoRevision = "APROBADA_CON_FALLAS";
      nuevoResultadoGeneral = "OBSERVADO";
    } else if (action === "RECHAZAR") {
      nuevoEstadoRevision = "RECHAZADA";
      nuevoResultadoGeneral = "RECHAZADO";
    } else if (action === "REAGENDAR") {
      nuevoEstadoRevision = "REAGENDADA";
      nuevoResultadoGeneral = "RECHAZADO";
    } else if (action === "ANULAR") {
      nuevoEstadoRevision = "ANULADA";
      nuevoResultadoGeneral = "RECHAZADO";
      nuevoEstadoInspeccion = "CANCELADA";
    } else {
      return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // 1) Guardar overrides por item si vienen
      if (Array.isArray(items) && items.length > 0) {
        const hasColsRes = await tx
          .request()
          .query(`SELECT IIF(COL_LENGTH('dbo.detalle_inspeccion','resultado_admin') IS NULL, 0, 1) AS hasCols`);
        const hasAdminCols = Boolean(hasColsRes.recordset?.[0]?.hasCols);

        for (const item of items) {
          const detalleId = Number(item?.id);
          if (!Number.isInteger(detalleId) || detalleId <= 0) continue;
          const estadoAdmin = typeof item?.estadoAdmin === "string" && item.estadoAdmin.trim() ? item.estadoAdmin.trim() : null;
          const comentarioAdmin = typeof item?.comentarioAdmin === "string" && item.comentarioAdmin.trim()
            ? item.comentarioAdmin.trim()
            : null;
          const estadoAdminRaw = String(estadoAdmin || "").toLowerCase();
          const resultadoDb =
            estadoAdminRaw === "aprobado" ? "cumple" :
            estadoAdminRaw === "rechazado" ? "no_cumple" :
            estadoAdminRaw === "no_aplica" ? "no_aplica" :
            null;

          if (hasAdminCols) {
            await tx
              .request()
              .input("detalleId", detalleId)
              .input("inspeccionId", id)
              .input("estadoAdmin", estadoAdmin)
              .input("comentarioAdmin", comentarioAdmin)
              .input("resultadoDb", resultadoDb)
              .query(`
                UPDATE dbo.detalle_inspeccion
                SET resultado_admin = @estadoAdmin,
                    comentario_admin = @comentarioAdmin,
                    resultado = COALESCE(@resultadoDb, resultado),
                    estado_item = COALESCE(@resultadoDb, estado_item)
                WHERE id = @detalleId AND inspeccion_id = @inspeccionId
              `);
          } else {
            await tx
              .request()
              .input("detalleId", detalleId)
              .input("inspeccionId", id)
              .input("estadoAdmin", estadoAdmin)
              .input("comentarioAdmin", comentarioAdmin)
              .input("resultadoDb", resultadoDb)
              .query(`
                UPDATE dbo.detalle_inspeccion
                SET resultado = COALESCE(@resultadoDb, resultado),
                    estado_item = COALESCE(@resultadoDb, estado_item),
                    descripcion_falla = COALESCE(@comentarioAdmin, descripcion_falla)
                WHERE id = @detalleId AND inspeccion_id = @inspeccionId
              `);
          }
        }
      }

      // 2) Actualizar inspección
      const reqUpd = tx
        .request()
        .input("id", id)
        .input("revision", nuevoEstadoRevision)
        .input("resultado", nuevoResultadoGeneral)
        .input("estado", nuevoEstadoInspeccion)
        .input("comentario", comentario || null)
        .input("resultado_edit", null)
        .input("nota", null);

      if (edits && typeof edits === "object") {
        if (typeof edits.nota === "number") reqUpd.input("nota", edits.nota);
        if (typeof edits.resultado === "string") reqUpd.input("resultado_edit", edits.resultado);
      }

      await reqUpd.query(`
        UPDATE dbo.inspecciones
        SET 
          revision_admin = @revision,
          resultado_general = COALESCE(@resultado_edit, @resultado),
          estado = @estado,
          comentario_admin = @comentario,
          nota_final = COALESCE(@nota, nota_final)
        WHERE id = @id
      `);

      // 3) Si corresponde reagendar, crear nueva inspección
      if (action === "REAGENDAR") {
        const camionRes = await tx
          .request()
          .input("id", id)
          .query(`SELECT TOP 1 camion_id, inspector_id FROM dbo.inspecciones WHERE id = @id`);

        if (camionRes.recordset.length === 0) {
          throw new Error("No se encontró el camión para reagendar.");
        }
        const camionId = Number(camionRes.recordset[0].camion_id);

        const fechaInput = typeof reagenda?.fechaProgramada === "string" ? reagenda.fechaProgramada.trim() : "";
        if (!fechaInput) {
          throw new Error("fechaProgramada requerida para reagendar.");
        }
        const fechaProgramada = fechaInput.includes("T") ? fechaInput : `${fechaInput}T09:00:00`;

        const inspectorIdRaw = reagenda?.inspectorId;
        const inspectorId =
          inspectorIdRaw === null || inspectorIdRaw === undefined || inspectorIdRaw === ""
            ? null
            : Number(inspectorIdRaw);

        const obs = typeof reagenda?.observaciones === "string" ? reagenda.observaciones.trim() : null;

        // Validar inspector si viene
        if (inspectorId !== null && (!Number.isInteger(inspectorId) || inspectorId <= 0)) {
          throw new Error("inspectorId inválido.");
        }

        // Evitar duplicados programados
        const dup = await tx
          .request()
          .input("camionId", camionId)
          .query(`SELECT TOP 1 id FROM dbo.inspecciones WHERE camion_id = @camionId AND estado = 'PROGRAMADA'`);
        if (dup.recordset.length > 0) {
          throw new Error("El camión ya tiene una inspección programada activa.");
        }

        const insertRes = await tx
          .request()
          .input("camionId", camionId)
          .input("inspectorId", inspectorId)
          .input("fechaProgramada", new Date(fechaProgramada))
          .input("obs", obs || comentario || null)
          .query(`
            INSERT INTO dbo.inspecciones 
              (camion_id, inspector_id, fecha_programada, fecha_inspeccion, estado, resultado_general, observaciones_generales, revision_admin, comentario_admin)
            OUTPUT INSERTED.id AS id
            VALUES 
              (@camionId, @inspectorId, @fechaProgramada, @fechaProgramada, 'PROGRAMADA', 'PENDIENTE', @obs, 'REAGENDADA', @obs)
          `);

        const newInspeccionId = insertRes.recordset?.[0]?.id;
        const notifInspectorId = inspectorId ?? camionRes.recordset?.[0]?.inspector_id ?? null;
        if (notifInspectorId) {
          await tx
            .request()
            .input("usuarioId", notifInspectorId)
            .input("inspeccionId", newInspeccionId || null)
            .input("titulo", "Inspección reagendada")
            .input("mensaje", obs || comentario || `Inspección reagendada para ${fechaProgramada}`)
            .query(`
              INSERT INTO dbo.notificaciones (usuario_id, inspeccion_id, tipo, titulo, mensaje, leida, created_at)
              VALUES (@usuarioId, @inspeccionId, 'REAGENDADA', @titulo, @mensaje, 0, SYSDATETIME())
            `);
        }
      }

      await tx.commit();
      return NextResponse.json({ ok: true, message: "Decisión guardada correctamente" });
    } catch (err) {
      await tx.rollback();
      throw err;
    }

  } catch (error) {
    console.error("POST Review Error:", error);
    return NextResponse.json({ error: "Error al guardar la decisión" }, { status: 500 });
  }
}
