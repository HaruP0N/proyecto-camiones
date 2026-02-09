"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Truck, Building2, CalendarDays, BarChart3, AlertTriangle } from "lucide-react";
import AdminShell from "./_components/AdminShell";

type Kpis = {
  camionesTotal: number;
  empresasTotal: number;
  inspeccionesHoyProgramadas: number;
  inspeccionesSemanaProgramadas: number;
  inspeccionesVencidas: number;
};

type DashboardStats = {
  resultados: {
    aprobado: number;
    observado: number;
    rechazado: number;
  };
  cumplimiento: {
    realizadas: number;
    vencidas: number;
    total: number;
  };
  categorias: Array<{
    categoria: string;
    cantidad: number;
  }>;
  topEmpresas: Array<{
    nombre: string;
    total: number;
  }>;
};

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toLocalYYYYMMDDTHHMM(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 0, 0);
  return x;
}

function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function endOfWeekSunday(d: Date) {
  const x = startOfWeekMonday(d);
  x.setDate(x.getDate() + 6);
  return endOfDay(x);
}

function isKpisShape(x: any): x is Kpis {
  return (
    x &&
    typeof x === "object" &&
    typeof x.camionesTotal === "number" &&
    typeof x.empresasTotal === "number" &&
    typeof x.inspeccionesHoyProgramadas === "number" &&
    typeof x.inspeccionesSemanaProgramadas === "number" &&
    typeof x.inspeccionesVencidas === "number"
  );
}

export default function AdminHomePage() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [err, setErr] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const qs = useMemo(() => {
    const now = new Date();
    const todayStart = toLocalYYYYMMDDTHHMM(startOfDay(now));
    const todayEnd = toLocalYYYYMMDDTHHMM(endOfDay(now));
    const weekStart = toLocalYYYYMMDDTHHMM(startOfWeekMonday(now));
    const weekEnd = toLocalYYYYMMDDTHHMM(endOfWeekSunday(now));
    const nowLocal = toLocalYYYYMMDDTHHMM(now);

    return new URLSearchParams({
      todayStart,
      todayEnd,
      weekStart,
      weekEnd,
      nowLocal,
    }).toString();
  }, []);

  useEffect(() => {
    (async () => {
      setErr("");
      try {
        const r = await fetch(`/api/admin/kpis?${qs}`, { cache: "no-store" });
        const j = await r.json().catch(() => null);

        if (!r.ok) throw new Error(j?.error || "Error al cargar KPIs");
        if (j?.ok === false) throw new Error(j?.error || "Error al cargar KPIs");

        const payload = j && typeof j === "object" && "data" in j ? (j as any).data : j;
        if (!isKpisShape(payload)) throw new Error("Respuesta de KPIs inválida");

        setKpis(payload);
      } catch (e: any) {
        setErr(e?.message || "Error");
        setKpis(null);
      }
    })();
  }, [qs]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/admin/dashboard-stats", { cache: "no-store" });
        const j = await r.json();

        if (!r.ok || !j?.ok) throw new Error(j?.error || "Error al cargar estadísticas");

        setStats({
          resultados: j.resultados || { aprobado: 0, observado: 0, rechazado: 0 },
          cumplimiento: j.cumplimiento || { realizadas: 0, vencidas: 0, total: 0 },
          categorias: j.categorias || [],
          topEmpresas: j.topEmpresas || [],
        });
      } catch (e: any) {
        console.error("Error cargando stats:", e);
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminShell
      title="Panel de Control"
      subtitle="Resumen ejecutivo de inspecciones, cumplimiento y operación diaria"
    >
      <div className="space-y-8">
        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            ⚠️ {err}
          </div>
        ) : null}

        <section className="grid grid-cols-5 gap-6">
          <StatCard
            title="Total de Camiones Registrados"
            value={kpis?.camionesTotal ?? 0}
            loading={!kpis}
            icon={<Truck className="h-5 w-5" />}
          />
          <StatCard
            title="Total de Empresas Activas"
            value={kpis?.empresasTotal ?? 0}
            loading={!kpis}
            icon={<Building2 className="h-5 w-5" />}
          />
          <StatCard
            title="Inspecciones Programadas Hoy"
            value={kpis?.inspeccionesHoyProgramadas ?? 0}
            loading={!kpis}
            icon={<CalendarDays className="h-5 w-5" />}
          />
          <StatCard
            title="Inspecciones Programadas Esta Semana"
            value={kpis?.inspeccionesSemanaProgramadas ?? 0}
            loading={!kpis}
            icon={<BarChart3 className="h-5 w-5" />}
          />
          <StatCard
            title="Inspecciones Vencidas"
            value={kpis?.inspeccionesVencidas ?? 0}
            loading={!kpis}
            variant="alert"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </section>

        <section className="flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">
              Desempeño
            </div>
            <h2 className="mt-2 text-2xl font-black text-gray-900">Análisis de Rendimiento</h2>
            <p className="mt-1 text-sm text-gray-500">
              Métricas de calidad, cumplimiento y resultados operativos
            </p>
          </div>
          <div className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-500">
            Actualizado hoy
          </div>
        </section>

        <section className="grid grid-cols-2 gap-6">
          <ChartCard title="Resultados de Inspecciones (últimos 30 días)">
            {loading || !stats ? <LoadingSpinner /> : <ResultadosChart resultados={stats.resultados} />}
          </ChartCard>

          <ChartCard title="Tasa de Cumplimiento (este mes)">
            {loading || !stats ? <LoadingSpinner /> : <CumplimientoChart cumplimiento={stats.cumplimiento} />}
          </ChartCard>
        </section>
      </div>
    </AdminShell>
  );
}

function StatCard({
  title,
  value,
  loading,
  variant = "default",
  icon,
}: {
  title: string;
  value: number;
  loading: boolean;
  variant?: "default" | "alert";
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border px-5 py-4 shadow-sm transition-all ${
        variant === "alert"
          ? "border-red-200 bg-red-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-red-500/10 blur-2xl" />
      <div className="relative flex items-center gap-3 text-sm font-semibold text-gray-500">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
            variant === "alert"
              ? "border-red-200 bg-red-100 text-red-600"
              : "border-gray-200 bg-gray-50 text-gray-600"
          }`}
        >
          {icon}
        </div>
        <span>{title}</span>
      </div>
      <div
        className={`mt-4 text-4xl font-black tracking-tight ${
          variant === "alert" ? "text-red-700" : "text-gray-900"
        }`}
      >
        {loading ? "..." : value}
      </div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
        Registro
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">{title}</h3>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-semibold uppercase text-gray-500">
          30 días
        </span>
      </div>
      {children}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex h-[260px] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-red-600" />
    </div>
  );
}

function ResultadosChart({
  resultados,
}: {
  resultados: { aprobado: number; observado: number; rechazado: number };
}) {
  const total = resultados.aprobado + resultados.observado + resultados.rechazado;

  if (total === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm font-semibold text-gray-400">
        Sin datos disponibles
      </div>
    );
  }

  const data = [
    { label: "Aprobadas", value: resultados.aprobado, color: "#10B981" },
    { label: "Observadas", value: resultados.observado, color: "#F59E0B" },
    { label: "Rechazadas", value: resultados.rechazado, color: "#DC2626" },
  ];

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex h-[260px] flex-col gap-6">
      <div className="flex flex-1 items-end gap-6 px-4">
        {data.map((d, idx) => {
          const heightPercent = (d.value / max) * 100;
          return (
            <div key={idx} className="flex flex-1 flex-col items-center">
              <div
                className="flex w-full items-center justify-center rounded-t-2xl text-white shadow-lg"
                style={{
                  height: `${Math.max(heightPercent, 8)}%`,
                  background: d.color,
                  minHeight: 60,
                }}
              >
                <span className="text-2xl font-black">{d.value}</span>
              </div>
              <div className="mt-3 text-xs font-bold text-gray-700">{d.label}</div>
              <div className="text-[10px] font-semibold text-gray-400">
                {((d.value / total) * 100).toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CumplimientoChart({
  cumplimiento,
}: {
  cumplimiento: { realizadas: number; vencidas: number; total: number };
}) {
  if (cumplimiento.total === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm font-semibold text-gray-400">
        Sin datos disponibles
      </div>
    );
  }

  const tasaCumplimiento = (cumplimiento.realizadas / cumplimiento.total) * 100;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (tasaCumplimiento / 100) * circumference;

  return (
    <div className="flex h-[260px] items-center justify-center gap-10">
      <svg width="180" height="180">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#F3F4F6" strokeWidth="20" />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke={tasaCumplimiento >= 80 ? "#10B981" : tasaCumplimiento >= 50 ? "#F59E0B" : "#DC2626"}
          strokeWidth="20"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 90 90)"
        />
        <text x="90" y="85" textAnchor="middle" fontSize="36" fontWeight="900" fill="#111827">
          {tasaCumplimiento.toFixed(0)}%
        </text>
        <text x="90" y="105" textAnchor="middle" fontSize="12" fontWeight="600" fill="#6B7280">
          Cumplimiento
        </text>
      </svg>

      <div className="flex flex-col gap-4">
        <div>
          <div className="text-xs font-semibold text-gray-500">Realizadas</div>
          <div className="text-3xl font-black text-emerald-500">{cumplimiento.realizadas}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-500">Vencidas</div>
          <div className="text-3xl font-black text-red-600">{cumplimiento.vencidas}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-500">Total</div>
          <div className="text-2xl font-black text-gray-900">{cumplimiento.total}</div>
        </div>
      </div>
    </div>
  );
}
