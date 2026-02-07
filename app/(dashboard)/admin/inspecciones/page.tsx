"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "../_components/AdminShell";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

// ==========================================
// TIPOS ACTUALIZADOS (SIN ANIDACIÓN EXTRA)
// ==========================================
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
    fechaProgramada: string | null; // ISO string
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
  fechaInspeccion: string | null;
  inspectorNombre: string | null;
  resultado: string | null;
};

type ReviewDetail = {
  id: number;
  itemId: string;
  estado: string;
  descripcionFalla: string | null;
  motivoNoAplica: string | null;
  categoria: string | null;
};

// CAMBIO 1: Estructura plana que coincide con la API nueva
type ReviewData = {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  empresa: string;
  inspector_nombre: string;     // API devuelve inspector_nombre
  resultado_general: string;    // API devuelve resultado_general
  nota_final: number | null;    // API devuelve nota_final
  fecha_inspeccion: string | null;
  revision_admin: string | null;
  comentario_admin: string | null;
  
  detalles: ReviewDetail[];
  fotos: any[]; // Agregamos fotos
};

// ==========================================
// HELPERS DE FECHA
// ==========================================
function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

// Devuelve YYYY-MM-DD local
function toYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Formato visual amigable (DD/MM/YYYY)
function formatDateLocal(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function AdminInspeccionesPage() {
  const router = useRouter();

  const [view, setView] = useState<"AGENDAR" | "REALIZADAS">("AGENDAR");

  // =========================
  // ESTADO: AGENDAR
  // =========================
  const [tab, setTab] = useState<"SIN_AGENDA" | "PROGRAMADA" | "VENCIDA">("SIN_AGENDA");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [inspectores, setInspectores] = useState<Inspector[]>([]);
  const [loadingInspectores, setLoadingInspectores] = useState(false);

  // Modal Agendar
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [modalTitle, setModalTitle] = useState("Agendar inspección");
  
  // AHORA: fechaLocal solo guarda "YYYY-MM-DD"
  const [fechaLocal, setFechaLocal] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Mañana por defecto
    return toYYYYMMDD(d);
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
      const res = await fetch("/api/admin/inspectores", { method: "GET" });
      const data = await res.json().catch(() => null);
      if (data?.ok && Array.isArray(data.inspectores)) {
        setInspectores(data.inspectores);
      }
    } catch {
      setInspectores([]);
    } finally {
      setLoadingInspectores(false);
    }
  }

  useEffect(() => {
    if (view === "AGENDAR") load();
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

    // Por defecto mañana
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setFechaLocal(toYYYYMMDD(d));

    setInspectorId("");
    setOpen(true);
  }

  function openReagendarModal(row: Row) {
    setSelected(row);
    setModalError(null);
    setObs("");
    setModalTitle("Reagendar inspección");

    const localStr = row.inspeccionProgramada?.fechaProgramada;
    if (localStr) {
      // Extraer solo la parte YYYY-MM-DD
      setFechaLocal(localStr.split("T")[0]);
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setFechaLocal(toYYYYMMDD(d));
    }

    const currentInspectorId = row.inspeccionProgramada?.inspector?.id;
    setInspectorId(currentInspectorId ? String(currentInspectorId) : "");

    setOpen(true);
  }

  async function cancelar(row: Row) {
    const idInspeccion = row.inspeccionProgramada?.id;
    if (!idInspeccion) return;
    if (!confirm(`¿Cancelar inspección programada para ${row.patente}?`)) return;

    const res = await fetch(`/api/admin/inspecciones/${idInspeccion}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CANCELAR" }),
    });

    if (res.ok) await load();
    else alert("Error al cancelar");
  }

  async function saveAgendaOrReagenda() {
    if (!selected) return;
    setSaving(true);
    setModalError(null);

    try {
      if (!fechaLocal) {
        setModalError("Selecciona una fecha");
        return;
      }

      const fechaProgramada = `${fechaLocal}T09:00:00`;

      const inspeccionId = selected.inspeccionProgramada?.id;
      const url = inspeccionId ? `/api/admin/inspecciones/${inspeccionId}` : "/api/admin/inspecciones";
      const method = inspeccionId ? "PATCH" : "POST";
      const inspectorIdValue = inspectorId && inspectorId.trim() ? Number(inspectorId) : null;

      const payload = inspeccionId
        ? {
            action: "REAGENDAR",
            fechaProgramada,
            inspectorId: inspectorIdValue,
            observaciones: obs.trim() || null,
          }
        : {
            camionId: selected.id,
            fechaProgramada,
            inspectorId: inspectorIdValue,
            observaciones: obs.trim() || null,
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

  // =========================
  // ESTADO: REALIZADAS
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

  // =========================
  // REVIEW MODAL
  // =========================
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAction, setReviewAction] = useState<"ACEPTAR" | "RECHAZAR" | "CORRECCION" | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [editNota, setEditNota] = useState<string>("");
  const [editResultado, setEditResultado] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  async function openReviewModal(row: RealizadaRow) {
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewError(null);
    setReviewComment("");
    setReviewAction(null);
    setIsEditing(false);
    setReviewData(null);
    try {
      const res = await fetch(`/api/admin/inspecciones/${row.id}/review`);
      const json = await res.json();
      
      // CAMBIO 2: Acceder directamente a 'data' porque ya no viene anidado en 'inspeccion'
      if (json.ok && json.data) {
        const datos = json.data;
        setReviewData(datos);
        
        // Mapeo corregido: nota_final y resultado_general
        setEditNota(datos.nota_final != null ? String(datos.nota_final) : "");
        setEditResultado(datos.resultado_general || "");
      } else {
        setReviewError(json.error || "Error al cargar");
      }
    } catch {
      setReviewError("Error de red");
    } finally {
      setReviewLoading(false);
    }
  }

  function closeReviewModal() {
    if (reviewSaving) return;
    setReviewOpen(false);
    setReviewData(null);
  }

  async function submitReview(actionOverride?: "ACEPTAR" | "RECHAZAR" | "CORRECCION") {
    const action = actionOverride || reviewAction;
    if (!action || !reviewData) return;
    if ((action === "RECHAZAR" || action === "CORRECCION") && !reviewComment.trim()) {
      setReviewError("Debes incluir un comentario.");
      return;
    }

    setReviewSaving(true);
    try {
      const payload: any = { action, comentario: reviewComment.trim() || null };
      if (action === "ACEPTAR" && isEditing) {
        payload.edits = {};
        const notaNum = Number(editNota);
        if (!isNaN(notaNum)) payload.edits.nota = notaNum;
        if (editResultado) payload.edits.resultado = editResultado;
      }

      // CAMBIO 3: Usar reviewData.id directo (sin .inspeccion)
      const res = await fetch(`/api/admin/inspecciones/${reviewData.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        closeReviewModal();
        await loadRealizadas();
      } else {
        const d = await res.json();
        setReviewError(d.error || "Error");
      }
    } catch {
      setReviewError("Error de red");
    } finally {
      setReviewSaving(false);
    }
  }

  async function loadRealizadas() {
    setRLoading(true);
    setRError(null);
    try {
      const params = new URLSearchParams();
      if (rFrom) params.set("from", rFrom);
      if (rTo) params.set("to", rTo);
      if (rPatente.trim()) params.set("patente", rPatente.trim());
      if (rEmpresa.trim()) params.set("empresa", rEmpresa.trim());

      const res = await fetch(`/api/admin/inspecciones/realizadas?${params.toString()}`);
      const data = await res.json();
      if (data.ok) setRRows(data.rows || []);
      else setRError(data.error);
    } catch {
      setRError("Error de red");
    } finally {
      setRLoading(false);
    }
  }

  useEffect(() => {
    if (view === "REALIZADAS") loadRealizadas();
  }, [view]);

  return (
    <AdminShell title="Inspecciones">
      <div style={{ padding: 24 }}>
        {/* HEADER TABS */}
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
        {/* VISTA: AGENDAR            */}
        {/* ========================= */}
        {view === "AGENDAR" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Agendar Inspección</h1>
              <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                <input
                  placeholder="Buscar patente..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ width: 300, padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
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
                  {loading ? "..." : "↻"}
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
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Empresa</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Estado</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Fecha</th>
                    <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #eee" }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 16, color: "#666" }}>
                        {loading ? "Cargando..." : "Sin resultados"}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => (
                      <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: 900 }}>{r.patente}</div>
                          <small style={{ color: "#666" }}>{r.marca} {r.modelo}</small>
                        </td>
                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: 900 }}>{r.empresa?.nombre ?? "—"}</div>
                        </td>
                        <td style={{ padding: 12 }}>
                          <span style={{
                            padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 900,
                            background: r.ui_estado === "PROGRAMADA" ? "#dcfce7" : r.ui_estado === "VENCIDA" ? "#fee2e2" : "#f3f4f6",
                            color: r.ui_estado === "PROGRAMADA" ? "#166534" : r.ui_estado === "VENCIDA" ? "#991b1b" : "#666"
                          }}>
                            {r.ui_estado}
                          </span>
                        </td>
                        <td style={{ padding: 12 }}>
                          {r.ui_estado === "SIN_AGENDA" ? "—" : (
                            <div>
                              <div>{formatDateLocal(r.inspeccionProgramada?.fechaProgramada)}</div>
                              <small style={{ color: "#666" }}>{r.inspeccionProgramada?.inspector?.nombre || "Sin inspector"}</small>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: 12 }}>
                          {r.ui_estado === "SIN_AGENDA" ? (
                            <button
                              onClick={() => openAgendarModal(r)}
                              style={{
                                padding: "8px 12px", borderRadius: 8, background: "#111", color: "#fff",
                                fontWeight: 900, cursor: "pointer", border: "none"
                              }}
                            >
                              Agendar
                            </button>
                          ) : (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => openReagendarModal(r)} style={{ cursor: "pointer", fontWeight: 900 }}>Editar</button>
                              <button onClick={() => cancelar(r)} style={{ cursor: "pointer", color: "crimson" }}>✕</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* MODAL AGENDAR */}
            {open && selected && (
              <div
                style={{
                  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50
                }}
                onClick={closeModal}
              >
                <div
                  style={{
                    width: 400, background: "#fff", borderRadius: 16, padding: 24,
                    boxShadow: "0 10px 25px rgba(0,0,0,0.1)"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ margin: "0 0 16px 0", fontSize: 20, fontWeight: 900 }}>{modalTitle}</h3>
                  
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Fecha de Inspección</label>
                    <input
                      type="date"
                      value={fechaLocal}
                      onChange={(e) => setFechaLocal(e.target.value)}
                      style={{
                        width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #ddd",
                        fontSize: 16, fontFamily: "inherit"
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Inspector (Opcional)</label>
                    <select
                      value={inspectorId}
                      onChange={(e) => setInspectorId(e.target.value)}
                      style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #ddd" }}
                    >
                      <option value="">Sin asignar</option>
                      {inspectores.map((i) => (
                        <option key={i.id} value={i.id}>{i.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Observaciones</label>
                    <textarea
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      rows={3}
                      style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #ddd" }}
                    />
                  </div>

                  {modalError && <div style={{ color: "crimson", marginBottom: 16 }}>{modalError}</div>}

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={closeModal} style={{ padding: "10px 16px", background: "#f3f4f6", borderRadius: 8, fontWeight: 700, cursor: "pointer", border: "none" }}>Cancelar</button>
                    <button
                      onClick={saveAgendaOrReagenda}
                      disabled={saving}
                      style={{ padding: "10px 16px", background: "#111", color: "#fff", borderRadius: 8, fontWeight: 700, cursor: saving ? "wait" : "pointer", border: "none" }}
                    >
                      {saving ? "Guardando..." : "Confirmar"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          // =========================
          // VISTA: REALIZADAS
          // =========================
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Inspecciones Realizadas</h1>
              <button onClick={loadRealizadas} style={{ marginLeft: "auto", padding: "8px 12px", background: "#fff", border: "1px solid #ddd", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                Actualizar
              </button>
            </div>
            
            {/* Filtros Realizadas */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <input type="date" value={rFrom} onChange={(e) => setRFrom(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
              <input type="date" value={rTo} onChange={(e) => setRTo(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
              <button onClick={loadRealizadas} style={{ padding: "8px 16px", background: "#111", color: "#fff", borderRadius: 8, fontWeight: 700, border: "none", cursor: "pointer" }}>Filtrar</button>
            </div>

            {/* Tabla Realizadas */}
            <div style={{ border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #eee" }}>Fecha</th>
                    <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #eee" }}>Patente</th>
                    <th style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #eee" }}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {rRows.map((r) => (
                    <tr key={r.id} onClick={() => openReviewModal(r)} style={{ cursor: "pointer", borderTop: "1px solid #eee" }}>
                      <td style={{ padding: 12 }}>{formatDateLocal(r.fechaInspeccion)}</td>
                      <td style={{ padding: 12, fontWeight: 900 }}>{r.patente}</td>
                      <td style={{ padding: 12 }}>{r.resultado}</td>
                    </tr>
                  ))}
                  {rRows.length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#666" }}>Sin resultados</td></tr>}
                </tbody>
              </table>
            </div>
            
{/* =================================================================================
                MODAL DE REVISIÓN (MEJORADO)
               ================================================================================= */}
            {reviewOpen && (
              <div
                style={{
                  position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60,
                  display: "flex", justifyContent: "center", alignItems: "center", padding: 20
                }}
                onClick={closeReviewModal}
              >
                <div
                  style={{
                    background: "#fff", borderRadius: 16, width: "100%", maxWidth: 800, maxHeight: "90vh",
                    display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.2)"
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* CABECERA DEL MODAL */}
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb" }}>
                    <div>
                      <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Revisión de Inspección</h2>
                      <p style={{ margin: 0, color: "#666", fontSize: 14 }}>{reviewData?.patente} — {reviewData?.empresa}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                       <span style={{ fontSize: 24, fontWeight: 900, color: (reviewData?.nota_final || 0) < 80 ? "#dc2626" : "#166534" }}>
                         {reviewData?.nota_final ?? 0}
                       </span>
                       <span style={{ fontSize: 14, color: "#999", fontWeight: 600 }}>/100</span>
                    </div>
                  </div>

                  {/* CONTENIDO SCROLLABLE */}
                  <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
                    {reviewLoading ? (
                      <p style={{ textAlign: "center", color: "#666" }}>Cargando detalles...</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        
                        {/* 1. SECCIÓN DE FOTOS */}
                        {reviewData?.fotos && reviewData.fotos.length > 0 && (
                          <div>
                            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>📸 Evidencia Fotográfica</h3>
                            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10 }}>
                              {reviewData.fotos.map((foto, idx) => (
                                <a key={idx} href={foto.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                                  <img 
                                    src={foto.url} 
                                    alt="Evidencia" 
                                    style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid #eee" }} 
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2. TABLA DE DETALLES (ITEMS) */}
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>📋 Lista de Verificación</h3>
                          <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                              <thead style={{ background: "#f3f4f6" }}>
                                <tr>
                                  <th style={{ padding: 10, textAlign: "left" }}>Ítem</th>
                                  <th style={{ padding: 10, textAlign: "left" }}>Estado</th>
                                  <th style={{ padding: 10, textAlign: "left" }}>Observación</th>
                                </tr>
                              </thead>
                              <tbody>
                                {reviewData?.detalles.map((d) => {
                                  // Estilos según estado
                                  const isBad = d.estado === "no_cumple" || d.estado === "malo";
                                  const color = isBad ? "#dc2626" : d.estado === "no_aplica" ? "#9ca3af" : "#166534";
                                  const bg = isBad ? "#fef2f2" : "transparent";
                                  
                                  return (
                                    <tr key={d.id} style={{ borderTop: "1px solid #eee", background: bg }}>
                                      <td style={{ padding: 10, fontWeight: 500 }}>{d.itemId} <br/><span style={{fontSize:11, color:"#999"}}>{d.categoria}</span></td>
                                      <td style={{ padding: 10, fontWeight: 700, color: color, textTransform: "uppercase", fontSize: 12 }}>
                                        {d.estado?.replace("_", " ")}
                                      </td>
                                      <td style={{ padding: 10, color: "#4b5563", fontStyle: "italic" }}>
                                        {d.descripcionFalla || "—"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>

                  {/* PIE DEL MODAL (ACCIONES) */}
                  <div style={{ padding: 20, borderTop: "1px solid #eee", background: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
                    
                    {/* Área de Comentario para Rechazo */}
                    {reviewAction === "RECHAZAR" && (
                       <textarea
                         placeholder="Motivo del rechazo (Obligatorio)..."
                         value={reviewComment}
                         onChange={e => setReviewComment(e.target.value)}
                         style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #f87171", outline: "none" }}
                       />
                    )}

                    <div style={{ display: "flex", gap: 12 }}>
                      <button 
                        onClick={closeReviewModal} 
                        style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}
                      >
                        Cancelar
                      </button>

                      <div style={{ flex: 1 }}></div>

                      {/* Botón Rechazar */}
                      {reviewAction !== "RECHAZAR" ? (
                         <button 
                           onClick={() => setReviewAction("RECHAZAR")} 
                           style={{ padding: "12px 20px", borderRadius: 10, background: "#fee2e2", color: "#991b1b", border: "none", fontWeight: 700, cursor: "pointer" }}
                         >
                           Rechazar
                         </button>
                      ) : (
                         <button 
                           onClick={() => submitReview("RECHAZAR")} 
                           disabled={reviewSaving}
                           style={{ padding: "12px 20px", borderRadius: 10, background: "#dc2626", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}
                         >
                           {reviewSaving ? "Guardando..." : "Confirmar Rechazo"}
                         </button>
                      )}

                      {/* Botón Aprobar */}
                      {reviewAction !== "RECHAZAR" && (
                        <button 
                          onClick={() => submitReview("ACEPTAR")} 
                          disabled={reviewSaving}
                          style={{ padding: "12px 24px", borderRadius: 10, background: "#166534", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(22, 101, 52, 0.2)" }}
                        >
                          {reviewSaving ? "Procesando..." : "✓ APROBAR INSPECCIÓN"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}