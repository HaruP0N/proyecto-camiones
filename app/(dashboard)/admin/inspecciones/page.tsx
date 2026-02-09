"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "../_components/AdminShell";

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
  seccion: string | null;
  nivel: string | null;
  estadoAdmin: string | null;
  comentarioAdmin: string | null;
};

type ReviewAction = "ACEPTAR" | "RECHAZAR" | "REAGENDAR";

// CAMBIO 1: Estructura plana que coincide con la API nueva
type ReviewData = {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  empresa: string;
  inspector_id: number | null;
  inspector_nombre: string;     // API devuelve inspector_nombre
  resultado_general: string;    // API devuelve resultado_general
  nota_final: number | null;    // API devuelve nota_final
  fecha_inspeccion: string | null;
  revision_admin: string | null;
  comentario_admin: string | null;
  
  detalles: ReviewDetail[];
  fotos: any[]; // Agregamos fotos
};

type EmpresaGroup = {
  key: string;
  nombre: string;
  rut: string | null;
  rows: Row[];
};

type RealizadaGroup = {
  key: string;
  nombre: string;
  rows: RealizadaRow[];
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

function normalizeEstado(value?: string | null) {
  if (!value) return "—";
  return value.replace(/_/g, " ").toUpperCase();
}

function isEstadoRechazado(value?: string | null) {
  if (!value) return false;
  const v = value.toUpperCase();
  return v.includes("RECHAZ") || v.includes("MALO") || v.includes("NO CUMPLE") || v.includes("NO_CUMPLE");
}

function estadoColor(value?: string | null) {
  if (!value) return "#6b7280";
  const v = value.toUpperCase();
  if (isEstadoRechazado(v)) return "#dc2626";
  if (v.includes("APROB")) return "#166534";
  if (v.includes("NO_APLICA") || v.includes("NO APLICA")) return "#6b7280";
  return "#374151";
}

function resultadoBadgeClasses(value?: string | null) {
  const v = (value || "").toUpperCase();
  if (v.includes("APROB")) {
    return "border-emerald-700 bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_8px_18px_-10px_rgba(16,185,129,0.9)]";
  }
  if (v.includes("RECHAZ") || v.includes("NO_CUMPLE") || v.includes("NO CUMPLE")) {
    return "border-rose-700 bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-[0_8px_18px_-10px_rgba(244,63,94,0.9)]";
  }
  if (v.includes("PEND")) {
    return "border-gray-300 bg-gradient-to-b from-gray-50 to-gray-200 text-gray-700 shadow-[0_6px_14px_-10px_rgba(107,114,128,0.6)]";
  }
  return "border-amber-400 bg-gradient-to-b from-amber-200 to-amber-400 text-amber-900 shadow-[0_6px_14px_-10px_rgba(251,191,36,0.7)]";
}

function humanizeItemId(value?: string | null) {
  if (!value) return "Sin ítem";
  const clean = value.replace(/_/g, " ").trim();
  return clean
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function normalizeKey(value?: string | null) {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function AdminInspeccionesPage() {
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const filteredRows = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return rows;
    return rows.filter((r) => (r.patente ?? "").toUpperCase().includes(q));
  }, [rows, query]);

  const groupedRows = useMemo<EmpresaGroup[]>(() => {
    const map = new Map<string, EmpresaGroup>();
    filteredRows.forEach((r) => {
      const key = String(r.empresa?.id ?? "sin-empresa");
      const nombre = r.empresa?.nombre || "Sin empresa";
      const rut = r.empresa?.rut ?? null;
      const current = map.get(key);
      if (current) {
        current.rows.push(r);
      } else {
        map.set(key, { key, nombre, rut, rows: [r] });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [filteredRows]);

  useEffect(() => {
    if (groupedRows.length === 0) {
      setOpenGroups({});
      return;
    }
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = {};
      groupedRows.forEach((g) => {
        if (Object.prototype.hasOwnProperty.call(prev, g.key)) {
          next[g.key] = !!prev[g.key];
        }
      });
      if (Object.keys(next).length === 0) {
        next[groupedRows[0].key] = true;
      }
      return next;
    });
  }, [groupedRows]);

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
  const [openRealizadasGroups, setOpenRealizadasGroups] = useState<Record<string, boolean>>({});

  const groupedRealizadas = useMemo<RealizadaGroup[]>(() => {
    const map = new Map<string, RealizadaGroup>();
    rRows.forEach((r) => {
      const nombre = r.empresaNombre || "Sin empresa";
      const key = nombre.toLowerCase();
      const current = map.get(key);
      if (current) {
        current.rows.push(r);
      } else {
        map.set(key, { key, nombre, rows: [r] });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [rRows]);

  useEffect(() => {
    if (groupedRealizadas.length === 0) {
      setOpenRealizadasGroups({});
      return;
    }
    setOpenRealizadasGroups((prev) => {
      const next: Record<string, boolean> = {};
      groupedRealizadas.forEach((g) => {
        if (Object.prototype.hasOwnProperty.call(prev, g.key)) {
          next[g.key] = !!prev[g.key];
        }
      });
      if (Object.keys(next).length === 0) {
        next[groupedRealizadas[0].key] = true;
      }
      return next;
    });
  }, [groupedRealizadas]);

  // =========================
  // REVIEW MODAL
  // =========================
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [openCategorias, setOpenCategorias] = useState<Record<string, boolean>>({});
  const [itemEdits, setItemEdits] = useState<Record<number, { estadoAdmin?: string | null; comentarioAdmin?: string | null }>>({});
  const [reagendaFecha, setReagendaFecha] = useState<string>("");
  const [reagendaInspector, setReagendaInspector] = useState<string>("");
  const [reagendaObs, setReagendaObs] = useState<string>("");

  async function openReviewModal(row: RealizadaRow) {
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewError(null);
    setReviewComment("");
    setReviewAction(null);
    setItemEdits({});
    setOpenCategorias({});
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setReagendaFecha(toYYYYMMDD(d));
    setReagendaInspector("");
    setReagendaObs("");
    setReviewData(null);
    try {
      const res = await fetch(`/api/admin/inspecciones/${row.id}/review`);
      const json = await res.json();
      
      // CAMBIO 2: Acceder directamente a 'data' porque ya no viene anidado en 'inspeccion'
      if (json.ok && json.data) {
        const datos = json.data;
        setReviewData(datos);
        setReviewComment(datos.comentario_admin || "");
        if (datos?.inspector_id) {
          setReagendaInspector(String(datos.inspector_id));
        }
        if (Array.isArray(datos?.detalles)) {
          const nextEdits: Record<number, { estadoAdmin?: string | null; comentarioAdmin?: string | null }> = {};
          datos.detalles.forEach((d: ReviewDetail) => {
            if (d.estadoAdmin || d.comentarioAdmin) {
              nextEdits[d.id] = {
                estadoAdmin: d.estadoAdmin ?? null,
                comentarioAdmin: d.comentarioAdmin ?? null,
              };
            }
          });
          setItemEdits(nextEdits);
          if (datos.detalles.length > 0) {
            const firstCat = datos.detalles[0]?.categoria || "General";
            setOpenCategorias((prev) => ({ ...prev, [firstCat]: true }));
          }
        }
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

  function getAdminEstado(det: ReviewDetail) {
    const edit = itemEdits[det.id];
    if (edit && Object.prototype.hasOwnProperty.call(edit, "estadoAdmin")) {
      return edit.estadoAdmin ?? null;
    }
    return det.estadoAdmin ?? null;
  }

  function getAdminComentario(det: ReviewDetail) {
    const edit = itemEdits[det.id];
    if (edit && Object.prototype.hasOwnProperty.call(edit, "comentarioAdmin")) {
      return edit.comentarioAdmin ?? null;
    }
    return det.comentarioAdmin ?? null;
  }

  function getFinalEstado(det: ReviewDetail) {
    const admin = getAdminEstado(det);
    return admin || det.estado;
  }

  function buildItemsPayload() {
    return Object.entries(itemEdits).map(([key, edit]) => ({
      id: Number(key),
      estadoAdmin: typeof edit.estadoAdmin === "string" ? edit.estadoAdmin : null,
      comentarioAdmin:
        typeof edit.comentarioAdmin === "string" && edit.comentarioAdmin.trim()
          ? edit.comentarioAdmin.trim()
          : null,
    }));
  }

  const groupedDetalles = useMemo(() => {
    if (!reviewData?.detalles || reviewData.detalles.length === 0) return [];
    const order = [
      "Frenos",
      "Neumáticos y Ruedas",
      "Chasis y Estructura",
      "Acople / Quinta Rueda",
      "Luces y Señalización",
      "Sistema Eléctrico",
      "Sistema de Fluidos",
      "Suspensión",
      "Cabina",
      "Equipo de Seguridad",
      "Accesos",
      "Estético / Confort",
      "Carrocería",
      "Sistema de Frío",
      "Compartimientos",
      "Documentación",
      "General",
    ];
    const map = new Map<string, ReviewDetail[]>();
    reviewData.detalles.forEach((d) => {
      const key = d.categoria || "General";
      const list = map.get(key) || [];
      list.push(d);
      map.set(key, list);
    });
    const groups = Array.from(map.entries()).map(([categoria, items]) => ({
      categoria,
      items,
    }));
    const orderIndex = new Map(order.map((k, i) => [k, i]));
    groups.sort((a, b) => {
      const ai = orderIndex.has(a.categoria) ? (orderIndex.get(a.categoria) as number) : 999;
      const bi = orderIndex.has(b.categoria) ? (orderIndex.get(b.categoria) as number) : 999;
      return ai - bi || a.categoria.localeCompare(b.categoria);
    });
    return groups;
  }, [reviewData]);

  const fotosPorCategoria = useMemo(() => {
    const map = new Map<string, any[]>();
    if (!reviewData?.fotos) return map;
    reviewData.fotos.forEach((f) => {
      const key = normalizeKey(f.categoria || "General");
      const list = map.get(key) || [];
      list.push(f);
      map.set(key, list);
    });
    return map;
  }, [reviewData]);

  async function submitReview() {
    const action = reviewAction;
    if (!action || !reviewData) return;

    const needsComment = action === "RECHAZAR" || action === "REAGENDAR";
    if (needsComment && !reviewComment.trim()) {
      setReviewError("Debes incluir un comentario.");
      return;
    }

    if (action === "REAGENDAR" && !reagendaFecha) {
      setReviewError("Debes seleccionar fecha para reagendar.");
      return;
    }

    setReviewSaving(true);
    try {
      const payload: any = {
        action,
        comentario: reviewComment.trim() || null,
        items: buildItemsPayload(),
      };

      if (action === "REAGENDAR") {
        const inspectorIdValue = reagendaInspector && reagendaInspector.trim() ? Number(reagendaInspector) : null;
        payload.reagenda = {
          fechaProgramada: reagendaFecha.includes("T") ? reagendaFecha : `${reagendaFecha}T09:00:00`,
          inspectorId: Number.isFinite(inspectorIdValue) ? inspectorIdValue : null,
          observaciones: reagendaObs.trim() || null,
        };
      }

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
    <AdminShell title="Inspecciones" subtitle="Agenda, seguimiento y revisión de inspecciones.">
      <div className="space-y-6">
        <div className="flex gap-3">
          <button
            onClick={() => setView("AGENDAR")}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition ${view === "AGENDAR" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700"}`}
          >
            Agendar
          </button>
          <button
            onClick={() => setView("REALIZADAS")}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition ${view === "REALIZADAS" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700"}`}
          >
            Realizadas
          </button>
        </div>

        {/* ========================= */}
        {/* VISTA: AGENDAR            */}
        {/* ========================= */}
        {view === "AGENDAR" ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Agenda</div>
                <h1 className="mt-2 text-2xl font-black text-gray-900">Agendar Inspección</h1>
              </div>
              <div className="flex items-center gap-3">
                <input
                  placeholder="Buscar patente..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-10 w-72 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 focus:border-red-300 focus:outline-none"
                />
                <button
                  onClick={load}
                  disabled={loading}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {loading ? "Cargando" : "Refrescar"}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              {(["SIN_AGENDA", "PROGRAMADA", "VENCIDA"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${tab === t ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700"}`}
                >
                  {t === "SIN_AGENDA" ? "Sin agenda" : t === "PROGRAMADA" ? "Programadas" : "Vencidas"}
                </button>
              ))}
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div className="grid grid-cols-[160px_1fr_140px_200px_160px] gap-4 border-b border-gray-100 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                <div>Patente</div>
                <div>Empresa</div>
                <div>Estado</div>
                <div>Fecha</div>
                <div>Acción</div>
              </div>
              <div className="space-y-4 p-4">
                {groupedRows.length === 0 ? (
                  <div className="px-2 py-6 text-sm text-gray-500">
                    {loading ? "Cargando..." : "Sin resultados"}
                  </div>
                ) : (
                  groupedRows.map((group) => {
                    const isOpen = !!openGroups[group.key];
                    return (
                      <div key={group.key} className="rounded-2xl border border-gray-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setOpenGroups((p) => ({ ...p, [group.key]: !p[group.key] }))}
                          className="w-full px-5 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center font-black">
                              {(group.nombre || "E").slice(0, 1).toUpperCase()}
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-bold text-gray-900">{group.nombre}</div>
                              <div className="text-xs text-gray-500">RUT {group.rut || "—"}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-semibold text-gray-500">
                            <span className="rounded-full bg-white px-3 py-1 border border-gray-200">
                              {group.rows.length} camiones
                            </span>
                            <span>{isOpen ? "Ocultar" : "Ver"}</span>
                          </div>
                        </button>

                        {isOpen ? (
                          <div className="divide-y divide-gray-100">
                            {group.rows.map((r) => (
                              <div key={r.id} className="grid grid-cols-[160px_1fr_140px_200px_160px] items-center gap-4 px-6 py-4">
                                <div>
                                  <div className="text-sm font-bold text-gray-900">{r.patente}</div>
                                  <div className="text-xs text-gray-400">{r.marca} {r.modelo}</div>
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">{r.empresa?.nombre ?? "—"}</div>
                                  <div className="text-xs text-gray-400">{r.empresa?.rut ?? ""}</div>
                                </div>
                                <div>
                                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${r.ui_estado === "PROGRAMADA" ? "bg-emerald-100 text-emerald-700" : r.ui_estado === "VENCIDA" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                                    {r.ui_estado}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-700">
                                  {r.ui_estado === "SIN_AGENDA" ? (
                                    "—"
                                  ) : (
                                    <div>
                                      <div className="font-semibold">{formatDateLocal(r.inspeccionProgramada?.fechaProgramada)}</div>
                                      <div className="text-xs text-gray-400">{r.inspeccionProgramada?.inspector?.nombre || "Sin inspector"}</div>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  {r.ui_estado === "SIN_AGENDA" ? (
                                    <button
                                      onClick={() => openAgendarModal(r)}
                                      className="rounded-full bg-gray-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
                                    >
                                      Agendar
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-3 text-sm font-semibold">
                                      <button onClick={() => openReagendarModal(r)} className="text-gray-700 hover:text-gray-900">
                                        Editar
                                      </button>
                                      <button onClick={() => cancelar(r)} className="text-red-600 hover:text-red-700">
                                        Cancelar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* MODAL AGENDAR */}
            {open && selected && (
              <div className="fixed inset-0 z-50">
                <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
                <aside
                  className="absolute right-0 top-0 h-full w-[420px] bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Agenda</div>
                      <h3 className="mt-2 text-2xl font-black text-gray-900">{modalTitle}</h3>
                      <div className="mt-2 text-sm text-gray-500">
                        {selected.patente} · {selected.empresa?.nombre ?? "Sin empresa"}
                      </div>
                    </div>
                    <button
                      onClick={closeModal}
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="mt-8 space-y-5">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Fecha de inspección</label>
                      <input
                        type="date"
                        value={fechaLocal}
                        onChange={(e) => setFechaLocal(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Inspector</label>
                      <select
                        value={inspectorId}
                        onChange={(e) => setInspectorId(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-medium"
                      >
                        <option value="">Sin asignar</option>
                        {inspectores.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nombre}
                          </option>
                        ))}
                      </select>
                      {loadingInspectores ? (
                        <div className="mt-2 text-xs text-gray-400">Cargando inspectores...</div>
                      ) : null}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Observaciones</label>
                      <textarea
                        value={obs}
                        onChange={(e) => setObs(e.target.value)}
                        rows={4}
                        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium"
                      />
                    </div>

                    {modalError && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        {modalError}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={closeModal}
                        className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={saveAgendaOrReagenda}
                        disabled={saving}
                        className="flex-1 rounded-full bg-gray-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
                      >
                        {saving ? "Guardando..." : "Confirmar"}
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </>
        ) : (
          // =========================
          // VISTA: REALIZADAS
          // =========================
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Histórico</div>
                <h1 className="mt-2 text-2xl font-black text-gray-900">Inspecciones Realizadas</h1>
              </div>
              <button
                onClick={loadRealizadas}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Actualizar
              </button>
            </div>
            
            {/* Filtros Realizadas */}
            <div className="flex flex-wrap items-center gap-3">
              <input type="date" value={rFrom} onChange={(e) => setRFrom(e.target.value)} className="h-10 rounded-full border border-gray-200 bg-white px-4 text-sm" />
              <input type="date" value={rTo} onChange={(e) => setRTo(e.target.value)} className="h-10 rounded-full border border-gray-200 bg-white px-4 text-sm" />
              <input type="text" value={rPatente} onChange={(e) => setRPatente(e.target.value)} placeholder="Patente..." className="h-10 w-40 rounded-full border border-gray-200 bg-white px-4 text-sm" />
              <input type="text" value={rEmpresa} onChange={(e) => setREmpresa(e.target.value)} placeholder="Empresa..." className="h-10 w-56 rounded-full border border-gray-200 bg-white px-4 text-sm" />
              <button onClick={loadRealizadas} className="h-10 rounded-full bg-gray-900 px-5 text-sm font-bold text-white">Filtrar</button>
            </div>

            {/* Lista Realizadas */}
            <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div className="space-y-4 p-4">
                {groupedRealizadas.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-gray-500">Sin resultados</div>
                ) : (
                  groupedRealizadas.map((group) => {
                    const isOpen = !!openRealizadasGroups[group.key];
                    return (
                      <div key={group.key} className="rounded-2xl border border-gray-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setOpenRealizadasGroups((p) => ({ ...p, [group.key]: !p[group.key] }))}
                          className="w-full px-5 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
                              {(group.nombre || "E").slice(0, 1).toUpperCase()}
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-bold text-gray-900">{group.nombre}</div>
                              <div className="text-xs text-gray-500">{group.rows.length} inspecciones</div>
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-gray-500">{isOpen ? "Ocultar" : "Ver"}</div>
                        </button>

                        {isOpen ? (
                          <div>
                            <div className="grid grid-cols-[160px_140px_1fr_160px] gap-4 border-b border-gray-100 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                              <div>Fecha</div>
                              <div>Patente</div>
                              <div>Inspector</div>
                              <div>Resultado</div>
                            </div>
                            <div className="divide-y divide-gray-100">
                              {group.rows.map((r) => (
                                <div
                                  key={r.id}
                                  onClick={() => openReviewModal(r)}
                                  className="grid cursor-pointer grid-cols-[160px_140px_1fr_160px] items-center gap-4 px-6 py-4 hover:bg-gray-50"
                                >
                                  <div className="text-sm font-semibold text-gray-700">
                                    {formatDateLocal(r.fechaInspeccion)}
                                  </div>
                                  <div className="text-sm font-black text-gray-900">{r.patente}</div>
                                  <div>
                                    <div className="text-sm font-semibold text-gray-900">{r.inspectorNombre || "Sin inspector"}</div>
                                  </div>
                                  <div>
                                    <span
                                      className={`inline-flex items-center justify-center rounded-full border px-4 py-1 text-xs font-extrabold uppercase tracking-[0.18em] shadow-sm ${resultadoBadgeClasses(
                                        r.resultado
                                      )}`}
                                    >
                                      {normalizeEstado(r.resultado || "PENDIENTE")}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            
{/* =================================================================================
                MODAL DE REVISIÓN (MEJORADO)
               ================================================================================= */}
            {reviewOpen && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.6)",
                  zIndex: 60,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 20,
                }}
                onClick={closeReviewModal}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    width: "100%",
                    maxWidth: 980,
                    maxHeight: "90vh",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* CABECERA DEL MODAL */}
                  <div
                    style={{
                      padding: "20px 24px",
                      borderBottom: "1px solid #eee",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#f9fafb",
                      gap: 16,
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
                        Revisión de Inspección
                      </h2>
                      <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
                        {reviewData?.patente} — {reviewData?.empresa}
                      </p>
                      <p style={{ margin: 0, color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
                        Inspector: {reviewData?.inspector_nombre || "—"} · {formatDateLocal(reviewData?.fecha_inspeccion)}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 4 }}>
                        <span
                          style={{
                            fontSize: 24,
                            fontWeight: 900,
                            color: (reviewData?.nota_final || 0) < 80 ? "#dc2626" : "#166534",
                          }}
                        >
                          {reviewData?.nota_final ?? 0}
                        </span>
                        <span style={{ fontSize: 14, color: "#999", fontWeight: 600 }}>/100</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                        Resultado: {normalizeEstado(reviewData?.resultado_general)}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>
                        Revisión: {normalizeEstado(reviewData?.revision_admin || "PENDIENTE")}
                      </div>
                    </div>
                  </div>

                  {/* CONTENIDO SCROLLABLE */}
                  <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
                    {reviewLoading ? (
                      <p style={{ textAlign: "center", color: "#666" }}>Cargando detalles...</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        {/* LISTA DE VERIFICACIÓN POR CATEGORÍA */}
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
                            Lista de Verificación
                          </h3>
                          <div className="space-y-4">
                            {groupedDetalles.map((group, idx) => {
                              const isOpen = openCategorias[group.categoria] ?? idx === 0;
                              const fotosCat = fotosPorCategoria.get(normalizeKey(group.categoria)) || [];
                              const key = group.categoria;
                              return (
                                <div key={key} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenCategorias((prev) => ({ ...prev, [key]: !isOpen }))
                                    }
                                    className="w-full px-5 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
                                  >
                                    <div className="flex items-center gap-3 text-left">
                                      <div className="h-9 w-9 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
                                        {group.categoria.slice(0, 1).toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="text-sm font-extrabold text-gray-900">{group.categoria}</div>
                                        <div className="text-xs text-gray-500">{group.items.length} ítems</div>
                                      </div>
                                    </div>
                                    <div className="text-xs font-semibold text-gray-500">{isOpen ? "Ocultar" : "Ver"}</div>
                                  </button>

                                  {isOpen && (
                                    <div className="p-5 space-y-4">
                                      {fotosCat.length > 0 && (
                                        <div>
                                          <div className="text-xs font-extrabold text-gray-500 uppercase tracking-[0.2em] mb-2">
                                            Evidencia de la categoría
                                          </div>
                                          <div className="flex gap-10 overflow-x-auto pb-2">
                                            {fotosCat.map((foto, fidx) => (
                                              <a
                                                key={`${key}-foto-${fidx}`}
                                                href={foto.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ flexShrink: 0 }}
                                              >
                                                <img
                                                  src={foto.url}
                                                  alt="Evidencia"
                                                  style={{
                                                    width: 120,
                                                    height: 120,
                                                    objectFit: "cover",
                                                    borderRadius: 10,
                                                    border: "1px solid #e5e7eb",
                                                  }}
                                                />
                                              </a>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      <div className="space-y-3">
                                        {group.items.map((d) => {
                                          const adminEstado = getAdminEstado(d);
                                          const finalEstado = getFinalEstado(d);
                                          const adminComentario = getAdminComentario(d);
                                          const metaParts = [d.seccion, d.nivel].filter(Boolean).join(" · ");
                                          const rechazado = isEstadoRechazado(finalEstado);

                                          return (
                                            <div
                                              key={d.id}
                                              className={`rounded-2xl border p-4 shadow-sm transition ${
                                                rechazado ? "border-red-200 bg-red-50/60" : "border-gray-200 bg-white"
                                              }`}
                                            >
                                              <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                  <div className="text-sm font-extrabold text-gray-900">
                                                    {humanizeItemId(d.itemId)}
                                                  </div>
                                                  {metaParts ? (
                                                    <div className="text-xs text-gray-500 mt-1">{metaParts}</div>
                                                  ) : null}
                                                  <div className="mt-2 text-xs text-gray-600">
                                                    {d.descripcionFalla || d.motivoNoAplica || "—"}
                                                  </div>
                                                </div>
                                                <div className="shrink-0">
                                                  <span
                                                    className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-extrabold uppercase"
                                                    style={{ color: estadoColor(d.estado) }}
                                                  >
                                                    {normalizeEstado(d.estado)}
                                                  </span>
                                                </div>
                                              </div>

                                              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.4fr]">
                                                <div>
                                                  <label className="text-[11px] font-extrabold text-gray-500 uppercase">
                                                    Decisión admin
                                                  </label>
                                                  <select
                                                    value={adminEstado ?? "MANTENER"}
                                                    onChange={(e) => {
                                                      const value = e.target.value;
                                                      setItemEdits((prev) => ({
                                                        ...prev,
                                                        [d.id]: {
                                                          ...prev[d.id],
                                                          estadoAdmin: value === "MANTENER" ? null : value,
                                                        },
                                                      }));
                                                    }}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
                                                  >
                                                    <option value="MANTENER">Mantener inspector</option>
                                                    <option value="APROBADO">Aprobar</option>
                                                    <option value="RECHAZADO">Rechazar</option>
                                                    <option value="NO_APLICA">No aplica</option>
                                                  </select>
                                                  <div
                                                    className="mt-2 text-[11px] font-extrabold"
                                                    style={{ color: estadoColor(finalEstado) }}
                                                  >
                                                    Final: {normalizeEstado(finalEstado)}
                                                  </div>
                                                </div>

                                                <div>
                                                  <label className="text-[11px] font-extrabold text-gray-500 uppercase">
                                                    Comentario admin
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={adminComentario ?? ""}
                                                    onChange={(e) => {
                                                      const value = e.target.value;
                                                      setItemEdits((prev) => ({
                                                        ...prev,
                                                        [d.id]: {
                                                          ...prev[d.id],
                                                          comentarioAdmin: value,
                                                        },
                                                      }));
                                                    }}
                                                    placeholder="Comentario admin (opcional)"
                                                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PIE DEL MODAL (ACCIONES) */}
                  <div
                    style={{
                      padding: 20,
                      borderTop: "1px solid #eee",
                      background: "#fff",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {reviewError && (
                      <div
                        style={{
                          background: "#fef2f2",
                          color: "#991b1b",
                          padding: "10px 12px",
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {reviewError}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {([
                        { id: "ACEPTAR", label: "Aceptar", color: "#166534" },
                        { id: "RECHAZAR", label: "Rechazar", color: "#dc2626" },
                        { id: "REAGENDAR", label: "Reagendar", color: "#1d4ed8" },
                      ] as { id: ReviewAction; label: string; color: string }[]).map((action) => {
                        const active = reviewAction === action.id;
                        return (
                          <button
                            key={action.id}
                            onClick={() => {
                              setReviewAction(action.id);
                              setReviewError(null);
                            }}
                            style={{
                              padding: "10px 14px",
                              borderRadius: 10,
                              fontWeight: 800,
                              cursor: "pointer",
                              border: `1px solid ${active ? action.color : "#e5e7eb"}`,
                              background: active ? action.color : "#fff",
                              color: active ? "#fff" : "#111827",
                            }}
                          >
                            {action.label}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>
                        Comentario general {reviewAction && (reviewAction === "RECHAZAR" || reviewAction === "REAGENDAR") ? "(obligatorio)" : "(opcional)"}
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Escribe una observación general para el inspector o para auditoría..."
                        style={{
                          width: "100%",
                          padding: 10,
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                          minHeight: 70,
                        }}
                      />
                    </div>

                    {reviewAction === "REAGENDAR" && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "grid", gap: 6 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>Fecha</label>
                          <input
                            type="date"
                            value={reagendaFecha}
                            onChange={(e) => setReagendaFecha(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                              fontWeight: 600,
                            }}
                          />
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>Inspector</label>
                          <select
                            value={reagendaInspector}
                            onChange={(e) => setReagendaInspector(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                              fontWeight: 600,
                            }}
                          >
                            <option value="">Sin asignar</option>
                            {inspectores.map((i) => (
                              <option key={i.id} value={String(i.id)}>
                                {i.nombre || i.email || `Inspector ${i.id}`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ gridColumn: "1 / -1", display: "grid", gap: 6 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>Observaciones</label>
                          <textarea
                            value={reagendaObs}
                            onChange={(e) => setReagendaObs(e.target.value)}
                            placeholder="Mensaje para el inspector al reagendar..."
                            style={{
                              width: "100%",
                              padding: 10,
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                              minHeight: 70,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <button
                        onClick={closeReviewModal}
                        style={{
                          padding: "12px 20px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: "#fff",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Cancelar
                      </button>

                      <div style={{ flex: 1 }}></div>

                      <button
                        onClick={submitReview}
                        disabled={!reviewAction || reviewSaving}
                        style={{
                          padding: "12px 24px",
                          borderRadius: 10,
                          background: reviewAction ? "#111827" : "#9ca3af",
                          color: "#fff",
                          border: "none",
                          fontWeight: 800,
                          cursor: reviewAction ? "pointer" : "not-allowed",
                          boxShadow: reviewAction ? "0 4px 12px rgba(17, 24, 39, 0.2)" : "none",
                        }}
                      >
                        {reviewSaving ? "Guardando..." : "Guardar decisión"}
                      </button>
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
