"use client";

import { useState, useEffect } from "react";
import { capturePhoto } from "@/lib/inspector/camera";
import db from "@/lib/inspector/db";
import { agregarACola } from "@/lib/inspector/sync";

export default function PhotoCapture({
  itemInspeccionId,
  inspeccionId,
  itemId,
  onPhotoCaptured,
  disabled = false,
  tipoFoto = null,      // opcional: para diferenciar patente_camion vs patente_carro, etc.
  titulo = null,        // opcional: texto del botón
  autoCapture = false   // si es true, abre cámara al montar
}) {
  const [preview, setPreview] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);

  // Auto-disparo al montar (para flujo "Agregar otra")
  useEffect(() => {
    if (autoCapture && !preview && !pendingPhoto && !capturing) {
      handleCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCapture]);

  // PARTE 1: El Disparador
  const handleCapture = async () => {
    if (disabled) return;
    setCapturing(true);
    try {
      // Llamamos a la utilidad que abre la cámara y obtiene GPS
      const result = await capturePhoto(); 
      if (!result) {
        setCapturing(false);
        return;
      }
      setPendingPhoto(result);
      setPreview(URL.createObjectURL(result.blob)); // Genera una URL temporal para ver la foto
    } catch (err) {
      if (String(err?.message || err).includes('Captura cancelada')) return;
      console.error('Error capturando foto:', err);
    }
    setCapturing(false);
  };

  // PARTE 2: La Confirmación y Guardado Local
  const handleConfirm = async () => {
    if (!pendingPhoto) return;
    try {
      // Comprimir a JPG y obtener dataURL para evitar errores de IndexedDB en iOS
      const { dataUrl, thumbUrl } = await prepararImagenes(pendingPhoto.blob, pendingPhoto.thumbnail);

      // Guardamos en la base de datos del teléfono (Dexie)
      const storedUser = JSON.parse(localStorage.getItem("petran_user") || "{}");
      const inspectorId = storedUser?.id || "inspector-actual";

      const fotoId = await db.fotos.add({
        item_inspeccion_id: itemInspeccionId,
        inspeccion_id: inspeccionId,
        tipo: tipoFoto || itemId,
        blob: null, // evitamos blobs grandes (problema en iOS)
        thumbnail_blob: null,
        data_url: dataUrl,
        thumbnail_data_url: thumbUrl,
        
        // Aquí extraemos los datos que pide tu nuevo SP de Azure
        latitud: pendingPhoto.metadata.gps_coords.lat,
        longitud: pendingPhoto.metadata.gps_coords.long,
        
        metadata: {
          ...pendingPhoto.metadata,
          inspector_id: inspectorId,
        },
        timestamp_captura: pendingPhoto.metadata.timestamp,
        reemplazada: false
      });

      setConfirmed(true);
      setPendingPhoto(null);
      await agregarACola("foto", { fotoId });
      if (onPhotoCaptured) onPhotoCaptured(fotoId, tipoFoto || itemId);
    } catch (err) {
      console.error('Error guardando foto en Dexie:', err);
    }
  };

  const handleRetake = () => {
    if (preview) URL.revokeObjectURL(preview); // Limpia la memoria del teléfono
    setPreview(null);
    setPendingPhoto(null);
    setConfirmed(false);
    handleCapture();
  };

  // PARTE 3: La Interfaz (Lo que ve el inspector)
  if (confirmed && preview) {
    return (
      <div className="relative rounded-xl overflow-hidden border-2 border-[var(--color-exito)]">
        <img src={preview} alt="Evidencia" className="w-full h-32 object-cover" />
        <div className="absolute top-2 right-2 bg-[var(--color-exito)] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
          ✓
        </div>
      </div>
    );
  }

  if (preview && !confirmed) {
    return (
      <div className="rounded-2xl overflow-hidden border-2 border-[#7f1d1d] shadow-lg shadow-red-200/50">
        <img src={preview} alt="Preview" className="w-full h-36 object-cover" />
        <div className="flex gap-2 p-3 bg-white">
          <button
            onClick={handleConfirm}
            className="flex-1 h-12 rounded-xl text-sm font-extrabold text-white bg-[#7f1d1d] hover:bg-red-900 transition-all shadow-md shadow-red-300"
          >
            Confirmar
          </button>
          <button
            onClick={handleRetake}
            className="flex-1 h-12 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all border border-gray-200"
          >
            Retomar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleCapture}
      disabled={disabled || capturing}
      className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--color-accion)] text-[var(--color-accion)] font-medium"
    >
      {capturing ? 'Abriendo cámara...' : (titulo || '📷 Tomar Foto')}
    </button>
  );
}

// Utilidad local: comprime y devuelve dataURL (<=1280px, calidad 0.72)
async function prepararImagenes(blobFull, blobThumb) {
  const dataUrl = await toDataUrl(blobFull, 1280, 0.72);
  const thumbUrl = blobThumb ? await toDataUrl(blobThumb, 512, 0.7) : null;
  return { dataUrl, thumbUrl };
}

async function toDataUrl(blob, maxSize, quality = 0.72) {
  const img = await blobToImage(blob);
  const { width, height } = fit(img.width, img.height, maxSize);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

function fit(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w / h;
  if (ratio > 1) return { width: max, height: Math.round(max / ratio) };
  return { width: Math.round(max * ratio), height: max };
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
