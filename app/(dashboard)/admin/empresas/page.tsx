"use client"

import React, { useEffect, useState } from "react"
import AdminShell from "../_components/AdminShell"

type Empresa = {
  id: number
  nombre: string
  rut: string
  rubro: string
  email_contacto: string
  telefono_contacto: string
}

const styles: Record<string, React.CSSProperties> = {
  card: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "white" },
  input: { width: "100%", padding: "10px 10px", borderRadius: 10, border: "1px solid #e5e7eb", outline: "none" },
  btn: { padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 800, cursor: "pointer", background: "#111827", color: "white" },
  btnSoft: { padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 800, cursor: "pointer", background: "white" },
  row: {
    display: "grid",
    gridTemplateColumns: "90px 1fr 160px 180px 180px 180px 240px",
    gap: 10,
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #eee",
  },
  err: { border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", borderRadius: 14, padding: 10, marginBottom: 12, fontWeight: 800 },
  ok: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 14, padding: 10, marginBottom: 12, fontWeight: 800 },
}

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

      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 900 }}>Lista de empresas</div>
          <button style={styles.btnSoft} onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>

        <div style={{ ...styles.row, fontWeight: 900, color: "#6b7280" }}>
          <div>ID</div>
          <div>Nombre</div>
          <div>RUT</div>
          <div>Rubro</div>
          <div>Email</div>
          <div>Teléfono</div>
          <div>Acciones</div>
        </div>

        {items.map((it) => {
          const local = edit[it.id] || {}
          const v = (k: keyof Empresa) => (local[k] ?? it[k]) as string

          return (
            <div key={it.id} style={styles.row}>
              <div style={{ fontWeight: 900 }}>{it.id}</div>

              <input style={styles.input} value={v("nombre")} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], nombre: e.target.value } }))} />
              <input style={styles.input} value={v("rut")} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], rut: e.target.value } }))} />
              <input style={styles.input} value={v("rubro")} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], rubro: e.target.value } }))} />
              <input style={styles.input} value={v("email_contacto")} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], email_contacto: e.target.value } }))} />
              <input style={styles.input} value={v("telefono_contacto")} onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], telefono_contacto: e.target.value } }))} />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={styles.btn} onClick={() => guardar(it.id)}>Guardar</button>
                <button style={styles.btnSoft} onClick={() => resetPin(it.id)}>Reset PIN</button>
              </div>
            </div>
          )
        })}

        {items.length === 0 ? <div style={{ padding: 10, color: "#6b7280" }}>No hay empresas.</div> : null}
      </div>
    </AdminShell>
  )
}
