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

// ✅ Soporta "YYYY-MM-DDTHH:mm" sin timezone
function formatDateLocal(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value); // si viene "YYYY-MM-DDTHH:mm", lo toma como local
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function AdminCamionesPage() {
  const router = useRouter();

  const [tab, setTab] = useState<"SIN_AGENDA" | "PROGRAMADA" | "VENCIDA">("SIN_AGENDA");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  // ✅ Inspectores (para asignar)
  const [inspectores, setInspectores] = useState<Inspector[]>([]);
  const [loadingInspectores, setLoadingInspectores] = useState(false);

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
  const [inspectorId, setInspectorId] = useState<string>(""); // "" = sin asignar
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

  async function loadInspectores() {
    setLoadingInspectores(true);
    try {
      const res = await fetch("/api/admin/inspectores", { method: "GET", cache: "no-store", credentials: "include" });
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ✅ Cargar inspectores una vez
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

    // por defecto: sin inspector
    setInspectorId("");

    setOpen(true);
  }

  function openReagendarModal(row: Row) {
    setSelected(row);
    setModalError(null);
    setObs("");
    setModalTitle("Reagendar inspección");

    const localStr = row.inspeccionProgramada?.fechaProgramada;

    // ✅ FIX TZ: ya viene "YYYY-MM-DDTHH:mm", se setea directo
    if (localStr && typeof localStr === "string" && localStr.length >= 16) {
      setFechaLocal(localStr.slice(0, 16));
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      setFechaLocal(toDatetimeLocalValue(d));
    }

    // ✅ preseleccionar inspector actual si existe
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

      // ✅ enviar datetime-local tal cual
      const fechaProgramada = fechaLocal;

      const inspeccionId = selected.inspeccionProgramada?.id;

      const url = inspeccionId
        ? `/api/admin/inspecciones/${inspeccionId}`
        : "/api/admin/inspecciones";

      const method = inspeccionId ? "PATCH" : "POST";

      const inspectorIdValue =
        inspectorId && inspectorId.trim() ? Number(inspectorId) : null;

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

  return (
    <AdminShell title="Agenda" subtitle="Vista actual (sin cambios).">
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

                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 800 }}>{r.ui_estado}</div>

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

                {/* ✅ Inspector a cargo */}
                <div>
                  <label style={{ display: "block", fontWeight: 800, marginBottom: 6 }}>
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
    </AdminShell>
  );
}
