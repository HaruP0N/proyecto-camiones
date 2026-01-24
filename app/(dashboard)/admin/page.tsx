"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "./_components/AdminShell";

type Kpis = {
  camionesTotal: number;
  empresasTotal: number;
  inspeccionesHoyProgramadas: number;
  inspeccionesSemanaProgramadas: number;
  inspeccionesVencidas: number;
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

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  background: "white",
};

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
  const [err, setErr] = useState<string>("");

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

        // 1) errores HTTP
        if (!r.ok) throw new Error(j?.error || "Error al cargar KPIs");

        // 2) errores con envelope ok:false aunque venga 200
        if (j?.ok === false) throw new Error(j?.error || "Error al cargar KPIs");

        // 3) soporta:
        // - antiguo: {camionesTotal,...}
        // - nuevo: {ok:true, data:{...}}
        const payload =
          j && typeof j === "object" && "data" in j ? (j as any).data : j;

        if (!isKpisShape(payload)) {
          throw new Error("Respuesta de KPIs inválida");
        }

        setKpis(payload);
      } catch (e: any) {
        setErr(e?.message || "Error");
        setKpis(null);
      }
    })();
  }, [qs]);

  return (
    <AdminShell title="Inicio" subtitle="Resumen rápido + accesos">
      {err ? (
        <div
          style={{
            ...card,
            borderColor: "#fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        <div style={card}>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>
            Camiones
          </div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>
            {kpis?.camionesTotal ?? "—"}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>
            Empresas
          </div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>
            {kpis?.empresasTotal ?? "—"}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>
            Programadas hoy
          </div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>
            {kpis?.inspeccionesHoyProgramadas ?? "—"}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>
            Programadas semana
          </div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>
            {kpis?.inspeccionesSemanaProgramadas ?? "—"}
          </div>
        </div>

        <div style={{ ...card, borderColor: "#fed7aa" }}>
          <div style={{ fontSize: 12, color: "#9a3412", fontWeight: 900 }}>
            Vencidas
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#9a3412" }}>
            {kpis?.inspeccionesVencidas ?? "—"}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        <Link
          href="/admin/inspectores"
          style={{ ...card, textDecoration: "none", color: "#111827" }}
        >
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Inspectores</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Crear/editar/activar/reset password
          </div>
        </Link>

        <Link
          href="/admin/empresas"
          style={{ ...card, textDecoration: "none", color: "#111827" }}
        >
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Empresas</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Editar datos + reset PIN
          </div>
        </Link>

        <Link
          href="/admin/camiones"
          style={{ ...card, textDecoration: "none", color: "#111827" }}
        >
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Agenda (actual)</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Tu panel existente sin cambios
          </div>
        </Link>
      </div>
    </AdminShell>
  );
}
