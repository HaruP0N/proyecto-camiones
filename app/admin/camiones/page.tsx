"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: number;
  patente: string;
  marca: string | null;
  modelo: string | null;
  anio: number | string | null;
  tipo: string | null;
  carroceria: string | null;
  createdAt: string | null;

  empresa: {
    id: number;
    nombre: string | null;
    rut: string | null;
    email?: string | null;
    telefono?: string | null;
  };

  ui_estado: "SIN_AGENDA" | "PROGRAMADA" | "VENCIDA" | string;
  inspeccionProgramada: null | {
    id: number;
    fechaProgramada: string | null;
    inspector: null | { id: number; nombre: string | null };
  };
};

function formatDateLocal(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminCamionesPage() {
  const router = useRouter();

  const [tab, setTab] = useState<"SIN_AGENDA" | "PROGRAMADA" | "VENCIDA">("SIN_AGENDA");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return rows;
    return rows.filter((r) => (r.patente ?? "").toUpperCase().includes(q));
  }, [rows, query]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("estado", tab);
      if (query.trim()) params.set("patente", query.trim());

      const res = await fetch(`/api/admin/camiones?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Error interno");
        setRows([]);
        return;
      }

      const camiones = Array.isArray(data.camiones) ? (data.camiones as Row[]) : [];
      setRows(camiones);
    } catch (e: any) {
      setError(e?.message ?? "Error de red");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Admin · Camiones</h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <input
            placeholder="Buscar por patente..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: 300,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
          />
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              background: "#fff",
            }}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => setTab("SIN_AGENDA")}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            fontWeight: 800,
            background: tab === "SIN_AGENDA" ? "#111" : "#fff",
            color: tab === "SIN_AGENDA" ? "#fff" : "#111",
            cursor: "pointer",
          }}
        >
          Sin agenda
        </button>

        <button
          onClick={() => setTab("PROGRAMADA")}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            fontWeight: 800,
            background: tab === "PROGRAMADA" ? "#111" : "#fff",
            color: tab === "PROGRAMADA" ? "#fff" : "#111",
            cursor: "pointer",
          }}
        >
          Programadas
        </button>

        <button
          onClick={() => setTab("VENCIDA")}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            fontWeight: 800,
            background: tab === "VENCIDA" ? "#111" : "#fff",
            color: tab === "VENCIDA" ? "#fff" : "#111",
            cursor: "pointer",
          }}
        >
          Vencidas
        </button>

        <button
          onClick={() => router.push("/")}
          style={{
            marginLeft: "auto",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            fontWeight: 800,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          ⌂ Inicio
        </button>
      </div>

      {error && (
        <div style={{ color: "crimson", fontWeight: 800, marginBottom: 12 }}>{error}</div>
      )}

      <div style={{ border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Patente</th>
              <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Marca / Modelo</th>
              <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Año</th>
              <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Carrocería</th>
              <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Empresa</th>
              <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Estado</th>
              <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Creado</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: "#666" }}>
                  {loading ? "Cargando..." : "Sin resultados"}
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => {
                const empNombre = r.empresa?.nombre ?? "—";
                const empRut = r.empresa?.rut ?? "";

                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 12, fontWeight: 900 }}>{r.patente}</td>

                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 800 }}>{r.marca ?? "—"}</div>
                      <small style={{ color: "#666" }}>{r.modelo ?? ""}</small>
                    </td>

                    <td style={{ padding: 12 }}>{r.anio ?? "—"}</td>

                    <td style={{ padding: 12 }}>{r.carroceria ?? "—"}</td>

                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 800 }}>{empNombre}</div>
                      <small style={{ color: "#666" }}>{empRut}</small>
                    </td>

                    <td style={{ padding: 12, fontWeight: 800 }}>{r.ui_estado ?? "SIN_AGENDA"}</td>

                    <td style={{ padding: 12 }}>{formatDateLocal(r.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

