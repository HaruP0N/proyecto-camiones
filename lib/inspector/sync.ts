import db from "@/lib/inspector/db";
import { CATEGORIAS } from "@/lib/inspector/inspection-items";

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;
const ENV_API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
// En browser siempre usamos el mismo origen para evitar CORS
const API_BASE =
  typeof window !== "undefined"
    ? window.location.origin
    : ENV_API_BASE;
const API_URL = API_BASE ? `${API_BASE}/api` : "/api";

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
const MAX_INTENTOS = 5;

let syncStarted = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;
const globalScope = globalThis as unknown as {
  __petranSyncStarted?: boolean;
  __petranSyncInterval?: ReturnType<typeof setInterval>;
  __petranSyncOnlineListener?: boolean;
  __petranSyncLastError?: string;
};

const categoriaMap = new Map(CATEGORIAS.map((c) => [c.id, c]));

function mapEstadoRemoto(estado: unknown) {
  const s = String(estado || "").toLowerCase();
  if (s.includes("program")) return "programada";
  if (s.includes("progreso") || s.includes("curso")) return "en_curso";
  if (s.includes("realizada") || s.includes("complet")) return "sincronizado";
  return "programada";
}

// ==========================================
// 1. DESCARGAR ASIGNACIONES
// ==========================================
export async function descargarAsignaciones() {
  try {
    const response = await fetch(`${API_URL}/inspector/inspecciones/hoy`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Error al descargar asignaciones");

    const payload = await response.json();
    const tareasBackend = Array.isArray(payload?.data) ? payload.data : [];

    if (tareasBackend.length === 0) return;

    await db.transaction("rw", db.inspecciones, async () => {
      for (const tarea of tareasBackend) {
        const existing = await db.inspecciones.get(tarea.id);
        const estadoLocal = existing?.estado_sincronizacion;
        const estado_sincronizacion =
          estadoLocal === "en_curso" || estadoLocal === "pendiente_sync"
            ? estadoLocal
            : mapEstadoRemoto(tarea.estado);

        await db.inspecciones.put({
          ...(existing || {}),
          id: tarea.id,
          camion_id: tarea.camion_id,
          patente: tarea.patente,
          patente_sistema: tarea.patente,
          marca: tarea.marca,
          modelo: tarea.modelo,
          fecha_hora_programada: tarea.fecha_programada,
          fecha_hora_inicio: existing?.fecha_hora_inicio || null,
          estado_sincronizacion,
          nombre_cliente: tarea.empresa_nombre,
          telefono_cliente: tarea.telefono_cliente || null,
          ubicacion: tarea.ubicacion || null,
          contacto: tarea.contacto || null,
          tipo: tarea.tipo || null,
          carroceria: tarea.carroceria || null,
          revision_admin: tarea.revision_admin || null,
          comentario_admin: tarea.comentario_admin || null,
        });
      }

      // Limpieza: borrar programadas locales que ya no existen en backend
      const idsBackend = new Set(tareasBackend.map((t: any) => t.id));
      const localesProgramadas = await db.inspecciones
        .where("estado_sincronizacion")
        .equals("programada")
        .toArray();
      const toDelete = localesProgramadas
        .filter((i: any) => !idsBackend.has(i.id))
        .map((i: any) => i.id);
      if (toDelete.length > 0) {
        await db.inspecciones.bulkDelete(toDelete);
      }

      // Dedupe local: si existen múltiples programadas por mismo camión/patente, dejar la más reciente
      const programadas = await db.inspecciones
        .where("estado_sincronizacion")
        .equals("programada")
        .toArray();
      const byKey = new Map<string, any>();
      const dupIds: number[] = [];

      const getFecha = (x: any) =>
        new Date(x.fecha_hora_programada || x.fecha_programada || x.created_at || 0).getTime();

      for (const insp of programadas) {
        const key = String(insp.camion_id || insp.patente_sistema || insp.patente || "").trim();
        if (!key) continue;
        const prev = byKey.get(key);
        if (!prev) {
          byKey.set(key, insp);
          continue;
        }
        const keep = getFecha(insp) >= getFecha(prev) ? insp : prev;
        const drop = keep === insp ? prev : insp;
        byKey.set(key, keep);
        if (drop?.id) dupIds.push(drop.id);
      }

      if (dupIds.length > 0) {
        await db.inspecciones.bulkDelete(dupIds);
      }
    });
  } catch (error) {
    console.error("[Sync] Error bajando datos:", error);
  }
}

// ==========================================
// 2. GESTIÓN DE LA COLA (SUBIDA)
// ==========================================
export async function agregarACola(tipo: string, payload: Record<string, any>) {
  await db.cola_sync.add({
    tipo,
    payload,
    intentos: 0,
    ultimo_intento: null,
    ultimo_error: null,
    timestamp_creacion: new Date().toISOString(),
  });

  if (navigator.onLine) {
    procesarCola();
  }
}

export async function procesarCola() {
  if (!navigator.onLine) return;

  const pendientes = await db.cola_sync.where("intentos").below(MAX_INTENTOS).toArray();
  if (pendientes.length === 0) return;

  for (const item of pendientes) {
    try {
      await sincronizarItem(item);
      await db.cola_sync.delete(item.id);
      globalScope.__petranSyncLastError = undefined;
    } catch (error: any) {
      const errorDetail = {
        message: error?.message || String(error),
        type: error?.name || "Error",
        timestamp: new Date().toISOString(),
        stack: error?.stack?.split("\n").slice(0, 3).join(" | ")
      };
      console.error("[Sync] Error al sincronizar item", item.tipo, item.id, errorDetail);
      globalScope.__petranSyncLastError = errorDetail.message;
      await db.cola_sync.update(item.id, {
        intentos: item.intentos + 1,
        ultimo_error: JSON.stringify(errorDetail),
        ultimo_intento: new Date().toISOString(),
      });
    }
  }
}

async function sincronizarItem(item: any) {
  switch (item.tipo) {
    case "foto":
      await sincronizarFoto(item.payload);
      break;
    case "inspeccion_completa":
      await sincronizarInspeccion(item.payload);
      break;
    default:
      throw new Error(`Tipo desconocido: ${item.tipo}`);
  }
}

// ==========================================
// 3. LÓGICA DE FOTOS Y INSPECCIONES (CORE)
// ==========================================
async function sincronizarFoto(payload: { fotoId: number }) {
  const { fotoId } = payload;
  const fotoRecord = await db.fotos.get(fotoId);
  if (!fotoRecord) return;

  let urlPublica = (fotoRecord as any).url_remota;

  if (!urlPublica) {
    let blob = (fotoRecord as any).blob as Blob | null;
    const dataUrl = (fotoRecord as any).data_url as string | null;

    if (!blob && dataUrl) {
      blob = await dataUrlToBlob(dataUrl);
    }

    if (blob) {
      urlPublica = await subirACloudinary(blob);
    }
  }

  await db.fotos.update(fotoId, {
    blob: null,
    thumbnail_blob: null,
    data_url: null,
    thumbnail_data_url: null,
    url_remota: urlPublica,
    sincronizado: true,
    fecha_sincronizacion: new Date().toISOString(),
  });
}

async function sincronizarInspeccion(payload: { inspeccionId?: number; inspeccion_id?: number }) {
  const inspeccionId = payload.inspeccionId ?? payload.inspeccion_id;
  if (!inspeccionId) return;

  const inspeccion = await db.inspecciones.get(inspeccionId);
  if (!inspeccion) return;

  const camionId = inspeccion.camion_id || inspeccion.camionId;
  if (!camionId) {
    throw new Error("Falta camion_id para sincronizar");
  }

  const items = await db.items_inspeccion.where("inspeccion_id").equals(inspeccionId).toArray();

  const respuestas = items.map((i: any) => {
    const categoriaInfo = i.categoria_id ? categoriaMap.get(i.categoria_id) : null;
    const estado = i.veredicto_final || i.veredicto_inspector || "PENDIENTE";
    return {
      itemId: i.item_id,
      estado,
      descripcionFalla: estado === "RECHAZADO" ? i.observaciones || null : null,
      motivoNoAplica: null,
      categoria: i.categoria_id || "General",
      nivel: categoriaInfo?.nivel || 1,
      seccion: categoriaInfo?.nombre || "General",
    };
  });

  const fotosRaw = await db.fotos
    .where("inspeccion_id")
    .equals(inspeccionId)
    .filter((f: any) => !f.reemplazada)
    .toArray();

  const fotos_evidencia: Array<{
    itemId?: string;
    url: string;
    latitud?: number;
    longitud?: number;
    tipoMime?: string;
    nombreArchivo?: string;
  }> = [];
  for (const foto of fotosRaw) {
    try {
      let url = foto.url_remota;
      if (!url) {
        let blob = foto.blob;
        if (!blob && foto.data_url) {
          blob = await dataUrlToBlob(foto.data_url);
        }
        if (blob) {
          url = await subirACloudinary(blob);
          await db.fotos.update(foto.id, {
            blob: null,
            thumbnail_blob: null,
            data_url: null,
            thumbnail_data_url: null,
            url_remota: url,
            sincronizado: true,
            fecha_sincronizacion: new Date().toISOString(),
          });
        }
      }
      if (url) {
        const itemId = typeof foto.tipo === "string" ? foto.tipo : undefined;
        fotos_evidencia.push({
          itemId,
          url,
          latitud: foto.latitud ?? foto?.metadata?.gps_coords?.lat,
          longitud: foto.longitud ?? foto?.metadata?.gps_coords?.long,
          tipoMime: "image/jpeg",
          nombreArchivo: url.split("/").pop() || url
        });
      }
    } catch (errFoto) {
      console.error(`❌ Error subiendo foto ${foto.id}, se omitirá:`, errFoto);
      // Continuar con la siguiente foto sin bloquear la inspección
      continue;
    }
  }

  const datosParaBackend = {
    respuestas,
    notaFinal: 0,
    observacionesGenerales: inspeccion.observaciones_generales || null,
    fotos_evidencia,
  };

  await enviarABackend(`/inspector/inspecciones/${camionId}/completar`, datosParaBackend);

  await db.inspecciones.update(inspeccionId, {
    estado_sincronizacion: "sincronizado",
  });
}

// ==========================================
// 4. FUNCIONES DE RED (FETCH)
// ==========================================
async function subirACloudinary(blob: Blob): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;

  if (!cloudName || !uploadPreset) {
    const error = `Cloudinary no configurado: cloudName=${cloudName}, preset=${uploadPreset}`;
    console.error("❌", error);
    throw new Error(error);
  }

  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "inspecciones");

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  console.log("📤 Subiendo a Cloudinary:", { cloudName, uploadPreset, url });

  try {
    const response = await fetch(url, { method: "POST", body: formData });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Cloudinary HTTP Error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Cloudinary Error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    console.log("✅ Foto subida exitosamente:", data.secure_url);
    return data.secure_url;
  } catch (error: any) {
    console.error("❌ Error completo subirACloudinary:", {
      message: error?.message,
      cloudName,
      uploadPreset,
      url,
    });
    throw new Error(`Error Cloudinary: ${error?.message || "desconocido"}`);
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

async function enviarABackend(endpoint: string, data: any) {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Backend Error (${response.status}): ${text}`);
  }
  return response.json();
}

// ==========================================
// 5. INICIALIZADOR
// ==========================================
export function iniciarSyncBackground() {
  if (syncStarted || globalScope.__petranSyncStarted) return;
  syncStarted = true;
  globalScope.__petranSyncStarted = true;

  const ejecutarCiclo = () => {
    if (navigator.onLine) {
      procesarCola().catch((err) => console.error("[Sync Upload]", err));
      descargarAsignaciones().catch((err) => console.error("[Sync Download]", err));
    }
  };

  ejecutarCiclo();

  if (globalScope.__petranSyncInterval) {
    clearInterval(globalScope.__petranSyncInterval);
  }
  syncInterval = setInterval(ejecutarCiclo, 30000);
  globalScope.__petranSyncInterval = syncInterval;

  if (!globalScope.__petranSyncOnlineListener) {
    window.addEventListener("online", () => {
      ejecutarCiclo();
    });
    globalScope.__petranSyncOnlineListener = true;
  }
}
