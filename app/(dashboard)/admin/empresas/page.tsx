"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, RefreshCw, ArrowLeft } from "lucide-react";
import AdminShell from "../_components/AdminShell";

type Empresa = {
  id: number;
  nombre: string;
  rut: string;
  rubro: string;
  email_contacto: string;
  telefono_contacto: string;
};

// helper: parse JSON sin romper si viene vacío o HTML
async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function AdminEmpresasPage() {
  const [items, setItems] = useState<Empresa[]>([]);
  const [edit, setEdit] = useState<Record<number, Partial<Empresa>>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      const r = await fetch("/api/admin/empresas", { cache: "no-store" });
      const j = await safeJson(r);

      if (!r.ok) {
        throw new Error(j?.error || `Error al cargar empresas (${r.status})`);
      }
      if (!j?.ok) {
        throw new Error(j?.error || "Respuesta inválida del servidor");
      }

      const list = Array.isArray(j.empresas) ? j.empresas : [];
      setItems(list);
    } catch (e: any) {
      setErr(e?.message || "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.nombre, it.rut, it.rubro, it.email_contacto, it.telefono_contacto]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, search]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((it) => it.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = items.find((it) => it.id === selectedId) || null;
  const selectedEdit = selected ? edit[selected.id] || {} : {};
  const dirty = selected ? Object.keys(selectedEdit).length > 0 : false;
  const v = (k: keyof Empresa) => (selectedEdit[k] ?? selected?.[k]) ?? "";

  function updateField(id: number, key: keyof Empresa, value: string) {
    setEdit((p) => ({ ...p, [id]: { ...p[id], [key]: value } }));
  }

  async function guardar(id: number) {
    setErr("");
    setOk("");
    const patch = edit[id] || {};

    try {
      const r = await fetch(`/api/admin/empresas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await safeJson(r);

      if (!r.ok) throw new Error(j?.error || `Error al guardar empresa (${r.status})`);
      if (!j?.ok) throw new Error(j?.error || "No se pudo guardar");

      setOk("Empresa actualizada.");
      setEdit((p) => {
        const x = { ...p };
        delete x[id];
        return x;
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  async function resetPin(id: number) {
    setErr("");
    setOk("");
    if (!confirm("¿Resetear PIN del cliente? Se generará un PIN nuevo.")) return;

    try {
      const r = await fetch(`/api/admin/empresas/${id}/reset-pin`, { method: "POST" });
      const j = await safeJson(r);

      if (!r.ok) throw new Error(j?.error || `Error al resetear PIN (${r.status})`);
      if (!j?.ok) throw new Error(j?.error || "No se pudo resetear");

      alert(`PIN nuevo (mostrar una sola vez): ${j.pinPlano}`);
      setOk("PIN reseteado.");
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  return (
    <AdminShell title="Empresas" subtitle="Gestión de datos y reseteo de PIN">
      <div className="space-y-6">
        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            ⚠️ {err}
          </div>
        ) : null}
        {ok ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            ✓ {ok}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empresa, RUT o contacto..."
                className="h-10 w-80 rounded-full border border-gray-200 bg-white pl-9 pr-4 text-sm font-medium text-gray-700 focus:border-red-300 focus:outline-none"
              />
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Cargando" : "Refrescar"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[420px_minmax(0,1fr)] gap-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Listado</div>
                <div className="mt-1 text-lg font-black text-gray-900">Empresas</div>
              </div>
              <div className="text-xs font-semibold text-gray-400">{filtered.length} registros</div>
            </div>

            <div className="mt-4 space-y-3">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  No hay empresas.
                </div>
              ) : (
                filtered.map((it) => {
                  const active = it.id === selectedId;
                  const isDirty = !!edit[it.id] && Object.keys(edit[it.id]).length > 0;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setSelectedId(it.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                        active
                          ? "border-red-200 bg-red-50 shadow-sm"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{it.nombre || "Sin nombre"}</div>
                          <div className="text-xs text-gray-500">RUT: {it.rut || "—"}</div>
                        </div>
                        {isDirty ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                            Sin guardar
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                        <div>Rubro: {it.rubro || "—"}</div>
                        <div>Email: {it.email_contacto || "—"}</div>
                        <div>Tel: {it.telefono_contacto || "—"}</div>
                        <div>ID: {it.id}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            {!selected ? (
              <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500">
                Selecciona una empresa para ver detalle.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Detalle</div>
                    <div className="mt-1 text-2xl font-black text-gray-900">
                      {selected.nombre || "Empresa"}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      ID #{selected.id} · RUT {selected.rut || "—"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => guardar(selected.id)}
                      className="rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow hover:bg-black"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => resetPin(selected.id)}
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Reset PIN
                    </button>
                  </div>
                </div>

                {dirty ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
                    Hay cambios sin guardar.
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Nombre</label>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-medium"
                      value={v("nombre")}
                      onChange={(e) => updateField(selected.id, "nombre", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">RUT</label>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-medium"
                      value={v("rut")}
                      onChange={(e) => updateField(selected.id, "rut", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Rubro</label>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-medium"
                      value={v("rubro")}
                      onChange={(e) => updateField(selected.id, "rubro", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Email</label>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-medium"
                      value={v("email_contacto")}
                      onChange={(e) => updateField(selected.id, "email_contacto", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Teléfono</label>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-medium"
                      value={v("telefono_contacto")}
                      onChange={(e) => updateField(selected.id, "telefono_contacto", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
