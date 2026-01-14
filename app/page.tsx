"use client"

import "@/styles/petran-login.css"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const [showStaffLogin, setShowStaffLogin] = useState(false)

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

                <button className="btn-primary" onClick={() => router.push("/cliente")}>
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
                <button className="back-link" onClick={() => setShowStaffLogin(false)}>
                  ← Volver al registro
                </button>
                <h2>Acceso Personal</h2>

                <form className="login-form">
                  <div className="input-group">
                    <label>Email Corporativo</label>
                    <input type="email" placeholder="usuario@petran.cl" required />
                  </div>

                  <div className="input-group">
                    <label>Contraseña</label>
                    <input type="password" placeholder="••••••••" required />
                  </div>

                  <button type="submit" className="btn-dark">
                    Entrar al Panel
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
