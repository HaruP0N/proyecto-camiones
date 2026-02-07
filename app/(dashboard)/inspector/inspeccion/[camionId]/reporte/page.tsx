"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
// Importamos el hook de notificaciones (Asegúrate que la ruta sea correcta según tu proyecto, puede ser @/components/ui/use-toast o @/hooks/use-toast)
import { useToast } from "@/hooks/use-toast"; 
import {
  ChevronLeft,
  Share2,
  Truck,
  Calendar,
  User,
  Clock,
  FileText,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check
} from "lucide-react";

interface ReporteData {
  patente: string;
  marca: string;
  modelo: string;
  empresa: string;
  fecha: string;
  inspector: string;
  nota: number;
  resultado: string;
}

export default function InspeccionReportePage() {
  const router = useRouter();
  const { toast } = useToast(); // Hook para el mensaje
  const params = useParams();
  const camionId = params.camionId as string;

  const [loading, setLoading] = useState(true);
  const [reporte, setReporte] = useState<ReporteData | null>(null);

  useEffect(() => {
    async function loadReporte() {
      try {
        const res = await fetch(`/api/inspector/inspecciones/camion/${camionId}`);
        const json = await res.json();

        if (!res.ok || !json.data) throw new Error("Error al cargar reporte");

        const datos = json.data;
        const ultima = datos.ultimaInspeccion;

        if (!ultima) {
            console.warn("No hay inspección finalizada.");
            return; 
        }

        const meRes = await fetch("/api/inspector/me");
        const meJson = await meRes.json();
        const inspectorNombre = meJson.data?.nombre || "Inspector";

        setReporte({
          patente: datos.patente,
          marca: datos.marca,
          modelo: datos.modelo,
          empresa: datos.empresa.nombre,
          fecha: ultima.fecha || new Date().toISOString(),
          inspector: inspectorNombre,
          nota: ultima.nota,
          resultado: ultima.resultado?.toUpperCase() || "SIN RESULTADO",
        });

      } catch (error) {
        console.error("Error cargando reporte:", error);
      } finally {
        setLoading(false);
      }
    }

    loadReporte();
  }, [camionId]);

  // ✅ Nueva función para el botón Finalizar
  const handleFinalizar = () => {
    toast({
      title: "¡Proceso finalizado!",
      description: "Inspección registrada correctamente. Volviendo al inicio.",
      duration: 4000,
      // @ts-ignore
      className: "bg-green-600 text-white border-none", // Estilo forzado verde para éxito
    });
    
    // Redirigir al dashboard
    router.push("/inspector");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner className="h-10 w-10 text-red-600" />
      </div>
    );
  }

  if (!reporte) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Reporte no disponible</h2>
        <p className="text-gray-500 mt-2 mb-6">
          La inspección aún no ha sido finalizada o no se encontraron datos.
        </p>
        <button 
          onClick={() => router.push("/inspector")} 
          className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-semibold"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  const isAprobado = reporte.resultado === 'APROBADO';
  const isRechazado = reporte.resultado === 'RECHAZADO';
  
  // Como ahora el resultado es "PENDIENTE" al principio, agregamos un color neutro/azul
  const isPendiente = reporte.resultado === 'PENDIENTE';

  const badgeColor = isAprobado ? 'bg-green-100 text-green-700 border-green-200' :
                     isRechazado ? 'bg-red-100 text-red-700 border-red-200' :
                     'bg-blue-100 text-blue-700 border-blue-200'; // Azul para Pendiente

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => router.push("/inspector")}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="font-semibold text-gray-900">Reporte Final</h1>
            <div className="w-8"></div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        
        <div className="flex flex-col items-center gap-4">
            <span className={`px-6 py-2 rounded-full text-sm font-bold border flex items-center gap-2 ${badgeColor}`}>
                {isAprobado ? <CheckCircle2 className="h-4 w-4"/> : 
                 isRechazado ? <XCircle className="h-4 w-4"/> : 
                 <Clock className="h-4 w-4"/>} {/* Reloj para Pendiente */}
                {reporte.resultado === 'PENDIENTE' ? 'EN REVISIÓN' : reporte.resultado}
            </span>
            
            <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Calificación Preliminar</p>
                <div className="flex items-baseline justify-center">
                    <span className="text-5xl font-black text-slate-900">{reporte.nota}</span>
                    <span className="text-xl text-gray-400 font-medium">/100</span>
                </div>
            </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Truck className="h-5 w-5 text-red-600" />
            Vehículo Inspeccionado
          </h3>
          <div className="grid grid-cols-2 gap-y-4 gap-x-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">Patente</p>
              <p className="font-bold text-gray-900 text-lg">{reporte.patente}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Modelo</p>
              <p className="font-semibold text-gray-900">{reporte.marca} {reporte.modelo}</p>
            </div>
            <div className="col-span-2 pt-3 border-t border-gray-100 mt-1">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    <Building2 className="h-4 w-4"/>
                 </div>
                 <div>
                    <p className="text-xs text-gray-500">Empresa Cliente</p>
                    <p className="font-semibold text-gray-900 text-sm">{reporte.empresa}</p>
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-600" />
            Datos de la Revisión
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
               <span className="text-sm text-gray-500 flex items-center gap-2"><Calendar className="h-4 w-4"/> Fecha</span>
               <span className="text-sm font-medium text-gray-900">{new Date(reporte.fecha).toLocaleDateString("es-CL")}</span>
            </div>
            <div className="flex justify-between items-center">
               <span className="text-sm text-gray-500 flex items-center gap-2"><Clock className="h-4 w-4"/> Hora</span>
               <span className="text-sm font-medium text-gray-900">{new Date(reporte.fecha).toLocaleTimeString("es-CL", {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
               <span className="text-sm text-gray-500 flex items-center gap-2"><User className="h-4 w-4"/> Inspector</span>
               <span className="text-sm font-medium text-gray-900">{reporte.inspector}</span>
            </div>
          </div>
        </div>

      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
        <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
            <button className="py-3.5 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
                <Share2 className="h-5 w-5"/> Compartir
            </button>
            <button
                onClick={handleFinalizar}
                className="py-3.5 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
                <Check className="h-5 w-5" />
                FINALIZAR
            </button>
        </div>
      </div>
    </div>
  );
}