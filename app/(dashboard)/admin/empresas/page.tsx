"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import AdminShell from "../_components/AdminShell"

type Empresa = {
  id: number
  nombre: string
  rut: string
  rubro: string
  email_contacto: string
  telefono_contacto: string
}

// ...existing code...

// helper: parse JSON sin romper si viene vacío o HTML
async function safeJson(res: Response) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const styles = {
  err: {
    color: "#b91c1c",
    background: "#fee2e2",
    border: "1px solid #fca5a5",
    padding: "8px 12px",
    borderRadius: "8px",
    marginBottom: "8px",
    fontWeight: "bold",
  },
  ok: {
    color: "#166534",
    background: "#dcfce7",
    border: "1px solid #86efac",
    padding: "8px 12px",
    borderRadius: "8px",
    marginBottom: "8px",
    fontWeight: "bold",
  },
}

export default function AdminEmpresasPage() {
  const [items, setItems] = useState<Empresa[]>([])
  const [edit, setEdit] = useState<Record<number, Partial<Empresa>>>({})
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [ok, setOk] = useState("")

  async function load() {
    setLoading(true)
    setErr("")
    setOk("")
    try {
      const r = await fetch("/api/admin/empresas", { cache: "no-store" })
      const j = await safeJson(r)

      if (!r.ok) {
        throw new Error(j?.error || `Error al cargar empresas (${r.status})`)
      }
      if (!j?.ok) {
        throw new Error(j?.error || "Respuesta inválida del servidor")
      }

      // ✅ AQUÍ ESTABA EL PROBLEMA: el backend entrega "empresas"
      const list = Array.isArray(j.empresas) ? j.empresas : []
      setItems(list)
    } catch (e: any) {
      setErr(e?.message || "Error")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function guardar(id: number) {
    setErr("")
    setOk("")
    const patch = edit[id] || {}

    try {
      const r = await fetch(`/api/admin/empresas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const j = await safeJson(r)

      if (!r.ok) throw new Error(j?.error || `Error al guardar empresa (${r.status})`)
      if (!j?.ok) throw new Error(j?.error || "No se pudo guardar")

      setOk("Empresa actualizada.")
      setEdit((p) => {
        const x = { ...p }
        delete x[id]
        return x
      })
      await load()
    } catch (e: any) {
      setErr(e?.message || "Error")
    }
  }

  async function resetPin(id: number) {
    setErr("")
    setOk("")
    if (!confirm("¿Resetear PIN del cliente? Se generará un PIN nuevo.")) return

    try {
      const r = await fetch(`/api/admin/empresas/${id}/reset-pin`, { method: "POST" })
      const j = await safeJson(r)

      if (!r.ok) throw new Error(j?.error || `Error al resetear PIN (${r.status})`)
      if (!j?.ok) throw new Error(j?.error || "No se pudo resetear")

      alert(`PIN nuevo (mostrar una sola vez): ${j.pinPlano}`)
      setOk("PIN reseteado.")
    } catch (e: any) {
      setErr(e?.message || "Error")
    }
  }

  return (
    <AdminShell title="Empresas" subtitle="Listado y edición de datos. (Reset PIN opcional)">
      {err ? <div style={styles.err}>{err}</div> : null}
      {ok ? <div style={styles.ok}>{ok}</div> : null}

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm max-w-4xl mx-auto mt-4">
        <div className="flex justify-between items-center mb-4">
          <div className="font-bold text-lg">Lista de empresas</div>
          <button className="px-4 py-2 rounded-lg border font-bold bg-white hover:bg-gray-50 text-gray-900" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
        <div className="mb-4">
          <Link href="/admin" className="inline-block px-4 py-2 rounded-lg border font-bold bg-gray-100 hover:bg-gray-200 text-gray-900">
            ← Volver
          </Link>
        </div>
        {/* Responsive Card for mobile */}
        <div className="md:hidden space-y-4">
          {items.length === 0 ? (
            <div className="text-gray-500 p-2">No hay empresas.</div>
          ) : (
            items.map((it) => {
              const local = edit[it.id] || {}
              const v = (k: keyof Empresa) => (local[k] ?? it[k]) ?? ""
              return (
                <div key={it.id} className="border rounded-lg p-3 bg-white shadow-sm">
                  <div className="font-bold mb-2">ID: {it.id}</div>
                  <div className="mb-2">
                    <label className="block text-sm font-semibold mb-1">Nombre</label>
                    <input className="w-full px-3 py-2 rounded-lg border" value={v("nombre") ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], nombre: e.target.value } }))} />
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-semibold mb-1">RUT</label>
                    <input className="w-full px-3 py-2 rounded-lg border" value={v("rut") ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], rut: e.target.value } }))} />
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-semibold mb-1">Rubro</label>
                    <input className="w-full px-3 py-2 rounded-lg border" value={v("rubro") ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], rubro: e.target.value } }))} />
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-semibold mb-1">Email</label>
                    <input className="w-full px-3 py-2 rounded-lg border" value={v("email_contacto") ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], email_contacto: e.target.value } }))} />
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-semibold mb-1">Teléfono</label>
                    <input className="w-full px-3 py-2 rounded-lg border" value={v("telefono_contacto") ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], telefono_contacto: e.target.value } }))} />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button className="px-4 py-2 rounded-lg border font-bold bg-gray-900 text-white" onClick={() => guardar(it.id)}>Guardar</button>
                    <button className="px-4 py-2 rounded-lg border font-bold bg-white" onClick={() => resetPin(it.id)}>Reset PIN</button>
                  </div>
                </div>
              )
            })
          )}
        </div>
        {/* Table for desktop */}
        <div className="hidden md:block mt-6">
          <table className="min-w-full border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50 text-gray-600 font-bold">
                <th className="px-3 py-2 border-b">ID</th>
                <th className="px-3 py-2 border-b">Nombre</th>
                <th className="px-3 py-2 border-b">RUT</th>
                <th className="px-3 py-2 border-b">Rubro</th>
                <th className="px-3 py-2 border-b">Email</th>
                <th className="px-3 py-2 border-b">Teléfono</th>
                <th className="px-3 py-2 border-b">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500 py-4">No hay empresas.</td>
                </tr>
              ) : (
                items.map((it) => {
                  const local = edit[it.id] || {}
                  const v = (k: keyof Empresa) => (local[k] ?? it[k]) ?? ""
                  return (
                    <tr key={it.id} className="border-t">
                      <td className="px-3 py-2 font-bold">{it.id}</td>
                      <td className="px-3 py-2">
                        <input className="w-full px-3 py-2 rounded-lg border" value={v("nombre") ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], nombre: e.target.value } }))} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="w-full px-3 py-2 rounded-lg border" value={v("rut") ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], rut: e.target.value } }))} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="w-full px-3 py-2 rounded-lg border" value={v("rubro") ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], rubro: e.target.value } }))} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="w-full px-3 py-2 rounded-lg border" value={v("email_contacto") ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], email_contacto: e.target.value } }))} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="w-full px-3 py-2 rounded-lg border" value={v("telefono_contacto") ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], telefono_contacto: e.target.value } }))} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button className="px-4 py-2 rounded-lg border font-bold bg-gray-900 text-white" onClick={() => guardar(it.id)}>Guardar</button>
                          <button className="px-4 py-2 rounded-lg border font-bold bg-white" onClick={() => resetPin(it.id)}>Reset PIN</button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  )
}
