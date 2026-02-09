"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, RefreshCw } from "lucide-react";
import AdminShell from "../_components/AdminShell";

type Inspector = {
  id: number;
  nombre: string | null;
  email: string | null;
  activo?: number | boolean | null;
};

export default function AdminInspectoresPage() {
  const [items, setItems] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // form crear
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [passwordInicial, setPasswordInicial] = useState("");

  // edición inline
  const [edit, setEdit] = useState<Record<number, Partial<Inspector>>>({});
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      const r = await fetch("/api/admin/inspectores", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error al cargar inspectores");
      const list = Array.isArray(j.inspectores) ? j.inspectores : (Array.isArray(j.data) ? j.data : []);
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
      [it.nombre, it.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
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

  async function crearInspector() {
    setErr("");
    setOk("");

    const n = nombre.trim();
    const e = email.trim().toLowerCase();
    const p = passwordInicial;

    if (!n || !e || !p) {
      setErr("Completa nombre, email y contraseña inicial.");
      return;
    }

    try {
      const r = await fetch("/api/admin/inspectores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nombre: n, email: e, passwordInicial: p }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "No se pudo crear inspector");

      setOk("Inspector creado.");
      setNombre("");
      setEmail("");
      setPasswordInicial("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  async function guardar(id: number) {
    setErr("");
    setOk("");
    const patch = edit[id] || {};

    if (!patch.nombre && !patch.email && patch.activo === undefined) {
      setErr("No hay cambios para guardar.");
      return;
    }

    try {
      const r = await fetch(`/api/admin/inspectores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "No se pudo guardar");

      setOk("Inspector actualizado.");
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

  async function resetPassword(id: number) {
    setErr("");
    setOk("");
    if (!confirm("¿Resetear contraseña? Se generará una nueva contraseña temporal.")) return;

    try {
      const r = await fetch(`/api/admin/inspectores/${id}/reset-password`, { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "No se pudo resetear");

      alert(`Contraseña temporal (mostrar una sola vez): ${j.passwordTemporal}`);
      setOk("Contraseña reseteada.");
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  function toggleActivo(id: number, current: any) {
    const next = !(current === 1 || current === true);
    setEdit((p) => ({ ...p, [id]: { ...p[id], activo: next } }));
  }

  const selected = items.find((it) => it.id === selectedId) || null;
  const selectedEdit = selected ? edit[selected.id] || {} : {};
  const dirty = selected ? Object.keys(selectedEdit).length > 0 : false;

  const nombreV = selected ? (selectedEdit.nombre ?? selected.nombre ?? "") : "";
  const emailV = selected ? (selectedEdit.email ?? selected.email ?? "") : "";
  const activoV = selected ? (selectedEdit.activo ?? selected.activo ?? 1) : 1;

  return (
    <AdminShell title="Inspectores" subtitle="Crear, editar, activar/desactivar y reset de contraseña.">
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

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Crear</div>
              <div className="mt-1 text-lg font-black text-gray-900">Nuevo Inspector</div>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_1fr_1fr_200px] gap-4">
            <input
              className="h-11 rounded-xl border border-gray-200 px-3 text-sm font-medium"
              placeholder="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <input
              className="h-11 rounded-xl border border-gray-200 px-3 text-sm font-medium"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="h-11 rounded-xl border border-gray-200 px-3 text-sm font-medium"
              placeholder="Contraseña inicial"
              value={passwordInicial}
              onChange={(e) => setPasswordInicial(e.target.value)}
            />
            <button
              onClick={crearInspector}
              disabled={loading}
              className="h-11 rounded-xl bg-gray-900 text-sm font-bold text-white shadow hover:bg-black"
            >
              Crear
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar inspector..."
              className="h-10 w-72 rounded-full border border-gray-200 bg-white pl-9 pr-4 text-sm font-medium text-gray-700 focus:border-red-300 focus:outline-none"
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

        <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Listado</div>
                <div className="mt-1 text-lg font-black text-gray-900">Inspectores</div>
              </div>
              <div className="text-xs font-semibold text-gray-400">{filtered.length} registros</div>
            </div>

            <div className="mt-4 space-y-3">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  No hay inspectores.
                </div>
              ) : (
                filtered.map((it) => {
                  const active = it.id === selectedId;
                  const isDirty = !!edit[it.id] && Object.keys(edit[it.id]).length > 0;
                  const isActive = (edit[it.id]?.activo ?? it.activo ?? 1) === 1 || (edit[it.id]?.activo ?? it.activo) === true;
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
                          <div className="text-xs text-gray-500">{it.email || "Sin email"}</div>
                        </div>
                        {isDirty ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                            Sin guardar
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                          isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {isActive ? "Activo" : "Inactivo"}
                        </span>
                        <span>ID {it.id}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            {!selected ? (
              <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500">
                Selecciona un inspector para ver detalle.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Detalle</div>
                    <div className="mt-1 text-2xl font-black text-gray-900">
                      {selected.nombre || "Inspector"}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">ID #{selected.id}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => guardar(selected.id)}
                      className="rounded-full bg-gray-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow hover:bg-black"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => resetPassword(selected.id)}
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 hover:bg-gray-50"
                    >
                      Reset password
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
                      className="mt-2 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm font-medium"
                      value={nombreV as string}
                      onChange={(e) => setEdit((p) => ({ ...p, [selected.id]: { ...p[selected.id], nombre: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Email</label>
                    <input
                      className="mt-2 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm font-medium"
                      value={emailV as string}
                      onChange={(e) => setEdit((p) => ({ ...p, [selected.id]: { ...p[selected.id], email: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Estado</label>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={activoV === 1 || activoV === true}
                        onChange={() => toggleActivo(selected.id, activoV)}
                        className="h-5 w-5 accent-red-600"
                      />
                      <span className="text-sm font-semibold text-gray-700">Activo</span>
                    </div>
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
