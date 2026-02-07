"use client";

import { useEffect, useState, useCallback } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Calendar, CheckCircle2, Clock, Truck, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils-cn";
import Link from "next/link";

interface ProgressData {
  completadas: number;
  pendientes: number;
  porcentaje: number;
}

type FilterPeriod = "hoy" | "ayer" | "semana" | "mes";

function getDateRange(period: FilterPeriod): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const today = fmt(now);

  switch (period) {
    case "hoy":
      return { from: today, to: today };
    case "ayer": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yd = fmt(y);
      return { from: yd, to: yd };
    }
    case "semana": {
      const s = new Date(now);
      s.setDate(s.getDate() - s.getDay());
      return { from: fmt(s), to: today };
    }
    case "mes": {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(m), to: today };
    }
  }
}

export default function MonitoreoPage() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("hoy");
  const [animating, setAnimating] = useState(false);

  const fetchProgress = useCallback(async (period: FilterPeriod) => {
    setLoading(true);
    setAnimating(true);
    try {
      const { from, to } = getDateRange(period);
      const res = await fetch(
        `/api/inspector/inspecciones?from=${from}&to=${to}`
      );
      if (!res.ok) throw new Error("Error cargando datos");

      const data = await res.json();
      const inspecciones = data.inspecciones || [];

      const completadas = inspecciones.filter(
        (i: any) =>
          i.estado === "REALIZADA" ||
          i.estado === "COMPLETADA" ||
          i.resultado != null
      ).length;
      const total = inspecciones.length;
      const pendientes = total - completadas;
      const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

      setProgress({ completadas, pendientes, porcentaje });
    } catch (err) {
      console.error("Error fetching monitoreo:", err);
      setProgress({ completadas: 0, pendientes: 0, porcentaje: 0 });
    } finally {
      setLoading(false);
      setTimeout(() => setAnimating(false), 500);
    }
  }, []);

  useEffect(() => {
    fetchProgress(filterPeriod);
  }, [filterPeriod, fetchProgress]);

  const handlePeriodChange = (period: FilterPeriod) => {
    if (period === filterPeriod) return;
    setFilterPeriod(period);
  };

  const getDateLabel = () => {
    const today = new Date();
    switch (filterPeriod) {
      case "hoy":
        return today.toLocaleDateString("es-CL", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
      case "ayer": {
        const yesterday = new Date(today.getTime() - 86400000);
        return yesterday.toLocaleDateString("es-CL", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
      }
      case "semana":
        return "Esta semana";
      case "mes":
        return today.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
    }
  };

  if (loading && !progress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner className="h-10 w-10 text-red-600" />
      </div>
    );
  }

  const safeProgress = progress ?? { completadas: 0, pendientes: 0, porcentaje: 0 };

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-16 z-40">
        <div className="px-4 py-5 flex items-center gap-3">
          <Link
            href="/inspector"
            className="p-2 -ml-2 rounded-xl hover:bg-white/10 active:bg-white/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Monitoreo</h1>
            <p className="text-sm text-neutral-400">Progreso de inspecciones</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Filtro por periodo */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {(["hoy", "ayer", "semana", "mes"] as FilterPeriod[]).map(
            (period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={cn(
                  "px-5 py-2.5 rounded-2xl font-medium text-sm whitespace-nowrap transition-all min-h-[44px] active:scale-95",
                  filterPeriod === period
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 active:bg-neutral-200"
                )}
              >
                {period === "hoy" && "Hoy"}
                {period === "ayer" && "Ayer"}
                {period === "semana" && "Esta semana"}
                {period === "mes" && "Este mes"}
              </button>
            )
          )}
        </div>

        {/* Progreso Principal */}
        <div
          className={cn(
            "bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-3xl p-6 text-white transition-opacity duration-300",
            animating ? "opacity-60" : "opacity-100"
          )}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-lg mb-1">Progreso</h2>
              <p className="text-sm text-neutral-400">{getDateLabel()}</p>
            </div>
            {loading && <Spinner className="h-5 w-5 text-red-400" />}
            {!loading && <Calendar className="h-6 w-6 text-neutral-400" />}
          </div>

          {/* Circulo de progreso */}
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
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - safeProgress.porcentaje / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.6s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-bold">
                  {safeProgress.porcentaje}%
                </span>
                <span className="text-xs text-neutral-400">completado</span>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <p className="text-sm text-neutral-300">Completadas</p>
              </div>
              <p className="text-2xl font-bold">{safeProgress.completadas}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-yellow-400" />
                <p className="text-sm text-neutral-300">Pendientes</p>
              </div>
              <p className="text-2xl font-bold">{safeProgress.pendientes}</p>
            </div>
          </div>
        </div>

        {/* Info adicional */}
        <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200">
          <div className="flex items-start gap-3">
            <Truck className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-neutral-900 mb-1">
                Total: {safeProgress.completadas + safeProgress.pendientes}
              </p>
              <p className="text-sm text-neutral-600">
                Inspecciones asignadas ({getDateLabel()})
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
