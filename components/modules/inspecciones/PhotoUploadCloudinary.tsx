"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, Image as ImageIcon, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils-cn";

interface UploadedPhoto {
  id: string;
  url: string;
  publicId: string;
  nombre: string;
}

interface PhotoUploadCloudinaryProps {
  onPhotosChange: (fotos: UploadedPhoto[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  tipo?: "inspeccion" | "vehiculo" | "documento";
  inspeccionId?: number;
  camionId?: number;
  categoria?: string;
  initialPhotos?: UploadedPhoto[];
}

/**
 * Componente de subida de fotos a Cloudinary
 * Soporta drag & drop, cámara móvil y selección de archivos
 */
export function PhotoUploadCloudinary({
  onPhotosChange,
  maxFiles = 5,
  maxSizeMB = 10,
  tipo = "inspeccion",
  inspeccionId,
  camionId,
  categoria,
  initialPhotos = [],
}: PhotoUploadCloudinaryProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [fotos, setFotos] = useState<UploadedPhoto[]>(initialPhotos);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

  const uploadFile = async (file: File): Promise<UploadedPhoto | null> => {
    // Validar tipo
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Tipo de archivo no válido",
        description: "Solo se permiten imágenes",
        variant: "destructive",
      });
      return null;
    }

    // Validar tamaño
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: `Máximo ${maxSizeMB}MB. Tu archivo: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        variant: "destructive",
      });
      return null;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipo", tipo);
      if (inspeccionId) formData.append("inspeccionId", String(inspeccionId));
      if (camionId) formData.append("camionId", String(camionId));
      if (categoria) formData.append("categoria", categoria);

      const response = await fetch("/api/inspector/fotos", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al subir");
      }

      const result = await response.json();

      return {
        id: result.data.publicId,
        url: result.data.url,
        publicId: result.data.publicId,
        nombre: file.name,
      };
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error al subir",
        description: error instanceof Error ? error.message : "Intenta de nuevo",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const availableSlots = maxFiles - fotos.length;

    if (fileArray.length > availableSlots) {
      toast({
        title: "Límite excedido",
        description: `Solo puedes agregar ${availableSlots} foto(s) más`,
        variant: "destructive",
      });
    }

    const filesToUpload = fileArray.slice(0, availableSlots);
    if (filesToUpload.length === 0) return;

    setUploadingCount(filesToUpload.length);

    const uploadPromises = filesToUpload.map(uploadFile);
    const results = await Promise.all(uploadPromises);

    const successfulUploads = results.filter((r): r is UploadedPhoto => r !== null);

    if (successfulUploads.length > 0) {
      const updated = [...fotos, ...successfulUploads];
      setFotos(updated);
      onPhotosChange(updated);

      toast({
        title: "Fotos subidas",
        description: `${successfulUploads.length} foto(s) agregadas`,
      });
    }

    setUploadingCount(0);
  };

  const handleRemove = async (fotoId: string) => {
    // Encontrar la foto
    const foto = fotos.find((f) => f.id === fotoId);
    if (!foto) return;

    // Eliminar de Cloudinary
    try {
      await fetch("/api/inspector/fotos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: foto.publicId }),
      });
    } catch (error) {
      console.error("Error eliminando de Cloudinary:", error);
      // Continuar con la eliminación local aunque falle en Cloudinary
    }

    // Actualizar estado local
    const updated = fotos.filter((f) => f.id !== fotoId);
    setFotos(updated);
    onPhotosChange(updated);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [fotos.length]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const isUploading = uploadingCount > 0;
  const canAddMore = fotos.length < maxFiles;

  return (
    <div className="space-y-4">
      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* Drop Zone */}
      {canAddMore && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "border-2 border-dashed rounded-2xl p-6 text-center transition-all",
            isDragging
              ? "border-teal-500 bg-teal-50"
              : "border-gray-200 bg-gray-50 hover:border-gray-300"
          )}
        >
          {isUploading ? (
            <div className="py-4">
              <Loader2 className="h-8 w-8 mx-auto mb-2 text-teal-600 animate-spin" />
              <p className="text-sm text-gray-600">
                Subiendo {uploadingCount} foto(s)...
              </p>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="font-medium text-gray-700">Arrastra fotos aquí</p>
              <p className="text-sm text-gray-500 mt-1">
                o usa los botones de abajo
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Máx {maxFiles} fotos, {maxSizeMB}MB cada una
              </p>
            </>
          )}
        </div>
      )}

      {/* Action Buttons — min-h-[48px] para touch targets */}
      {canAddMore && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-h-[48px]"
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Galeria
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isUploading}
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 min-h-[48px]"
          >
            <Camera className="h-4 w-4 mr-2" />
            Camara
          </Button>
        </div>
      )}

      {/* Counter */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {fotos.length}/{maxFiles} fotos
        </span>
        {fotos.length === maxFiles && (
          <span className="text-yellow-600">Límite alcanzado</span>
        )}
      </div>

      {/* Photos Grid */}
      {fotos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {fotos.map((foto) => (
            <div
              key={foto.id}
              className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto.url}
                alt={foto.nombre}
                className="w-full h-full object-cover"
              />

              {/* Remove Button — visible en mobile (no depende de hover) */}
              <button
                type="button"
                onClick={() => handleRemove(foto.id)}
                className="absolute top-1 right-1 w-7 h-7 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X className="h-4 w-4" />
              </button>

              {/* File Name */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-white text-xs truncate">{foto.nombre}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {fotos.length === 0 && !isUploading && (
        <p className="text-sm text-gray-500 text-center py-4">
          No hay fotos. Agrega al menos una para continuar.
        </p>
      )}
    </div>
  );
}
