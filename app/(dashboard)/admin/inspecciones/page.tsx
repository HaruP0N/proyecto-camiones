"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "../_components/AdminShell";

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
    fechaProgramada: string | null; // "YYYY-MM-DDTHH:mm"
    inspector: null | { id: number; nombre: string | null };
  };
};

type Inspector = {
  id: number;
  nombre: string | null;
  email: string | null;
};

type RealizadaRow = {
  id: number;
  patente: string | null;
  empresaNombre: string | null;
  fechaInspeccion: string | null; // "YYYY-MM-DD HH:mm" o "YYYY-MM-DDTHH:mm"
  inspectorNombre: string | null;
  resultado: string | null;
};

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ✅ Soporta "YYYY-MM-DDTHH:mm" sin timezone
function formatDateLocal(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
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
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

export default function AdminCamionesPage() {
  const router = useRouter();

  const [view, setView] = useState<"AGENDAR" | "REALIZADAS">("AGENDAR");

  // =========================
  // AGENDAR (tu lógica actual)
  // =========================
  const [tab, setTab] = useState<"SIN_AGENDA" | "PROGRAMADA" | "VENCIDA">("SIN_AGENDA");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [inspectores, setInspectores] = useState<Inspector[]>([]);
  const [loadingInspectores, setLoadingInspectores] = useState(false);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [modalTitle, setModalTitle] = useState("Agendar inspección");
  const [fechaLocal, setFechaLocal] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return toDatetimeLocalValue(d);
  });
  const [inspectorId, setInspectorId] = useState<string>("");
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

      const res = await fetch(`/api/admin/inspecciones?${params.toString()}`, {
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

  async function loadInspectores() {
    setLoadingInspectores(true);
    try {
      const res = await fetch("/api/admin/inspectores", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setInspectores([]);
        return;
      }
      const list = Array.isArray(data.inspectores) ? (data.inspectores as Inspector[]) : [];
      setInspectores(list);
    } catch {
      setInspectores([]);
    } finally {
      setLoadingInspectores(false);
    }
  }

  useEffect(() => {
    if (view !== "AGENDAR") return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, view]);

  useEffect(() => {
    loadInspectores();
  }, []);

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setSelected(null);
    setModalError(null);
    setObs("");
    setInspectorId("");
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

    setInspectorId("");
    setOpen(true);
  }

  function openReagendarModal(row: Row) {
    setSelected(row);
    setModalError(null);
    setObs("");
    setModalTitle("Reagendar inspección");

    const localStr = row.inspeccionProgramada?.fechaProgramada;

    if (localStr && typeof localStr === "string" && localStr.length >= 16) {
      setFechaLocal(localStr.slice(0, 16));
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      setFechaLocal(toDatetimeLocalValue(d));
    }

    const currentInspectorId = row.inspeccionProgramada?.inspector?.id;
    setInspectorId(currentInspectorId ? String(currentInspectorId) : "");

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

    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {}

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

      const fechaProgramada = fechaLocal;
      const inspeccionId = selected.inspeccionProgramada?.id;

      const url = inspeccionId ? `/api/admin/inspecciones/${inspeccionId}` : "/api/admin/inspecciones";
      const method = inspeccionId ? "PATCH" : "POST";

      const inspectorIdValue = inspectorId && inspectorId.trim() ? Number(inspectorId) : null;

      const payload = inspeccionId
        ? {
            action: "REAGENDAR",
            fechaProgramada,
            inspectorId: inspectorIdValue,
            observaciones: obs.trim() ? obs.trim() : null,
          }
        : {
            camionId: selected.id,
            fechaProgramada,
            inspectorId: inspectorIdValue,
            observaciones: obs.trim() ? obs.trim() : null,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {}

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

  // =========================
  // REALIZADAS
  // =========================
  const [rFrom, setRFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toYYYYMMDD(d);
  });
  const [rTo, setRTo] = useState(() => toYYYYMMDD(new Date()));
  const [rPatente, setRPatente] = useState("");
  const [rEmpresa, setREmpresa] = useState("");
  const [rLoading, setRLoading] = useState(false);
  const [rError, setRError] = useState<string | null>(null);
  const [rRows, setRRows] = useState<RealizadaRow[]>([]);

  async function loadRealizadas() {
    setRLoading(true);
    setRError(null);
    try {
      const params = new URLSearchParams();
      if (rFrom) params.set("from", rFrom);
      if (rTo) params.set("to", rTo);
      if (rPatente.trim()) params.set("patente", rPatente.trim());
      if (rEmpresa.trim()) params.set("empresa", rEmpresa.trim());

      const res = await fetch(`/api/admin/inspecciones/realizadas?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setRError(data?.error ?? "Error interno");
        setRRows([]);
        return;
      }

      const list = Array.isArray(data.rows) ? (data.rows as RealizadaRow[]) : [];
      setRRows(list);
    } catch (e: any) {
      setRError(e?.message ?? "Error de red");
      setRRows([]);
    } finally {
      setRLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "REALIZADAS") return;
    loadRealizadas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <AdminShell title="Inspecciones">
      <div style={{ padding: 24 }}>
        {/* TOGGLE PRINCIPAL */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => setView("AGENDAR")}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              fontWeight: 900,
              background: view === "AGENDAR" ? "#111" : "#fff",
              color: view === "AGENDAR" ? "#fff" : "#111",
              cursor: "pointer",
            }}
          >
            Agendar
          </button>

          <button
            onClick={() => setView("REALIZADAS")}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              fontWeight: 900,
              background: view === "REALIZADAS" ? "#111" : "#fff",
              color: view === "REALIZADAS" ? "#fff" : "#111",
              cursor: "pointer",
            }}
          >
            Realizadas
          </button>
        </div>

        {/* ========================= */}
        {/* VISTA AGENDAR (tu UI) */}
        {/* ========================= */}
        {view === "AGENDAR" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Agendar Inspección</h1>

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
                    fontWeight: 900,
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
                    fontWeight: 900,
                    background: tab === t ? "#111" : "#fff",
                    color: tab === t ? "#fff" : "#111",
                    cursor: "pointer",
                  }}
                >
                  {t === "SIN_AGENDA" ? "Sin agenda" : t === "PROGRAMADA" ? "Programadas" : "Vencidas"}
                </button>
              ))}
            </div>

            {error && <div style={{ color: "crimson", fontWeight: 900, marginBottom: 12 }}>{error}</div>}

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
                          <div style={{ fontWeight: 900 }}>{r.marca ?? "—"}</div>
                          <small style={{ color: "#666" }}>{r.modelo ?? ""}</small>
                        </td>

                        <td style={{ padding: 12 }}>{r.anio ?? "—"}</td>
                        <td style={{ padding: 12 }}>{r.carroceria ?? "—"}</td>

                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: 900 }}>{r.empresa?.nombre ?? "—"}</div>
                          <small style={{ color: "#666" }}>{r.empresa?.rut ?? ""}</small>
                        </td>

                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: 900 }}>{r.ui_estado}</div>

                          {r.ui_estado === "PROGRAMADA" && r.inspeccionProgramada?.fechaProgramada && (
                            <small style={{ color: "#666" }}>
                              {formatDateLocal(r.inspeccionProgramada.fechaProgramada)}
                              {r.inspeccionProgramada.inspector?.nombre
                                ? ` · ${r.inspeccionProgramada.inspector.nombre}`
                                : ""}
                            </small>
                          )}
                        </td>

                        <td style={{ padding: 12 }}>{formatDateLocal(r.createdAt)}</td>

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
                      <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>
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
                      <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>
                        Inspector a cargo (opcional)
                      </label>
                      <select
                        value={inspectorId}
                        onChange={(e) => setInspectorId(e.target.value)}
                        disabled={saving || loadingInspectores}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: "#fff",
                        }}
                      >
                        <option value="">
                          {loadingInspectores ? "Cargando inspectores..." : "Sin asignar"}
                        </option>
                        {inspectores.map((i) => (
                          <option key={i.id} value={String(i.id)}>
                            {i.nombre ?? `Inspector #${i.id}`}{i.email ? ` · ${i.email}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>
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

                    {modalError && <div style={{ color: "crimson", fontWeight: 900 }}>{modalError}</div>}

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
          </>
        ) : (
          // =========================
          // VISTA REALIZADAS
          // =========================
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Inspecciones Realizadas</h1>

              <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                <button
                  onClick={loadRealizadas}
                  disabled={rLoading}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    fontWeight: 900,
                    cursor: rLoading ? "not-allowed" : "pointer",
                    background: "#fff",
                  }}
                >
                  {rLoading ? "Cargando..." : "Actualizar"}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "160px 160px 220px 1fr auto",
                gap: 10,
                marginBottom: 14,
                alignItems: "end",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 12, color: "#111" }}>Desde</div>
                <input
                  type="date"
                  value={rFrom}
                  onChange={(e) => setRFrom(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 12, color: "#111" }}>Hasta</div>
                <input
                  type="date"
                  value={rTo}
                  onChange={(e) => setRTo(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 12, color: "#111" }}>Patente</div>
                <input
                  placeholder="Ej: AB-CB-12"
                  value={rPatente}
                  onChange={(e) => setRPatente(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 12, color: "#111" }}>Empresa / RUT</div>
                <input
                  placeholder="Nombre o RUT"
                  value={rEmpresa}
                  onChange={(e) => setREmpresa(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <button
                  onClick={loadRealizadas}
                  disabled={rLoading}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: rLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {rLoading ? "Buscando..." : "Buscar"}
                </button>
              </div>
            </div>

            {rError && <div style={{ color: "crimson", fontWeight: 900, marginBottom: 12 }}>{rError}</div>}

            <div style={{ border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Fecha</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Patente</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Empresa</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Inspector</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Resultado</th>
                  </tr>
                </thead>

                <tbody>
                  {rRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 16, color: "#666" }}>
                        {rLoading ? "Cargando..." : "Sin resultados"}
                      </td>
                    </tr>
                  ) : (
                    rRows.map((r) => (
                      <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: 12, fontWeight: 900 }}>{formatDateLocal(r.fechaInspeccion)}</td>
                        <td style={{ padding: 12, fontWeight: 900 }}>{r.patente ?? "—"}</td>
                        <td style={{ padding: 12 }}>{r.empresaNombre ?? "—"}</td>
                        <td style={{ padding: 12 }}>{r.inspectorNombre ?? "—"}</td>
                        <td style={{ padding: 12 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "6px 10px",
                              borderRadius: 999,
                              border: "1px solid #ddd",
                              fontWeight: 900,
                              fontSize: 12,
                              background: "#fff",
                            }}
                          >
                            {r.resultado ?? "—"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}

