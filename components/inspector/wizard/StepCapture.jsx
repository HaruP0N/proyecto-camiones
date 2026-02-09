import { Camera, FileText, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils-cn"
import { capturePhoto } from "@/lib/inspector/camera"
import db from "@/lib/inspector/db"
import { agregarACola } from "@/lib/inspector/sync"

export function StepCapture({
  patenteSistema,
  fotoCapturada,
  onPhotoCaptured,
  inspeccionId,
  tipoFoto = 'patente_frontal',
  tituloBoton = 'Toque para capturar'
}) {
  
  const handleCaptureClick = async () => {
    try {
      // Usamos tu utilidad de cámara existente
      const result = await capturePhoto();
      if (!result) return;

      const { dataUrl, thumbUrl } = await prepararImagenes(result.blob, result.thumbnail);
      
      // Guardamos en Dexie (Base de datos)
      const fotoId = await db.fotos.add({
        item_inspeccion_id: null,
        inspeccion_id: inspeccionId,
        tipo: tipoFoto,
        blob: null,
        thumbnail_blob: null,
        data_url: dataUrl,
        thumbnail_data_url: thumbUrl,
        latitud: result.metadata.gps_coords?.lat || 0,
        longitud: result.metadata.gps_coords?.long || 0,
        metadata: result.metadata,
        timestamp_captura: result.metadata.timestamp,
        reemplazada: false
      });

      await agregarACola("foto", { fotoId });

      // Notificamos al padre
      onPhotoCaptured(tipoFoto);
    } catch (err) {
      if (String(err?.message || err).includes("Captura cancelada")) return;
      console.error("Error capturando:", err);
      // Aquí podrías mostrar un toast de error si quieres
    }
  };

  return (
    <div className="flex flex-col gap-6 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Capture una foto frontal clara de la patente del vehículo asignado.
      </p>

      {/* Tarjeta de Patente Visual */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-primary/20 rounded-3xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative bg-foreground rounded-2xl p-6 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent)]" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary-foreground/70" />
              </div>
              <span className="text-primary-foreground/60 text-xs font-semibold uppercase tracking-widest">
                Patente del Sistema
              </span>
            </div>
            <p className="text-primary-foreground text-5xl font-mono font-bold tracking-[0.3em] text-center py-2">
              {patenteSistema || 'SIN PATENTE'}
            </p>
          </div>
        </div>
      </div>

      {/* Botón de Captura (Zona Interactiva) */}
      <div className="flex-1 flex flex-col">
        <label className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          Fotografía del Vehículo
        </label>

        <button
          type="button"
          onClick={handleCaptureClick}
          className={cn(
            "flex-1 min-h-[140px] rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-3 cursor-pointer relative overflow-hidden group",
            fotoCapturada
              ? "border-accent bg-accent/5"
              : "border-border hover:border-primary/40 hover:bg-primary/5"
          )}
        >
          {fotoCapturada ? (
            <div className="flex flex-col items-center gap-2 animate-in zoom-in duration-300">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-accent" />
              </div>
              <span className="text-accent font-semibold text-sm">Foto capturada</span>
              <span className="text-muted-foreground text-xs">Toque para recapturar</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Camera className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="text-muted-foreground font-medium text-sm group-hover:text-primary transition-colors">{tituloBoton}</span>
            </div>
          )}
        </button>
      </div>
    </div>
  )
}

// Utilidad local: comprime y devuelve dataURL (<=1280px, calidad 0.72)
async function prepararImagenes(blobFull, blobThumb) {
  const dataUrl = await toDataUrl(blobFull, 1280, 0.72)
  const thumbUrl = blobThumb ? await toDataUrl(blobThumb, 512, 0.7) : null
  return { dataUrl, thumbUrl }
}

async function toDataUrl(blob, maxSize, quality = 0.72) {
  const img = await blobToImage(blob)
  const { width, height } = fit(img.width, img.height, maxSize)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

function fit(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h }
  const ratio = w / h
  if (ratio > 1) return { width: max, height: Math.round(max / ratio) }
  return { width: Math.round(max * ratio), height: max }
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}
