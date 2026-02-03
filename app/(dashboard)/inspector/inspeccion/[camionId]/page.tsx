"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useInspectionDraft } from "@/hooks/use-inspection-draft";
import { ChevronLeft, Truck, Camera } from "lucide-react";

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

export default function PreInspeccionPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const camionId = params.camionId as string;

  const [loading, setLoading] = useState(true);
  const [camion, setCamion] = useState<CamionDetalle | null>(null);

  // Usar hook de auto-save
  const { draft, updateDraft } = useInspectionDraft(camionId);

  useEffect(() => {
    async function loadCamion() {
      try {
        const res = await fetch(`/api/inspector/inspecciones/camion/${camionId}`);
        if (!res.ok) throw new Error("Error al cargar datos");

        const data = await res.json();
        setCamion(data.data);
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
    // Guardar draft antes de navegar
    updateDraft({ ...draft });
    router.push(`/inspector/inspeccion/${camionId}/activa`);
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
          <Truck className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
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

            <div className="text-center">
              <p className="text-xs text-neutral-400">{camion?.empresa}</p>
              <h1 className="font-semibold text-white">Inspección</h1>
            </div>

            <div className="w-9" />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Información de Inspección */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <Truck className="h-5 w-5 text-red-600" />
            Información de Inspección
          </h2>

          <div className="space-y-4">
            {/* Patente y Marca */}
            <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
              <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded">
                {camion.patente}
              </span>
              <div>
                <p className="text-xs text-neutral-500">Vehículo</p>
                <p className="text-sm font-medium text-neutral-900">
                  {camion.marca} {camion.modelo}
                </p>
              </div>
            </div>

            {/* Empresa */}
            <div className="p-3 bg-neutral-50 rounded-xl">
              <p className="text-xs text-neutral-500 mb-1">Empresa</p>
              <p className="text-sm font-medium text-neutral-900">{camion.empresa}</p>
            </div>

            {/* Dirección de Inspección */}
            <div className="p-3 bg-neutral-50 rounded-xl">
              <p className="text-xs text-neutral-500 mb-1">Dirección de Inspección</p>
              <p className="text-sm font-medium text-neutral-900">A confirmar en sitio</p>
            </div>
          </div>
        </div>

        {/* Instrucciones */}
        <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Camera className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-900 mb-1">
                Próximo: Validar vehículo
              </p>
              <p className="text-xs text-red-700">
                Tomarás foto frontal, verificarás patente y registrarás datos del conductor
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Botón Fijo Inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-3 z-40 sm:p-4">
        <button
          onClick={handleStartInspection}
          className="w-full py-3 px-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm sm:text-base sm:py-4 sm:px-6 bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/30"
        >
          <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">COMENZAR INSPECCIÓN</span>
          <span className="sm:hidden">COMENZAR</span>
        </button>
      </div>
    </div>
  );
}
