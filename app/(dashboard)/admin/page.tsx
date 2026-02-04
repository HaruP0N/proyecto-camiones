"use client";

import React, { useEffect, useMemo, useState } from "react";
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
    <AdminShell title="Panel de Control">
      {err ? (
        <div
          style={{
            background: "#FEE",
            border: "2px solid #DC2626",
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            color: "#DC2626",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          ⚠️ {err}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard
          title="Total de Camiones Registrados"
          value={kpis?.camionesTotal ?? 0}
          loading={!kpis}
          icon={<TruckIcon />}
        />
        <StatCard
          title="Total de Empresas Activas"
          value={kpis?.empresasTotal ?? 0}
          loading={!kpis}
          icon={<BuildingIcon />}
        />
        <StatCard
          title="Inspecciones Programadas Hoy"
          value={kpis?.inspeccionesHoyProgramadas ?? 0}
          loading={!kpis}
          icon={<CalendarIcon />}
        />
        <StatCard
          title="Inspecciones Programadas Esta Semana"
          value={kpis?.inspeccionesSemanaProgramadas ?? 0}
          loading={!kpis}
          icon={<ChartIcon />}
        />
        <StatCard
          title="Inspecciones Vencidas"
          value={kpis?.inspeccionesVencidas ?? 0}
          loading={!kpis}
          variant="alert"
          icon={<AlertIcon />}
        />
      </div>

      <div
        style={{
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: "2px solid #E5E7EB",
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 6,
          }}
        >
          Análisis de Rendimiento
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#6B7280",
            margin: 0,
          }}
        >
          Métricas de desempeño y calidad de inspecciones
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <ChartCard title="Resultados de Inspecciones (últimos 30 días)">
          {loading || !stats ? (
            <LoadingSpinner />
          ) : (
            <ResultadosChart resultados={stats.resultados} />
          )}
        </ChartCard>

        <ChartCard title="Tasa de Cumplimiento (este mes)">
          {loading || !stats ? (
            <LoadingSpinner />
          ) : (
            <CumplimientoChart cumplimiento={stats.cumplimiento} />
          )}
        </ChartCard>
      </div>
    </AdminShell>
  );
}

function TruckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h3l3 3v5h-2" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
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
      style={{
        background: variant === "alert" ? "#FEE2E2" : "white",
        border: `2px solid ${variant === "alert" ? "#DC2626" : "#E5E7EB"}`,
        borderRadius: 12,
        padding: 20,
        minHeight: 140,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          color: variant === "alert" ? "#DC2626" : "#6B7280",
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#6B7280",
          marginBottom: 8,
          lineHeight: 1.3,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 42,
          fontWeight: 900,
          color: variant === "alert" ? "#DC2626" : "#111827",
          letterSpacing: -1,
        }}
      >
        {loading ? "..." : value}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: 24,
        minHeight: 350,
      }}
    >
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 20,
          textAlign: "center",
          letterSpacing: 0.3,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div
      style={{
        height: 280,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "4px solid #E5E7EB",
          borderTop: "4px solid #DC2626",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
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
      <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 14, fontWeight: 600 }}>
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
    <div style={{ height: 280, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 20, padding: "0 20px" }}>
        {data.map((d, idx) => {
          const heightPercent = (d.value / max) * 100;
          return (
            <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(heightPercent, 5)}%`,
                  background: d.color,
                  borderRadius: "8px 8px 0 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: 900,
                  fontSize: 24,
                  minHeight: 60,
                }}
              >
                {d.value}
              </div>
              <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "#374151", textAlign: "center" }}>
                {d.label}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>
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
      <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 14, fontWeight: 600 }}>
        Sin datos disponibles
      </div>
    );
  }

  const tasaCumplimiento = (cumplimiento.realizadas / cumplimiento.total) * 100;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (tasaCumplimiento / 100) * circumference;

  return (
    <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Realizadas</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#10B981" }}>{cumplimiento.realizadas}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Vencidas</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#DC2626" }}>{cumplimiento.vencidas}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>{cumplimiento.total}</div>
        </div>
      </div>
    </div>
  );
}