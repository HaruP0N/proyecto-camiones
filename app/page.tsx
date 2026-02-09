"use client";

import "@/styles/petran-login.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();

  const [showStaffLogin, setShowStaffLogin] = useState(false);

  // Staff login states
  const [email, setEmail] = useState("admin@petran.cl");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const emailTrim = email.trim();
    if (!emailTrim || !password) {
      alert("Completa email y contraseña.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrim, password }),
      });

      const data = await res.json();
      console.log("LOGIN RESPONSE:", data);

      if (!res.ok || !data.ok) {
        alert(data?.error ?? "No se pudo iniciar sesión");
        return;
      }

      localStorage.setItem("petran_session", "active");
      if (data?.user) {
        localStorage.setItem("petran_user", JSON.stringify(data.user));
      }

      const rol = data?.user?.rol;

      if (rol === "admin") {
        // Forzar navegación (evita edge cases con router en dev)
        window.location.href = "/admin";
        return;
      }

      if (rol === "inspector") {
        // Redirigir a panel del inspector
        window.location.href = "/inspector";
        return;
      }

      alert("Login OK, pero rol inesperado: " + String(rol));
    } catch (err: any) {
      alert(err?.message ?? "Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="petran-login">
      <main className="main-container">
        <section className="brand-side">
          <div className="brand-content">
            <Image
              src="/logo-petran.jpeg"
              alt="Petran Logo"
              width={300}
              height={100}
              priority
              className="main-logo"
            />
            <h1 className="tagline">
              Segunda vida, <br />
              <span>máximo rendimiento.</span>
            </h1>
            <p className="description">
              Conectamos camiones seleccionados con las empresas líderes del país. Ahorro inteligente.
            </p>
          </div>
        </section>

        <section className="action-side">
          <div className="form-container">
            {!showStaffLogin ? (
              <div className="client-welcome">
                <h2>¿Quieres contactarnos?</h2>
                <p>Registrate ahora y coordina tu hora de inspección con nosotros.</p>

                <button className="btn-primary" onClick={() => router.push("/cliente/nuevo")}>
                  REGISTRAR MI CAMIÓN
                </button>

                <div className="divider">
                  <span>O accede como equipo</span>
                </div>

                <button className="btn-outline" onClick={() => setShowStaffLogin(true)}>
                  Ingreso Personal Interno
                </button>
              </div>
            ) : (
              <div className="staff-login">
                <button
                  className="back-link"
                  type="button"
                  onClick={() => {
                    setShowStaffLogin(false);
                    setEmail("");
                    setPassword("");
                  }}
                >
                  ← Volver al registro
                </button>

                <h2>Acceso Personal</h2>

                <form className="login-form" onSubmit={handleStaffLogin}>
                  <div className="input-group">
                    <label>Email Corporativo</label>
                    <input
                      type="email"
                      placeholder="usuario@petran.cl"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>

                  <div className="input-group">
                    <label>Contraseña</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>

                  <button type="submit" className="btn-dark" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar al Panel"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
