"use client"

import "@/styles/petran-login.css"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"

export default function ClienteIngresarPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [rut, setRut] = useState("")
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/cliente/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut: rut.trim(), pin: pin.trim() }),
        credentials: "include",
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "No se pudo ingresar")

      toast({ title: "Listo", description: "Acceso validado. Redirigiendo..." })
      router.push("/cliente/flota")
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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
            <div className="staff-login">
              <button
                className="back-link"
                type="button"
                onClick={() => router.push("/")}
              >
                ← Volver al inicio
              </button>

              <h2>Ya estoy registrado</h2>
              <p style={{ marginBottom: "1.5rem", color: "#666" }}>
                Ingresa tu RUT y tu PIN (4 dígitos).
              </p>

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="input-group">
                  <label>RUT</label>
                  <input
                    type="text"
                    placeholder="Ej: 12.345.678-9"
                    required
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label>PIN (4 dígitos)</label>
                  <input
                    type="text"
                    placeholder="Ej: 1234"
                    required
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Validando..." : "Continuar"}
                </button>
              </form>

              <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.9rem", color: "#666" }}>
                ¿No tienes una cuenta?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/cliente/nuevo")}
                  style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}
                >
                  Regístrate aquí
                </button>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
