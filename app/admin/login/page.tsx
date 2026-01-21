"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@petran.cl");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data?.error ?? "No se pudo iniciar sesión");
        return;
      }
      router.push("/admin/camiones");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 420,
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
          background: "white",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Admin Petran</h1>
        <p style={{ margin: "6px 0 16px", color: "#666" }}>
          Ingresa con tu correo y contraseña.
        </p>

        <label style={{ display: "grid", gap: 6, fontWeight: 800, marginBottom: 12 }}>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            autoComplete="email"
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontWeight: 800, marginBottom: 12 }}>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            autoComplete="current-password"
          />
        </label>

        <button
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
