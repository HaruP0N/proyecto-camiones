"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useInspectionDraft } from "@/hooks/use-inspection-draft";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Camera,
  Check,
  X,
  Circle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Image as ImageIcon,
  Loader2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils-cn";
import { ITEMS } from "@/lib/inspection/catalogo";
import type { EstadoItem } from "@/lib/inspection/types";

// Categorías base para UI mobile
const CATEGORIAS_BASE = [
  { id: "frenos", nombre: "Frenos", secciones: ["Frenos (visual)"] },
  { id: "neumaticos", nombre: "Neumáticos y Ruedas", secciones: ["Neumáticos (todos)"] },
  { id: "chasis", nombre: "Chasis y Estructura", secciones: ["Chasis y estructura"] },
  { id: "acople", nombre: "Acople / Quinta Rueda", secciones: ["Acople / Quinta rueda (si aplica)"] },
  { id: "luces", nombre: "Luces y Señalización", secciones: ["Señalización trasera"] },
  { id: "documentos", nombre: "Documentación", secciones: ["Coincidencia visual con documentos"] },
  { id: "fluidos", nombre: "Sistema de Fluidos", secciones: ["Sistema de fluidos"] },
  { id: "suspension", nombre: "Suspensión", secciones: ["Suspensión"] },
  { id: "cabina", nombre: "Cabina", secciones: ["Cabina"] },
  { id: "seguridad", nombre: "Equipo de Seguridad", secciones: ["Seguridad", "Coherencia general"] },
  { id: "electrico", nombre: "Sistema Eléctrico", secciones: ["Sistema eléctrico"] },
  { id: "accesos", nombre: "Accesos", secciones: ["Accesos"] },
  { id: "estetico", nombre: "Estético / Confort", secciones: ["Estético / Confort"] },
];

// Categorías específicas por tipo de carrocería
const CATEGORIAS_CARROCERIA: Record<string, typeof CATEGORIAS_BASE> = {
  CAMION_CON_CARRO: [
    { id: "carroceria_general", nombre: "Carrocería", secciones: ["Carrocería general", "Puertas laterales", "Puerta trasera"] },
  ],
  CARRO_REEFER: [
    { id: "frio", nombre: "Sistema de Frío", secciones: ["Sistema de frío", "Aislamiento", "Temperatura"] },
  ],
  CAMARA_DE_FRIO: [
    { id: "frio", nombre: "Sistema de Frío", secciones: ["Sistema de frío", "Aislamiento", "Temperatura"] },
  ],
  CAMION_PAQUETERO: [
    { id: "compartimientos", nombre: "Compartimientos", secciones: ["Estanterías", "Carga"] },
  ],
};

const getCategoriasByTipo = (tipo: string | null) => {
  const extra = tipo && CATEGORIAS_CARROCERIA[tipo] ? CATEGORIAS_CARROCERIA[tipo] : [];
  return [...CATEGORIAS_BASE, ...extra];
};

interface FotoEvidencia {
  id: string;
  url: string;
  publicId: string;
}

interface RespuestaItemExtended {
  estado?: EstadoItem;
  descripcionFalla?: string;
  motivoNoAplica?: string;
  fotos: FotoEvidencia[];
}

interface CamionInfo {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  empresa: string;
}

export default function InspeccionPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const camionId = params.camionId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [camion, setCamion] = useState<CamionInfo | null>(null);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaItemExtended>>({});
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [activePhotoItemId, setActivePhotoItemId] = useState<string | null>(null);
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Usar hook de auto-save
  const { draft, updateDraft } = useInspectionDraft(camionId);

  // Categorías (sin validación)
  const CATEGORIAS = CATEGORIAS_BASE;

  // Inicializar respuestas vacías
  useEffect(() => {
    const initial: Record<string, RespuestaItemExtended> = {};
    ITEMS.forEach((item) => {
      initial[item.id] = {
        estado: undefined,
        fotos: [],
      };
    });
    setRespuestas(initial);
  }, []);

  // Cargar datos del camión
  useEffect(() => {
    async function loadCamion() {
      try {
        const res = await fetch("/api/inspector/inspecciones/hoy");
        if (!res.ok) throw new Error("Error al cargar datos");

        const data = await res.json();
        const found = (data.data || []).find(
          (insp: any) => String(insp.camion_id) === camionId
        );

        if (found) {
          setCamion({
            id: found.camion_id,
            patente: found.patente,
            marca: found.marca,
            modelo: found.modelo,
            empresa: found.empresa,
          });
        }
      } catch (error) {
        console.error(error);
        toast({
          title: "Error",
          description: "No se pudo cargar la información del camión",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    loadCamion();
  }, [camionId, toast]);

  const currentCategory = CATEGORIAS[currentCategoryIndex];

  const getCategoryItems = (category: typeof CATEGORIAS[0]) => {
    return ITEMS.filter((item) => category.secciones.includes(item.seccion));
  };

  const currentItems = getCategoryItems(currentCategory);

  const getCategoryStats = (category: typeof CATEGORIAS[0]) => {
    const items = getCategoryItems(category);
    const total = items.length;
    const respondidos = items.filter((i) => respuestas[i.id]?.estado).length;
    const noCumple = items.filter((i) => respuestas[i.id]?.estado === "no_cumple").length;
    return { total, respondidos, noCumple };
  };

  const currentStats = getCategoryStats(currentCategory);
  const totalItems = ITEMS.length;
  const totalRespondidos = ITEMS.filter((i) => respuestas[i.id]?.estado).length;
  const progressPercent = Math.round((totalRespondidos / totalItems) * 100);

  const handleItemResponse = (itemId: string, estado: EstadoItem) => {
    setRespuestas((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        estado,
        // Limpiar fotos si cambia de no_cumple a otro estado
        fotos: estado === "no_cumple" ? prev[itemId]?.fotos || [] : [],
      },
    }));

    // Auto-focus en comentarios cuando marcan "Falla"
    if (estado === "no_cumple") {
      setTimeout(() => {
        textareaRefs.current[itemId]?.focus();
      }, 100);
    }
  };

  // Navegación entre ítems
  const navigateToItem = useCallback((index: number) => {
    if (index >= 0 && index < currentItems.length) {
      setFocusedItemIndex(index);
      const itemId = currentItems[index].id;
      itemRefs.current[itemId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentItems]);

  const handleNextItem = () => {
    if (focusedItemIndex < currentItems.length - 1) {
      navigateToItem(focusedItemIndex + 1);
    }
  };

  const handlePrevItem = () => {
    if (focusedItemIndex > 0) {
      navigateToItem(focusedItemIndex - 1);
    }
  };

  // Reset focused item when changing category
  useEffect(() => {
    setFocusedItemIndex(0);
  }, [currentCategoryIndex]);

  // Subir foto a Cloudinary
  const handlePhotoUpload = async (itemId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Solo se permiten imágenes",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen es muy grande (máximo 10MB)",
        variant: "destructive",
      });
      return;
    }

    setUploadingItemId(itemId);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipo", "inspeccion");
      formData.append("camionId", camionId);
      formData.append("categoria", itemId);

      const response = await fetch("/api/inspector/fotos", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al subir foto");
      }

      const result = await response.json();

      // Agregar foto al item
      setRespuestas((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          fotos: [
            ...(prev[itemId]?.fotos || []),
            {
              id: result.data.publicId,
              url: result.data.url,
              publicId: result.data.publicId,
            },
          ],
        },
      }));

      toast({
        title: "Foto subida",
        description: "La evidencia se guardó correctamente",
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo subir la foto",
        variant: "destructive",
      });
    } finally {
      setUploadingItemId(null);
      setActivePhotoItemId(null);
    }
  };

  // Eliminar foto de Cloudinary
  const handlePhotoDelete = async (itemId: string, photoId: string) => {
    try {
      await fetch("/api/inspector/fotos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: photoId }),
      });

      setRespuestas((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          fotos: prev[itemId]?.fotos.filter((f) => f.id !== photoId) || [],
        },
      }));
    } catch (error) {
      console.error("Error deleting photo:", error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activePhotoItemId) {
      handlePhotoUpload(activePhotoItemId, file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openPhotoSelector = (itemId: string, useCamera: boolean) => {
    setActivePhotoItemId(itemId);
    if (fileInputRef.current) {
      if (useCamera) {
        fileInputRef.current.setAttribute("capture", "environment");
      } else {
        fileInputRef.current.removeAttribute("capture");
      }
      fileInputRef.current.click();
    }
  };

  const handleNext = () => {
    if (currentCategoryIndex < CATEGORIAS.length - 1) {
      setCurrentCategoryIndex((prev) => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrev = () => {
    if (currentCategoryIndex > 0) {
      setCurrentCategoryIndex((prev) => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    const sinResponder = ITEMS.filter((i) => !respuestas[i.id]?.estado);
    if (sinResponder.length > 0) {
      toast({
        title: "Inspección incompleta",
        description: `Faltan ${sinResponder.length} items por responder`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Calcular nota
      let nota = 100;
      const penalizacion = { 1: 30, 2: 15, 3: 7, 4: 2 };

      ITEMS.forEach((item) => {
        if (respuestas[item.id]?.estado === "no_cumple") {
          nota -= penalizacion[item.nivel as 1 | 2 | 3 | 4] || 0;
        }
      });
      nota = Math.max(0, nota);

      // Preparar detalles con fotos
      const detalles = ITEMS.map((item) => ({
        itemId: item.id,
        estado: respuestas[item.id]?.estado,
        descripcionFalla: respuestas[item.id]?.descripcionFalla,
        motivoNoAplica: respuestas[item.id]?.motivoNoAplica,
        fotos: respuestas[item.id]?.fotos.map((f) => f.url) || [],
      }));

      // Recolectar todas las URLs de fotos para guardar
      const todasLasFotos = ITEMS.flatMap(
        (item) => respuestas[item.id]?.fotos.map((f) => f.url) || []
      );

      const response = await fetch(`/api/inspector/inspecciones/${camionId}/completar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camionId: Number(camionId),
          respuestas: detalles,
          notaFinal: Math.round(nota),
          observacionesGenerales: "",
          fotos_evidencia: todasLasFotos, // URLs de Cloudinary
        }),
      });

      if (!response.ok) throw new Error("Error al guardar");

      toast({
        title: "Inspección completada",
        description: `Nota final: ${nota.toFixed(0)}/100`,
      });

      router.push(`/inspector/inspeccion/${camionId}/reporte`);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "No se pudo guardar la inspección",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner className="h-10 w-10 text-red-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">
                {currentCategoryIndex + 1}/{CATEGORIAS.length}
              </span>
              <div className="flex gap-1">
                {CATEGORIAS.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      idx === currentCategoryIndex
                        ? "w-4 bg-red-500"
                        : idx < currentCategoryIndex
                        ? "bg-red-400"
                        : "bg-neutral-600"
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="w-9" />
          </div>
        </div>
      </header>

      {/* Category Title */}
      <div className="bg-white border-b border-neutral-200 px-4 py-4">
        <h1 className="text-xl font-bold text-neutral-900 mb-1">
          {currentCategory.nombre}
        </h1>
        <p className="text-sm text-neutral-500">
          {camion?.patente} - {camion?.marca} {camion?.modelo}
        </p>
      </div>

      {/* Stats Bar - Mejorado */}
      <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-3">
        {/* Progress visual */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-300"
              style={{ width: `${(currentStats.respondidos / currentStats.total) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-neutral-700 min-w-[3rem] text-right">
            {currentStats.respondidos}/{currentStats.total}
          </span>
        </div>

        {/* Stats badges */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-semibold text-green-600">
                {currentItems.filter((i) => respuestas[i.id]?.estado === "cumple").length} OK
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-red-600">
                {currentStats.noCumple} Fallas
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MinusCircle className="h-4 w-4 text-neutral-400" />
              <span className="font-medium text-neutral-500">
                {currentItems.filter((i) => respuestas[i.id]?.estado === "no_aplica").length} N/A
              </span>
            </div>
          </div>

          {/* Item navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevItem}
              disabled={focusedItemIndex === 0}
              className="p-1.5 rounded-lg hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Item anterior"
            >
              <ChevronUp className="h-4 w-4 text-neutral-600" />
            </button>
            <span className="text-xs text-neutral-500 min-w-[2.5rem] text-center">
              {focusedItemIndex + 1}/{currentItems.length}
            </span>
            <button
              onClick={handleNextItem}
              disabled={focusedItemIndex === currentItems.length - 1}
              className="p-1.5 rounded-lg hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Siguiente item"
            >
              <ChevronDown className="h-4 w-4 text-neutral-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="px-4 py-4 space-y-3">
        {currentItems.map((item, itemIndex) => {
          const respuesta = respuestas[item.id];
          const estado = respuesta?.estado;
          const fotos = respuesta?.fotos || [];
          const isUploading = uploadingItemId === item.id;
          const isFocused = itemIndex === focusedItemIndex;

          return (
            <div
              key={item.id}
              ref={(el) => { itemRefs.current[item.id] = el; }}
              onClick={() => setFocusedItemIndex(itemIndex)}
              className={cn(
                "bg-white rounded-2xl border-2 p-4 transition-all",
                estado === "cumple" && "border-green-300 bg-green-50/50",
                estado === "no_cumple" && "border-red-300 bg-red-50/50",
                estado === "no_aplica" && "border-neutral-300 bg-neutral-50/50",
                !estado && "border-neutral-200",
                isFocused && !estado && "ring-2 ring-red-500/50 border-red-300"
              )}
            >
              {/* Item Header */}
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    estado === "cumple" && "bg-green-100",
                    estado === "no_cumple" && "bg-red-100",
                    estado === "no_aplica" && "bg-neutral-200",
                    !estado && "bg-neutral-100"
                  )}
                >
                  {estado === "cumple" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                  {estado === "no_cumple" && <XCircle className="h-5 w-5 text-red-600" />}
                  {estado === "no_aplica" && <MinusCircle className="h-5 w-5 text-neutral-500" />}
                  {!estado && <Circle className="h-5 w-5 text-neutral-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-neutral-900 text-sm leading-tight">
                    {item.titulo}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {item.seccion} • N{item.nivel}
                  </p>
                </div>
              </div>

              {/* Response Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleItemResponse(item.id, "cumple")}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                    estado === "cumple"
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                      : "bg-neutral-100 text-neutral-600 hover:bg-green-100 hover:text-green-700"
                  )}
                >
                  <Check className="h-4 w-4" />
                  OK
                </button>

                <button
                  onClick={() => handleItemResponse(item.id, "no_cumple")}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                    estado === "no_cumple"
                      ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                      : "bg-neutral-100 text-neutral-600 hover:bg-red-100 hover:text-red-700"
                  )}
                >
                  <X className="h-4 w-4" />
                  Falla
                </button>

                <button
                  onClick={() => handleItemResponse(item.id, "no_aplica")}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                    estado === "no_aplica"
                      ? "bg-neutral-700 text-white shadow-lg shadow-neutral-700/30"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  )}
                >
                  <MinusCircle className="h-4 w-4" />
                  N/A
                </button>
              </div>

              {/* Campos adicionales cuando hay falla - Auto expandido */}
              {estado === "no_cumple" && (
                <div className="mt-3 pt-3 border-t border-red-200 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  {/* Alert de falla */}
                  <div className="flex items-center gap-2 p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-xs text-red-700 font-medium">
                      Documenta el problema encontrado
                    </span>
                  </div>

                  {/* Descripción de falla - Auto focus */}
                  <textarea
                    ref={(el) => { textareaRefs.current[item.id] = el; }}
                    placeholder="Describe el problema encontrado..."
                    value={respuesta?.descripcionFalla || ""}
                    onChange={(e) =>
                      setRespuestas((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...prev[item.id],
                          descripcionFalla: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-3 text-sm border border-red-200 rounded-xl bg-white resize-none focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-red-300"
                    rows={3}
                  />

                  {/* Fotos de evidencia */}
                  {fotos.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {fotos.map((foto) => (
                        <div
                          key={foto.id}
                          className="relative w-20 h-20 rounded-lg overflow-hidden group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={foto.url}
                            alt="Evidencia"
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => handlePhotoDelete(item.id, foto.id)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botones para agregar foto */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openPhotoSelector(item.id, true)}
                      disabled={isUploading}
                      className="flex-1 py-2 px-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {isUploading ? "Subiendo..." : "Cámara"}
                    </button>
                    <button
                      onClick={() => openPhotoSelector(item.id, false)}
                      disabled={isUploading}
                      className="flex-1 py-2 px-3 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors disabled:opacity-50"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Galería
                    </button>
                  </div>

                  {fotos.length > 0 && (
                    <p className="text-xs text-neutral-500">
                      {fotos.length} foto(s) de evidencia
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-50">
        {/* Progress visual mejorado */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-3">
              <span className="text-neutral-500">Progreso total</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {ITEMS.filter((i) => respuestas[i.id]?.estado === "cumple").length}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-3 w-3" />
                  {ITEMS.filter((i) => respuestas[i.id]?.estado === "no_cumple").length}
                </span>
                <span className="flex items-center gap-1 text-neutral-400">
                  <MinusCircle className="h-3 w-3" />
                  {ITEMS.filter((i) => respuestas[i.id]?.estado === "no_aplica").length}
                </span>
              </div>
            </div>
            <span className="font-bold text-neutral-900">{progressPercent}%</span>
          </div>
          <div className="h-2.5 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {currentCategoryIndex === CATEGORIAS.length - 1 ? (
            <>
              <button
                onClick={handlePrev}
                className="py-3 px-6 bg-neutral-100 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-200 transition-colors"
              >
                EDITAR
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="py-3 px-6 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    ENVIANDO...
                  </>
                ) : (
                  "ENVIAR"
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handlePrev}
                disabled={currentCategoryIndex === 0}
                className="py-3 px-6 bg-neutral-100 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                ANTERIOR
              </button>
              <button
                onClick={handleNext}
                className="py-3 px-6 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
              >
                SIGUIENTE
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
