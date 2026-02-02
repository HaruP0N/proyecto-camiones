"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Calendar, CheckCircle2, Clock, Truck } from "lucide-react";
import { cn } from "@/lib/utils-cn";

interface ProgressData {
  completadas: number;
  pendientes: number;
  porcentaje: number;
}

type FilterPeriod = "hoy" | "ayer" | "semana" | "mes";

export default function MonitoreoPage() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("hoy");

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      const data = {
        completadas: 5,
        pendientes: 3,
        porcentaje: 63,
      };
      setProgress(data);
      setLoading(false);
    }, 600);
  }, [filterPeriod]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner className="h-10 w-10 text-red-600" />
      </div>
    );
  }

  if (!progress) return null;

  const getDateLabel = () => {
    const today = new Date();
    switch (filterPeriod) {
      case "hoy":
        return today.toLocaleDateString("es-CL", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
      case "ayer":
        const yesterday = new Date(today.getTime() - 86400000);
        return yesterday.toLocaleDateString("es-CL", { weekday: "long" });
      case "semana":
        return `Esta semana`;
      case "mes":
        return `Este mes`;
    }
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-16 z-40">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-white mb-1">Monitoreo</h1>
          <p className="text-sm text-neutral-400">
            Progreso de inspecciones
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Filtro por período */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(["hoy", "ayer", "semana", "mes"] as FilterPeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => setFilterPeriod(period)}
              className={cn(
                "px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all",
                filterPeriod === period
                  ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              )}
            >
              {period === "hoy" && "Hoy"}
              {period === "ayer" && "Ayer"}
              {period === "semana" && "Esta semana"}
              {period === "mes" && "Este mes"}
            </button>
          ))}
        </div>

        {/* Progreso Principal */}
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-lg mb-1">Progreso</h2>
              <p className="text-sm text-neutral-400">{getDateLabel()}</p>
            </div>
            <Calendar className="h-6 w-6 text-neutral-400" />
          </div>

          {/* Círculo de progreso */}
          <div className="flex items-center justify-center mb-8">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#404040"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#ef4444"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress.porcentaje / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.5s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-bold">{progress.porcentaje}%</span>
                <span className="text-xs text-neutral-400">completado</span>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <p className="text-sm text-neutral-300">Completadas</p>
              </div>
              <p className="text-2xl font-bold">{progress.completadas}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-yellow-400" />
                <p className="text-sm text-neutral-300">Pendientes</p>
              </div>
              <p className="text-2xl font-bold">{progress.pendientes}</p>
            </div>
          </div>
        </div>

        {/* Info adicional */}
        <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
          <div className="flex items-start gap-3">
            <Truck className="h-5 w-5 text-red-600 mt-1 flex-shrink-0" />
            <div>
              <p className="font-medium text-neutral-900 mb-1">Total: {progress.completadas + progress.pendientes}</p>
              <p className="text-sm text-neutral-600">
                Inspecciones asignadas para hoy
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
