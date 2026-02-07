"use client";

import React, { useEffect, useState } from "react";
import AdminShell from "../_components/AdminShell";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

type Inspector = {
  id: number;
  nombre: string | null;
  email: string | null;
  activo?: number | boolean | null;
};

const styles: Record<string, React.CSSProperties> = {
  card: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "white" },
  row: {
    display: "grid",
    gridTemplateColumns: "90px 1fr 260px 120px 360px",
    gap: 10,
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #eee",
  },
  input: { width: "100%", padding: "10px 10px", borderRadius: 10, border: "1px solid #e5e7eb", outline: "none" },
  btn: { padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 800, cursor: "pointer", background: "#111827", color: "white" },
  btnSoft: { padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 800, cursor: "pointer", background: "white" },
  err: { border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", borderRadius: 14, padding: 10, marginBottom: 12, fontWeight: 800 },
  ok: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 14, padding: 10, marginBottom: 12, fontWeight: 800 },
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

  return (
    <AdminShell title="Inspectores" subtitle="Crear, editar, activar/desactivar y reset de contraseña.">
      {err ? <div style={styles.err}>{err}</div> : null}
      {ok ? <div style={styles.ok}>{ok}</div> : null}

      <div style={{ ...styles.card, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Crear inspector</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 200px", gap: 10 }}>
          <input style={styles.input} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input style={styles.input} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={styles.input} placeholder="Contraseña inicial" value={passwordInicial} onChange={(e) => setPasswordInicial(e.target.value)} />
          <button style={styles.btn} onClick={crearInspector} disabled={loading}>Crear</button>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 900 }}>Lista de inspectores</div>
          <button style={styles.btnSoft} onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>

        <div style={{ ...styles.row, fontWeight: 900, color: "#6b7280" }}>
          <div>ID</div>
          <div>Nombre</div>
          <div>Email</div>
          <div>Activo</div>
          <div>Acciones</div>
        </div>

        {items.map((it) => {
          const local = edit[it.id] || {};
          const nombreV = (local.nombre ?? it.nombre ?? "") as string;
          const emailV = (local.email ?? it.email ?? "") as string;
          const activoV = local.activo ?? it.activo ?? 1;

          return (
            <div key={it.id} style={styles.row}>
              <div style={{ fontWeight: 900 }}>{it.id}</div>

              <input
                style={styles.input}
                value={nombreV}
                onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], nombre: e.target.value } }))}
              />

              <input
                style={styles.input}
                value={emailV}
                onChange={(e) => setEdit((p) => ({ ...p, [it.id]: { ...p[it.id], email: e.target.value } }))}
              />

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
                <input
                  type="checkbox"
                  checked={activoV === 1 || activoV === true}
                  onChange={() => toggleActivo(it.id, activoV)}
                />
                Activo
              </label>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={styles.btn} onClick={() => guardar(it.id)}>Guardar</button>
                <button style={styles.btnSoft} onClick={() => resetPassword(it.id)}>Reset password</button>
              </div>
            </div>
          );
        })}

        {items.length === 0 ? <div style={{ padding: 10, color: "#6b7280" }}>No hay inspectores.</div> : null}
      </div>

      <Button variant="outline" asChild>
        <Link href="/admin">
          <ArrowLeft className="mr-2" /> Volver
        </Link>
      </Button>
    </AdminShell>
  );
}
