"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronLeft,
  Download,
  Share2,
  CheckCircle2,
  XCircle,
  Truck,
  Calendar,
  User,
  Clock,
  FileText,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils-cn";

interface InspeccionReporte {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  empresa: string;
  fecha: string;
  inspector: string;
  detalles: {
    categoria: string;
    items: {
      titulo: string;
      estado: "cumple" | "no_cumple" | "no_aplica";
      descripcion?: string;
    }[];
  }[];
  resumen: {
    total: number;
    cumple: number;
    noCumple: number;
    noAplica: number;
  };
}

export default function InspeccionReportePage() {
  const router = useRouter();
  const params = useParams();
  const camionId = params.camionId as string;

  const [loading, setLoading] = useState(true);
  const [reporte, setReporte] = useState<InspeccionReporte | null>(null);

  useEffect(() => {
    // Simular carga de datos del reporte
    // En producción, esto vendría de la API
    setTimeout(() => {
      setReporte({
        id: 1,
        patente: "BJFP-32",
        marca: "Volvo",
        modelo: "FH16",
        empresa: "Transportes ABC",
        fecha: new Date().toISOString(),
        inspector: "Juan Pérez",
        detalles: [
          {
            categoria: "Frenos",
            items: [
              { titulo: "Fugas de aire", estado: "cumple" },
              { titulo: "Mangueras cortadas", estado: "cumple" },
              { titulo: "Cámaras de freno", estado: "no_cumple", descripcion: "Daño menor visible" },
            ],
          },
          {
            categoria: "Neumáticos",
            items: [
              { titulo: "Desgaste irregular", estado: "cumple" },
              { titulo: "Neumáticos lisos", estado: "cumple" },
              { titulo: "Cortes o globos", estado: "cumple" },
            ],
          },
        ],
        resumen: {
          total: 50,
          cumple: 45,
          noCumple: 3,
          noAplica: 2,
        },
      });
      setLoading(false);
    }, 1000);
  }, [camionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner className="h-10 w-10 text-teal-600" />
      </div>
    );
  }

  if (!reporte) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p>No se encontró el reporte</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push("/inspector")}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>

            <h1 className="font-semibold text-gray-900">Reporte de Inspección</h1>

            <button className="p-2 -mr-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Download className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Vehicle Info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Truck className="h-5 w-5 text-teal-600" />
            Información del Vehículo
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Patente</p>
              <p className="font-semibold text-gray-900">{reporte.patente}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Modelo</p>
              <p className="font-semibold text-gray-900">
                {reporte.marca} {reporte.modelo}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Empresa</p>
              <p className="font-semibold text-gray-900">{reporte.empresa}</p>
            </div>
          </div>
        </div>

        {/* Inspection Details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" />
            Detalles de Inspección
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">Fecha</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {new Date(reporte.fecha).toLocaleDateString("es-CL", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">Hora</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {new Date(reporte.fecha).toLocaleTimeString("es-CL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">Inspector</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {reporte.inspector}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Resumen General</h3>

          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-2xl font-bold text-gray-900">
                {reporte.resumen.total}
              </p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-600">
                {reporte.resumen.cumple}
              </p>
              <p className="text-xs text-green-600">OK</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-xl">
              <p className="text-2xl font-bold text-red-600">
                {reporte.resumen.noCumple}
              </p>
              <p className="text-xs text-red-600">Fallas</p>
            </div>
            <div className="text-center p-3 bg-gray-100 rounded-xl">
              <p className="text-2xl font-bold text-gray-500">
                {reporte.resumen.noAplica}
              </p>
              <p className="text-xs text-gray-500">N/A</p>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">
            Desglose por Categoría
          </h3>

          <div className="space-y-3">
            {reporte.detalles.map((categoria, idx) => {
              const hasIssues = categoria.items.some(
                (i) => i.estado === "no_cumple"
              );

              return (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-xl border transition-all",
                    hasIssues
                      ? "border-red-200 bg-red-50/50"
                      : "border-gray-100 bg-gray-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          hasIssues ? "bg-red-100" : "bg-green-100"
                        )}
                      >
                        {hasIssues ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {categoria.categoria}
                        </p>
                        <p className="text-xs text-gray-500">
                          {categoria.items.filter((i) => i.estado === "cumple").length}/
                          {categoria.items.length} items OK
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300" />
                  </div>

                  {hasIssues && (
                    <div className="mt-3 pt-3 border-t border-red-100 space-y-2">
                      {categoria.items
                        .filter((i) => i.estado === "no_cumple")
                        .map((item, iIdx) => (
                          <div
                            key={iIdx}
                            className="flex items-start gap-2 text-sm"
                          >
                            <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-red-700">
                                {item.titulo}
                              </p>
                              {item.descripcion && (
                                <p className="text-red-600/80 text-xs">
                                  {item.descripcion}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              // Compartir reporte
            }}
            className="py-3 px-6 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 className="h-5 w-5" />
            COMPARTIR
          </button>
          <button
            onClick={() => router.push("/inspector")}
            className="py-3 px-6 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors"
          >
            FINALIZAR
          </button>
        </div>
      </div>
    </div>
  );
}
