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

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export default function AdminCamionesPage() {
  const router = useRouter();

  const [tab, setTab] = useState<"SIN_AGENDA" | "PROGRAMADA" | "VENCIDA">("SIN_AGENDA");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  // Modal state (sirve para agendar y reagendar)
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [modalTitle, setModalTitle] = useState("Agendar inspección");
  const [fechaLocal, setFechaLocal] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return toDatetimeLocalValue(d);
  });
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setSelected(null);
    setModalError(null);
    setObs("");
  }

  function openAgendarModal(row: Row) {
    setSelected(row);
    setModalError(null);
    setObs("");
    setModalTitle("Agendar inspección");

    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    setFechaLocal(toDatetimeLocalValue(d));

    setOpen(true);
  }

  function openReagendarModal(row: Row) {
    setSelected(row);
    setModalError(null);
    setObs("");
    setModalTitle("Reagendar inspección");

    const iso = row.inspeccionProgramada?.fechaProgramada;
    if (iso) {
      const d = new Date(iso);
      setFechaLocal(toDatetimeLocalValue(d));
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      setFechaLocal(toDatetimeLocalValue(d));
    }

    setOpen(true);
  }

  async function cancelar(row: Row) {
    const idInspeccion = row.inspeccionProgramada?.id;
    if (!idInspeccion) return;

    const ok = confirm(`¿Cancelar inspección programada para ${row.patente}?`);
    if (!ok) return;

    const res = await fetch(`/api/admin/inspecciones/${idInspeccion}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CANCELAR" }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      alert(data?.error ?? "No se pudo cancelar");
      return;
    }

    await load();
  }

  async function saveAgendaOrReagenda() {
    if (!selected) return;

    setSaving(true);
    setModalError(null);

    try {
      if (!fechaLocal) {
        setModalError("Selecciona fecha y hora");
        return;
      }

      const fechaIso = new Date(fechaLocal).toISOString();

      const inspeccionId = selected.inspeccionProgramada?.id;

      const url = inspeccionId
        ? `/api/admin/inspecciones/${inspeccionId}`
        : "/api/admin/inspecciones";

      const method = inspeccionId ? "PATCH" : "POST";

      const payload = inspeccionId
        ? {
            action: "REAGENDAR",
            fechaProgramada: fechaIso,
            observaciones: obs.trim() ? obs.trim() : null,
          }
        : {
            camionId: selected.id,
            fechaProgramada: fechaIso,
            observaciones: obs.trim() ? obs.trim() : null,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setModalError(data?.error ?? "No se pudo guardar");
        return;
      }

      closeModal();
      await load();
    } catch (e: any) {
      setModalError(e?.message ?? "Error de red");
    } finally {
      setSaving(false);
    }
  }

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
        {(["SIN_AGENDA", "PROGRAMADA", "VENCIDA"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              fontWeight: 800,
              background: tab === t ? "#111" : "#fff",
              color: tab === t ? "#fff" : "#111",
              cursor: "pointer",
            }}
          >
            {t === "SIN_AGENDA" ? "Sin agenda" : t === "PROGRAMADA" ? "Programadas" : "Vencidas"}
          </button>
        ))}

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

      {error && <div style={{ color: "crimson", fontWeight: 800, marginBottom: 12 }}>{error}</div>}

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
              <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Acción</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 16, color: "#666" }}>
                  {loading ? "Cargando..." : "Sin resultados"}
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 12, fontWeight: 900 }}>{r.patente}</td>

                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 800 }}>{r.marca ?? "—"}</div>
                    <small style={{ color: "#666" }}>{r.modelo ?? ""}</small>
                  </td>

                  <td style={{ padding: 12 }}>{r.anio ?? "—"}</td>
                  <td style={{ padding: 12 }}>{r.carroceria ?? "—"}</td>

                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 800 }}>{r.empresa?.nombre ?? "—"}</div>
                    <small style={{ color: "#666" }}>{r.empresa?.rut ?? ""}</small>
                  </td>

                  {/* ✅ Estado + fecha programada bajo el estado */}
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 800 }}>{r.ui_estado}</div>

                    {r.ui_estado === "PROGRAMADA" && r.inspeccionProgramada?.fechaProgramada && (
                      <small style={{ color: "#666" }}>
                        {formatDateLocal(r.inspeccionProgramada.fechaProgramada)}
                      </small>
                    )}
                  </td>

                  <td style={{ padding: 12 }}>{formatDateLocal(r.createdAt)}</td>

                  {/* ✅ Acciones */}
                  <td style={{ padding: 12 }}>
                    {r.ui_estado === "SIN_AGENDA" ? (
                      <button
                        onClick={() => openAgendarModal(r)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #111",
                          background: "#111",
                          color: "#fff",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        Agendar
                      </button>
                    ) : r.ui_estado === "PROGRAMADA" ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => openReagendarModal(r)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #111",
                            background: "#fff",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Reagendar
                        </button>

                        <button
                          onClick={() => cancelar(r)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: "#666" }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal (Agendar/Reagendar) */}
      {open && selected && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #eee",
              padding: 18,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{modalTitle}</div>
                <div style={{ color: "#666", marginTop: 4 }}>
                  <b>{selected.patente}</b> · {selected.empresa?.nombre ?? "—"}
                </div>
              </div>

              <button
                onClick={closeModal}
                style={{
                  marginLeft: "auto",
                  border: "1px solid #ddd",
                  background: "#fff",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontWeight: 900,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontWeight: 800, marginBottom: 6 }}>
                  Fecha y hora
                </label>
                <input
                  type="datetime-local"
                  value={fechaLocal}
                  onChange={(e) => setFechaLocal(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                  }}
                  disabled={saving}
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 800, marginBottom: 6 }}>
                  Observaciones (opcional)
                </label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                  }}
                  disabled={saving}
                />
              </div>

              {modalError && <div style={{ color: "crimson", fontWeight: 800 }}>{modalError}</div>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={closeModal}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fff",
                    fontWeight: 900,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  onClick={saveAgendaOrReagenda}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
