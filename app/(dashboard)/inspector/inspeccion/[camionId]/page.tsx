"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useInspectionDraft } from "@/hooks/use-inspection-draft";
import {
  ChevronLeft,
  Truck,
  Building2,
  CheckCircle2,
  AlertCircle,
  Camera,
  ClipboardList,
  Thermometer,
  Box,
  FileText,
  Disc,
  Circle,
  Lightbulb,
  Wrench,
  Shield,
  Droplet,
} from "lucide-react";
import { cn } from "@/lib/utils-cn";

interface CamionDetalle {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  tipo: string;
  carroceria: string | null;
  empresa: string;
}

// Tipos de carrocería reales con sus iconos y categorías
const TIPOS_CARROCERIA = [
  {
    id: "CAMION_CON_CARRO",
    nombre: "Camión con carro",
    icon: Box,
    categorias: ["Carrocería general", "Puertas laterales", "Puerta trasera"],
  },
  {
    id: "CARRO_REEFER",
    nombre: "Carro reefer",
    icon: Thermometer,
    categorias: ["Sistema de frío", "Aislamiento", "Temperatura"],
  },
  {
    id: "CAMARA_DE_FRIO",
    nombre: "Cámara de frío",
    icon: Box,
    categorias: ["Aislamiento", "Puertas", "Temperatura"],
  },
  {
    id: "CAMION_PAQUETERO",
    nombre: "Camión paquetero",
    icon: ClipboardList,
    categorias: ["Estanterías", "Puertas", "Carga"],
  },
];

const CATEGORY_ICONS: Record<string, any> = {
  frenos: Disc,
  neumaticos: Circle,
  "neumaticos y ruedas": Circle,
  luces: Lightbulb,
  chasis: Wrench,
  cabina: Truck,
  documentos: FileText,
  suspension: Wrench,
  acople: Wrench,
  seguridad: Shield,
  electrico: Lightbulb,
  accesos: Shield,
  estetico: CheckCircle2,
  fluidos: Droplet,
};

// Categorías base de inspección con iconos
const CATEGORIAS_BASE = [
  { id: "frenos", nombre: "Frenos", items: 4, icon: CATEGORY_ICONS["frenos"] },
  { id: "neumaticos", nombre: "Neumáticos y Ruedas", items: 4, icon: CATEGORY_ICONS["neumaticos y ruedas"] },
  { id: "luces", nombre: "Luces", items: 6, icon: CATEGORY_ICONS["luces"] },
  { id: "chasis", nombre: "Chasis", items: 3, icon: CATEGORY_ICONS["chasis"] },
  { id: "cabina", nombre: "Cabina", items: 5, icon: CATEGORY_ICONS["cabina"] },
  { id: "documentos", nombre: "Documentos", items: 3, icon: CATEGORY_ICONS["documentos"] },
];

export default function PreInspeccionPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const camionId = params.camionId as string;

  const [loading, setLoading] = useState(true);
  const [camion, setCamion] = useState<CamionDetalle | null>(null);
  const [carroceriaSeleccionada, setCarroceriaSeleccionada] = useState<string | null>(null);

  // Usar hook de auto-save
  const { draft, updateDraft } = useInspectionDraft(camionId);

  useEffect(() => {
    async function loadCamion() {
      try {
        const res = await fetch(`/api/inspector/inspecciones/camion/${camionId}`);
        if (!res.ok) throw new Error("Error al cargar datos");

        const data = await res.json();
        setCamion(data.data);

        // Auto-seleccionar y bloquear la carrocería si viene de la BD
        if (data.data?.carroceria) {
          setCarroceriaSeleccionada(data.data.carroceria);
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

  const handleStartInspection = () => {
    // Guardar carrocería seleccionada en sessionStorage para usarla en la inspección
    if (carroceriaSeleccionada) {
      sessionStorage.setItem(`carroceria_${camionId}`, carroceriaSeleccionada);
    }
    // Guardar draft antes de navegar
    updateDraft({ ...draft });
    router.push(`/inspector/inspeccion/${camionId}/activa`);
  };

  const getCarroceriaInfo = (tipoId: string | null) => {
    return TIPOS_CARROCERIA.find((t) => t.id === tipoId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <Spinner className="h-10 w-10 mx-auto text-red-600" />
          <p className="text-neutral-500">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (!camion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
          <p className="text-neutral-600 font-medium">Camión no encontrado</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-red-600 font-medium"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const carroceriaInfo = getCarroceriaInfo(carroceriaSeleccionada);
  const totalItems =
    CATEGORIAS_BASE.reduce((acc, cat) => acc + cat.items, 0) +
    (carroceriaInfo?.categorias.length || 0) * 3;

  return (
    <div className="min-h-screen bg-white pb-32">
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

            <h1 className="font-semibold text-white">Pre-Inspección</h1>

            <div className="w-9" />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Información del Camión */}
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-5 text-white">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-red-600/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
              <Truck className="h-7 w-7 text-red-500" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                  {camion.patente}
                </span>
                <span className="text-neutral-400 text-xs">
                  {camion.tipo}
                </span>
              </div>
              <h2 className="text-lg font-bold truncate">
                {camion.marca} {camion.modelo}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-neutral-400">
                <Building2 className="h-4 w-4" />
                <span className="truncate">{camion.empresa}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Categorías a Inspeccionar */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-red-600" />
              Categorías a Inspeccionar
            </h3>
            <span className="text-sm text-neutral-500">
              ~{totalItems} items
            </span>
          </div>

          <div className="space-y-2">
            {/* Categorías base con iconos */}
            {CATEGORIAS_BASE.map((cat) => {
              const Icon = cat.icon || CheckCircle2;
              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-red-500" />
                    <span className="text-sm text-neutral-700">{cat.nombre}</span>
                  </div>
                  <span className="text-xs text-neutral-400">{cat.items} items</span>
                </div>
              );
            })}

            {/* Categorías del tipo de carrocería seleccionado */}
            {carroceriaInfo && (
              <>
                <div className="my-3 border-t border-neutral-200" />
                <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">
                  Específico de {carroceriaInfo.nombre}
                </p>
                {carroceriaInfo.categorias.map((cat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100"
                  >
                    <div className="flex items-center gap-3">
                      <carroceriaInfo.icon className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-700">{cat}</span>
                    </div>
                    <span className="text-xs text-red-400">3 items</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Instrucciones */}
        <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Camera className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900 mb-1">
                Validación en 2 fases
              </p>
              <p className="text-xs text-neutral-500">
                Primero validaremos el camión (foto + patente + datos del chofer), luego la carrocería, y finalmente responderás los ítems de inspección.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Botón Fijo Inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-3 z-40 sm:p-4">
        <button
          onClick={handleStartInspection}
          disabled={!carroceriaSeleccionada}
          className={cn(
            "w-full py-3 px-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm sm:text-base sm:py-4 sm:px-6",
            carroceriaSeleccionada
              ? "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/30"
              : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
          )}
        >
          <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">COMENZAR INSPECCIÓN</span>
          <span className="sm:hidden">COMENZAR</span>
        </button>

        {!carroceriaSeleccionada && (
          <p className="text-xs text-center text-neutral-500 mt-2">
            Selecciona un tipo de carrocería para continuar
          </p>
        )}
      </div>
    </div>
  );
}
