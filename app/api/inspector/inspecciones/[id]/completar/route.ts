// app/api/inspector/inspecciones/[id]/completar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/azure-sql";
import { requireInspector } from "@/lib/shared/security/staff-auth";

export const runtime = "nodejs";

async function getDetalleSchema(pool: any) {
  const colsRes = await pool.request().query(`
    SELECT c.name, c.is_identity
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('dbo.detalle_inspeccion')
  `);
  const columns = new Set<string>(colsRes.recordset.map((r: any) => r.name));
  const identityRow = colsRes.recordset.find((r: any) => r.is_identity);
  const idColumn = identityRow?.name || (columns.has("id") ? "id" : colsRes.recordset[0]?.name);
  return { columns, idColumn };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

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

    // 0. Descubrir columnas reales en detalle_inspeccion (tu BD no coincide con el repo)
    const detalleSchema = await getDetalleSchema(pool);
    const col = (cands: string[]) => cands.find((c) => detalleSchema.columns.has(c));
    const colInspeccion = col(["inspeccion_id", "id_inspeccion", "inspeccionId"]);
    const colCamion = col(["camion_id", "id_camion", "camionId", "vehiculo_id", "id_vehiculo"]);
    const colItem = col(["item_id", "id_item", "itemId"]);
    const colResultado = col(["resultado"]);
    const colEstadoItem = col(["estado_item", "estado"]);
    const colDescripcion = col(["descripcion_falla", "descripcion"]);
    const colObservacion = col(["observacion", "observaciones"]);
    const colMotivo = col(["motivo_no_aplica", "motivo"]);
    const colCategoria = col(["categoria"]);
    const colNivel = col(["nivel"]);
    const colSeccion = col(["seccion"]);

    if (!colInspeccion || !colItem || !colResultado) {
      return NextResponse.json(
        {
          error: "Schema detalle_inspeccion incompatible.",
          columns: Array.from(detalleSchema.columns),
        },
        { status: 500 }
      );
    }

    // 1. Validar que la inspección existe (acepta reintentos)
    const inspeccionCheck = await pool
      .request()
      .input("camion_id", camion_id)
      .input("inspector_id", inspector_id)
      .query(`
        SELECT TOP 1 id, inspector_id, estado
        FROM inspecciones
        WHERE camion_id = @camion_id
          AND (estado = 'PROGRAMADA' OR (estado = 'REALIZADA' AND resultado_general = 'PENDIENTE'))
          AND (inspector_id = @inspector_id OR inspector_id IS NULL)
        ORDER BY fecha_programada DESC
      `);

    if (inspeccionCheck.recordset.length === 0) {
      return NextResponse.json({ error: "Inspección no disponible o ya finalizada." }, { status: 404 });
    }

    const inspeccion_id = inspeccionCheck.recordset[0].id;

    // --- INICIO TRANSACCIÓN ---
    await transaction.begin();

    // 2. Guardar detalles (respuestas) con valores válidos según constraint
    const detalleByItemId = new Map<string, number>();
    for (const respuesta of respuestas) {
      const { itemId, estado, descripcionFalla, motivoNoAplica, categoria = "General", nivel = 1, seccion = "General" } = respuesta;
      const estadoRaw = String(estado || "").toLowerCase();

      // Mapear a valores aceptados por CK_detalle_resultado
      // ('cumple' | 'no_cumple' | 'no_aplica')
      let resultadoDb = "cumple";
      if (estadoRaw.includes("rechaza") || estadoRaw.includes("falla") || estadoRaw.includes("no_cumple")) {
        resultadoDb = "no_cumple";
      } else if (estadoRaw.includes("no_aplica")) {
        resultadoDb = "no_aplica";
      } else if (estadoRaw.includes("observado")) {
        resultadoDb = "no_cumple";
      } else if (estadoRaw.includes("cumple") || estadoRaw.includes("aprobado") || estadoRaw === "ok") {
        resultadoDb = "cumple";
      }

      const exists = await new sql.Request(transaction)
        .input("check_inspeccion_id", inspeccion_id)
        .input("check_item_id", itemId)
        .query(`SELECT TOP 1 ${detalleSchema.idColumn} AS id FROM detalle_inspeccion WHERE ${colInspeccion} = @check_inspeccion_id AND ${colItem} = @check_item_id`);

      const categoriaSource =
        String(categoria || "").toLowerCase().startsWith("cat_")
          ? String(seccion || "").toLowerCase()
          : String(categoria || "").toLowerCase();
      const categoriaRaw = categoriaSource || "";
      let categoriaDb: string = "General";
      if (categoriaRaw.includes("frio") || categoriaRaw.includes("reefer")) {
        categoriaDb = "Sistema de Frío";
      } else if (categoriaRaw.includes("carroceria")) {
        categoriaDb = "Carrocería";
      } else if (categoriaRaw.includes("estructura") || categoriaRaw.includes("chasis")) {
        categoriaDb = "Chasis y Estructura";
      } else if (categoriaRaw.includes("acople") || categoriaRaw.includes("quinta")) {
        categoriaDb = "Acople / Quinta Rueda";
      } else if (categoriaRaw.includes("neumatic")) {
        categoriaDb = "Neumáticos y Ruedas";
      } else if (categoriaRaw.includes("freno")) {
        categoriaDb = "Frenos";
      } else if (categoriaRaw.includes("luces") || categoriaRaw.includes("senalizacion") || categoriaRaw.includes("señal")) {
        categoriaDb = "Luces y Señalización";
      } else if (categoriaRaw.includes("document")) {
        categoriaDb = "Documentación";
      } else if (categoriaRaw.includes("fluidos")) {
        categoriaDb = "Sistema de Fluidos";
      } else if (categoriaRaw.includes("suspension")) {
        categoriaDb = "Suspensión";
      } else if (categoriaRaw.includes("cabina")) {
        categoriaDb = "Cabina";
      } else if (categoriaRaw.includes("seguridad")) {
        categoriaDb = "Equipo de Seguridad";
      } else if (categoriaRaw.includes("electrico") || categoriaRaw.includes("eléctrico") || categoriaRaw.includes("cableado")) {
        categoriaDb = "Sistema Eléctrico";
      } else if (categoriaRaw.includes("acceso")) {
        categoriaDb = "Accesos";
      } else if (categoriaRaw.includes("estetica") || categoriaRaw.includes("estético") || categoriaRaw.includes("confort")) {
        categoriaDb = "Estético / Confort";
      } else if (categoriaRaw.includes("compart")) {
        categoriaDb = "Compartimientos";
      }

      const reqDetalle = new sql.Request(transaction);
      reqDetalle.input("inspeccion_id", inspeccion_id);
      reqDetalle.input("camion_id", camion_id);
      reqDetalle.input("item_id", itemId);
      reqDetalle.input("resultado", resultadoDb);
      reqDetalle.input("estado_item", resultadoDb);
      reqDetalle.input("descripcion", descripcionFalla || null);
      reqDetalle.input("observacion", descripcionFalla || null);
      reqDetalle.input("motivo", motivoNoAplica || null);
      reqDetalle.input("categoria", categoriaDb);
      reqDetalle.input("nivel", nivel);
      reqDetalle.input("seccion", seccion);

      if (exists.recordset.length > 0) {
        reqDetalle.input("detalle_id", exists.recordset[0].id);
        const sets: string[] = [];
        if (colResultado) sets.push(`${colResultado}=@resultado`);
        if (colEstadoItem) sets.push(`${colEstadoItem}=@estado_item`);
        if (colDescripcion) sets.push(`${colDescripcion}=@descripcion`);
        if (colObservacion) sets.push(`${colObservacion}=@observacion`);
        if (colMotivo) sets.push(`${colMotivo}=@motivo`);
        if (colCategoria) sets.push(`${colCategoria}=@categoria`);
        if (colNivel) sets.push(`${colNivel}=@nivel`);
        if (colSeccion) sets.push(`${colSeccion}=@seccion`);
        const updateSql = `UPDATE detalle_inspeccion SET ${sets.join(", ")} WHERE ${detalleSchema.idColumn}=@detalle_id`;
        await reqDetalle.query(updateSql);
        detalleByItemId.set(String(itemId), Number(exists.recordset[0].id));
      } else {
        const insertCols: string[] = [];
        const insertVals: string[] = [];
        insertCols.push(colInspeccion); insertVals.push("@inspeccion_id");
        if (colCamion) { insertCols.push(colCamion); insertVals.push("@camion_id"); }
        insertCols.push(colItem); insertVals.push("@item_id");
        insertCols.push(colResultado); insertVals.push("@resultado");
        if (colEstadoItem) { insertCols.push(colEstadoItem); insertVals.push("@estado_item"); }
        if (colDescripcion) { insertCols.push(colDescripcion); insertVals.push("@descripcion"); }
        if (colObservacion) { insertCols.push(colObservacion); insertVals.push("@observacion"); }
        if (colMotivo) { insertCols.push(colMotivo); insertVals.push("@motivo"); }
        if (colCategoria) { insertCols.push(colCategoria); insertVals.push("@categoria"); }
        if (colNivel) { insertCols.push(colNivel); insertVals.push("@nivel"); }
        if (colSeccion) { insertCols.push(colSeccion); insertVals.push("@seccion"); }

        const insertSql = `INSERT INTO detalle_inspeccion (${insertCols.join(", ")}) VALUES (${insertVals.join(", ")})`;
        await reqDetalle.query(insertSql);
        const idRes = await new sql.Request(transaction)
          .input("inspeccion_id", inspeccion_id)
          .input("item_id", itemId)
          .query(`SELECT TOP 1 ${detalleSchema.idColumn} AS id FROM detalle_inspeccion WHERE ${colInspeccion}=@inspeccion_id AND ${colItem}=@item_id ORDER BY ${detalleSchema.idColumn} DESC`);
        const newId = idRes.recordset?.[0]?.id;
        if (newId) detalleByItemId.set(String(itemId), Number(newId));
      }
    }

    // 3. Guardar fotos
    if (fotos_evidencia && Array.isArray(fotos_evidencia)) {
      const defaultDetalleId = detalleByItemId.values().next().value;
      for (const foto of fotos_evidencia) {
        const url = typeof foto === "string" ? foto : foto.url;
        const itemId = typeof foto === "string" ? undefined : foto.itemId;
        const detalleId = itemId ? detalleByItemId.get(String(itemId)) : defaultDetalleId;
        if (!detalleId) continue;
        const nombreArchivo = typeof foto === "string" ? (url.split("/").pop() || url) : (foto.nombreArchivo || url.split("/").pop() || url);
        const latitud = typeof foto === "string" ? null : (foto.latitud ?? null);
        const longitud = typeof foto === "string" ? null : (foto.longitud ?? null);
        const tipoMime = typeof foto === "string" ? "image/jpeg" : (foto.tipoMime || "image/jpeg");

        await new sql.Request(transaction)
          .input("detalleInspeccionId", detalleId)
          .input("nombreArchivo", nombreArchivo)
          .input("urlArchivo", url)
          .input("latitud", latitud)
          .input("longitud", longitud)
          .input("tipoMime", tipoMime)
          .query(`EXEC dbo.sp_agregar_foto_inspeccion @detalleInspeccionId, @nombreArchivo, @urlArchivo, @latitud, @longitud, @tipoMime`);
      }
    }

    // 4. Actualizar estado de inspección (al final)
    await new sql.Request(transaction)
      .input("inspeccion_id", inspeccion_id)
      .input("notaFinal", notaFinal || 0)
      .input("observaciones", observacionesGenerales || null)
      .input("fechaCompletacion", new Date())
      .input("inspector_id", inspector_id)
      .query(`
        UPDATE inspecciones
        SET
          nota_final = @notaFinal,
          resultado_detallado = @observaciones,
          estado = 'REALIZADA',
          fecha_inspeccion = @fechaCompletacion,
          resultado_general = 'PENDIENTE',
          revision_admin = 'PENDIENTE',
          inspector_id = COALESCE(inspector_id, @inspector_id)
        WHERE id = @inspeccion_id
      `);

    await transaction.commit();

    return NextResponse.json({ success: true, message: "Enviado a revisión" });

  } catch (error: any) {
    console.error("Error API Completar:", error);
    try {
      if (transaction) await transaction.rollback();
    } catch (rollbackError) {
      console.error("Error haciendo rollback:", rollbackError);
    }
    if (error?.message && error.message.includes("CHECK constraint")) {
      return NextResponse.json({ error: "Error de base de datos: Valor de estado no permitido." }, { status: 500 });
    }
    return NextResponse.json({ error: error?.message || "Error interno" }, { status: 500 });
  }
}
