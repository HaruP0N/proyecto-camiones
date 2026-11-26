import { getPool, Transaction } from "../database";
import { z } from "zod";

const Photo = z.object({
  url: z.string().url().optional(),
  base64: z.string().optional(),
  itemId: z.union([z.string(), z.number()]).optional(),
  nombreArchivo: z.string().optional(),
  tipoMime: z.string().optional(),
  fechaCaptura: z.string().datetime().optional(),
  latitud: z.number().min(-90).max(90).nullable().optional(),
  longitud: z.number().min(-180).max(180).nullable().optional(),
});
const Answer = z.object({
  itemId: z.union([z.string().min(1), z.number()]).transform(String),
  estado: z.string().transform(value => value.trim().toLowerCase()).pipe(z.enum(["cumple", "no_cumple", "no_aplica", "aprobado", "rechazado", "observado", "ok"])),
  descripcionFalla: z.string().nullable().optional(),
  motivoNoAplica: z.string().nullable().optional(),
  categoria: z.string().optional(),
  nivel: z.coerce.number().int().min(1).max(4).default(1),
  seccion: z.string().default("General"),
  fotos: z.array(Photo).optional(),
});
const Submission = z.object({
  camionId: z.number().int().positive(),
  inspeccionId: z.number().int().positive().optional(),
  respuestas: z.array(Answer).min(1).max(1000),
  notaFinal: z.number().min(0).max(100),
  observacionesGenerales: z.string().nullable().optional(),
  fotos_evidencia: z.array(z.union([z.string().url(), Photo])).optional(),
});

export class InspectionError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function category(value: string | undefined, section: string) {
  const source = (!value || value.startsWith("cat_") ? section : value).toLowerCase();
  const names: [RegExp, string][] = [
    [/fr[ií]o|reefer/, "Sistema de Frío"], [/carrocer[ií]a/, "Carrocería"],
    [/estructura|chasis/, "Chasis y Estructura"], [/acople|quinta/, "Acople / Quinta Rueda"],
    [/neum[aá]tic/, "Neumáticos y Ruedas"], [/freno/, "Frenos"],
    [/luces|se[nñ]al/, "Luces y Señalización"], [/document/, "Documentación"],
    [/fluidos/, "Sistema de Fluidos"], [/suspensi[oó]n/, "Suspensión"],
    [/cabina/, "Cabina"], [/seguridad/, "Equipo de Seguridad"],
    [/el[eé]ctrico|cableado/, "Sistema Eléctrico"], [/acceso/, "Accesos"],
    [/est[eé]tic|confort/, "Estético / Confort"], [/compart/, "Compartimientos"],
  ];
  return names.find(([pattern]) => pattern.test(source))?.[1] ?? value ?? "General";
}

/** Both inspector forms share ownership checks, retries, and a single atomic write. */
export async function saveInspection(inspectorId: number, input: unknown) {
  const parsed = Submission.safeParse(input);
  if (!parsed.success) throw new InspectionError("Datos de inspección inválidos", 400);
  const data = parsed.data;
  if (new Set(data.respuestas.map(r => r.itemId)).size !== data.respuestas.length) {
    throw new InspectionError("Hay ítems de inspección duplicados", 400);
  }
  const tx = new Transaction(await getPool());
  await tx.begin();
  try {
    const check = await tx.request()
      .input("camionId", data.camionId).input("inspectorId", inspectorId)
      .input("inspeccionId", data.inspeccionId ?? null)
      .query(`
        SELECT id FROM public.inspecciones
        WHERE camion_id = @camionId
          AND (@inspeccionId::integer IS NULL OR id = @inspeccionId)
          AND (inspector_id = @inspectorId OR inspector_id IS NULL)
          AND (estado = 'PROGRAMADA' OR (estado = 'REALIZADA' AND resultado_general = 'PENDIENTE' AND revision_admin = 'PENDIENTE'))
        ORDER BY fecha_programada DESC, id DESC LIMIT 1 FOR UPDATE
      `);
    const id = check.recordset[0]?.id;
    if (!id) throw new InspectionError("Inspección no disponible o ya finalizada", 404);
    const detailIds = new Map<string, number>();
    const photos: Array<z.infer<typeof Photo>> = [];
    for (const answer of data.respuestas) {
      const result = ["no_cumple", "rechazado", "observado"].includes(answer.estado) ? "no_cumple"
        : answer.estado === "no_aplica" ? "no_aplica" : "cumple";
      const detail = await tx.request()
        .input("id", id).input("camionId", data.camionId).input("itemId", answer.itemId)
        .input("resultado", result).input("descripcion", answer.descripcionFalla ?? null)
        .input("motivo", answer.motivoNoAplica ?? null).input("nivel", answer.nivel)
        .input("seccion", answer.seccion).input("categoria", category(answer.categoria, answer.seccion))
        .query(`
          INSERT INTO public.detalle_inspeccion
            (inspeccion_id, camion_id, item_id, resultado, estado_item, descripcion_falla, motivo_no_aplica, nivel, seccion, categoria)
          VALUES (@id, @camionId, @itemId, @resultado, @resultado, @descripcion, @motivo, @nivel, @seccion, @categoria)
          ON CONFLICT (inspeccion_id, item_id) DO UPDATE SET
            resultado = EXCLUDED.resultado, estado_item = EXCLUDED.estado_item,
            descripcion_falla = EXCLUDED.descripcion_falla, motivo_no_aplica = EXCLUDED.motivo_no_aplica,
            nivel = EXCLUDED.nivel, seccion = EXCLUDED.seccion, categoria = EXCLUDED.categoria
          RETURNING id
        `);
      detailIds.set(answer.itemId, detail.recordset[0].id);
      for (const photo of answer.fotos ?? []) photos.push({ ...photo, itemId: answer.itemId });
    }
    for (const photo of data.fotos_evidencia ?? []) photos.push(typeof photo === "string" ? { url: photo } : photo);
    for (const photo of photos) {
      const detailId = photo.itemId === undefined ? detailIds.values().next().value : detailIds.get(String(photo.itemId));
      if (!detailId || (!photo.url && !photo.base64)) throw new InspectionError("Evidencia sin ítem o archivo válido", 400);
      await tx.request().input("detalleId", detailId)
        .input("nombre", photo.nombreArchivo ?? photo.url?.split("/").pop() ?? "evidencia.jpg")
        .input("url", photo.url ?? null).input("datos", photo.base64 ? Buffer.from(photo.base64, "base64") : null)
        .input("mime", photo.tipoMime ?? "image/jpeg").input("fecha", photo.fechaCaptura ?? new Date())
        .input("latitud", photo.latitud ?? null).input("longitud", photo.longitud ?? null)
        .query(`
          INSERT INTO public.fotos_inspeccion
            (detalle_inspeccion_id, nombre_archivo, url_archivo, datos_binarios, tipo_mime, fecha_captura, latitud, longitud)
          SELECT @detalleId, @nombre, @url, @datos, @mime, @fecha, @latitud, @longitud
          WHERE NOT EXISTS (
            SELECT 1 FROM public.fotos_inspeccion WHERE detalle_inspeccion_id = @detalleId
              AND nombre_archivo = @nombre AND url_archivo IS NOT DISTINCT FROM @url::text
          )
        `);
    }
    await tx.request().input("id", id).input("inspectorId", inspectorId)
      .input("nota", data.notaFinal).input("observaciones", data.observacionesGenerales ?? null)
      .query(`
        UPDATE public.inspecciones SET estado = 'REALIZADA', resultado_general = 'PENDIENTE',
          revision_admin = 'PENDIENTE', fecha_inspeccion = CURRENT_TIMESTAMP, fecha_realizada = CURRENT_TIMESTAMP,
          nota_final = @nota, resultado_detallado = @observaciones, observaciones_generales = @observaciones,
          inspector_id = COALESCE(inspector_id, @inspectorId)
        WHERE id = @id
      `);
    await tx.commit();
    return id;
  } catch (error) { await tx.rollback(); throw error; }
}
