"use client"

import "@/styles/petran-login.css"
import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"

interface FormData {
  nombre: string
  apellido: string
  rut: string
  rubro: string
  productos_transportados: string
  telefono_contacto: string
  email_contacto: string
  direccion: string
  prioridad_frio: boolean
  prioridad_carroceria: boolean
  prioridad_estructura: boolean
  prioridad_camion: boolean
  prioridad_acople: boolean
  pin: string
  confirmPin: string
}

type Step = "datos" | "contacto" | "seguridad" | "prioridades"

const STEPS: { key: Step; label: string }[] = [
  { key: "datos", label: "Datos" },
  { key: "contacto", label: "Contacto" },
  { key: "seguridad", label: "Seguridad" },
  { key: "prioridades", label: "Prioridades" },
]

function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin.trim())
}

export default function ClienteNuevoPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState<Step>("datos")

  const [formData, setFormData] = useState<FormData>({
    nombre: "",
    apellido: "",
    rut: "",
    rubro: "",
    productos_transportados: "",
    telefono_contacto: "",
    email_contacto: "",
    direccion: "",
    prioridad_frio: false,
    prioridad_carroceria: false,
    prioridad_estructura: false,
    prioridad_camion: false,
    prioridad_acople: false,
    pin: "",
    confirmPin: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (name: keyof FormData) => {
    setFormData((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep)

  const goNext = () => {
    const idx = currentStepIndex
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1].key)
    }
  }

  const goPrev = () => {
    const idx = currentStepIndex
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1].key)
    }
  }

  const validateCurrentStep = (): string | null => {
    switch (currentStep) {
      case "datos":
        if (!formData.nombre.trim()) return "El nombre es requerido"
        if (!formData.rut.trim()) return "El RUT es requerido"
        return null
      case "contacto":
        return null
      case "seguridad":
        if (!isValidPin(formData.pin)) return "El PIN debe ser de 4 dígitos"
        if (formData.pin !== formData.confirmPin) return "Los PIN no coinciden"
        return null
      case "prioridades":
        return null
      default:
        return null
    }
  }

  const handleContinue = () => {
    const error = validateCurrentStep()
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      return
    }
    if (currentStep === "prioridades") {
      handleSubmit()
    } else {
      goNext()
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const rut = formData.rut.trim()
      const pin = formData.pin.trim()

      const response = await fetch("/api/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: `${formData.nombre} ${formData.apellido}`.trim(),
          rut,
          rubro: formData.rubro,
          productos_transportados: formData.productos_transportados,
          telefono_contacto: formData.telefono_contacto,
          email_contacto: formData.email_contacto,
          direccion: formData.direccion,
          prioridad_frio: formData.prioridad_frio,
          prioridad_carroceria: formData.prioridad_carroceria,
          prioridad_estructura: formData.prioridad_estructura,
          prioridad_camion: formData.prioridad_camion,
          prioridad_acople: formData.prioridad_acople,
          pin,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        const msg = String(result?.error || "Error al registrar empresa")

        if (
          msg.toLowerCase().includes("rut ya") ||
          msg.toLowerCase().includes("duplicate") ||
          msg.toLowerCase().includes("unique")
        ) {
          toast({
            title: "RUT ya registrado",
            description: "Este RUT ya tiene una cuenta. Ingresa con tu RUT y PIN.",
            variant: "destructive",
          })
          router.push("/cliente/ingresar")
          return
        }

        throw new Error(msg)
      }

      toast({
        title: "Cuenta creada",
        description: "Tu cuenta ha sido creada exitosamente.",
      })

      const loginRes = await fetch("/api/cliente/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut, pin }),
        credentials: "include",
      })

      const loginData = await loginRes.json().catch(() => null)

      if (!loginRes.ok) {
        toast({
          title: "Registrado, pero falta ingresar",
          description: loginData?.error || "No se pudo validar el acceso. Ingresa con tu RUT y PIN.",
          variant: "destructive",
        })
        router.push("/cliente/ingresar")
        return
      }

      router.push("/cliente/flota")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al registrar empresa",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
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
                onClick={() => router.push("/cliente")}
              >
                ← Volver al registro
              </button>

              <h2>Crear cuenta</h2>
              <p style={{ marginBottom: "1rem", color: "#666" }}>
                Ingresa tus datos personales para comenzar
              </p>

              {/* Progress Steps */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2rem", position: "relative" }}>
                <div style={{ position: "absolute", top: "8px", left: "10%", right: "10%", height: "2px", background: "#e5e5e5", zIndex: 0 }} />
                <div
                  style={{
                    position: "absolute",
                    top: "8px",
                    left: "10%",
                    height: "2px",
                    background: "var(--primary)",
                    zIndex: 0,
                    width: `${(currentStepIndex / (STEPS.length - 1)) * 80}%`,
                    transition: "width 0.3s"
                  }}
                />
                {STEPS.map((step, idx) => {
                  const isActive = idx === currentStepIndex
                  const isCompleted = idx < currentStepIndex

                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => idx <= currentStepIndex && setCurrentStep(step.key)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        background: "none",
                        border: "none",
                        cursor: idx <= currentStepIndex ? "pointer" : "not-allowed",
                        zIndex: 1,
                      }}
                    >
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          border: "2px solid",
                          borderColor: isActive || isCompleted ? "var(--primary)" : "#ccc",
                          background: isActive || isCompleted ? "var(--primary)" : "white",
                        }}
                      />
                      <span
                        style={{
                          marginTop: "8px",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          color: isActive ? "var(--primary)" : isCompleted ? "#333" : "#999",
                        }}
                      >
                        {step.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Form Content */}
              <form className="login-form" onSubmit={(e) => { e.preventDefault(); handleContinue(); }}>
                {currentStep === "datos" && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div className="input-group">
                        <label>Nombre</label>
                        <input
                          type="text"
                          name="nombre"
                          value={formData.nombre}
                          onChange={handleInputChange}
                          placeholder="Juan"
                        />
                      </div>
                      <div className="input-group">
                        <label>Apellido</label>
                        <input
                          type="text"
                          name="apellido"
                          value={formData.apellido}
                          onChange={handleInputChange}
                          placeholder="Pérez"
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>RUT</label>
                      <input
                        type="text"
                        name="rut"
                        value={formData.rut}
                        onChange={handleInputChange}
                        placeholder="Ej: 12.345.678-9"
                      />
                    </div>
                  </>
                )}

                {currentStep === "contacto" && (
                  <>
                    <div className="input-group">
                      <label>Teléfono</label>
                      <input
                        type="tel"
                        name="telefono_contacto"
                        value={formData.telefono_contacto}
                        onChange={handleInputChange}
                        placeholder="+56 9 1234 5678"
                      />
                    </div>
                    <div className="input-group">
                      <label>Email</label>
                      <input
                        type="email"
                        name="email_contacto"
                        value={formData.email_contacto}
                        onChange={handleInputChange}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="input-group">
                      <label>Dirección</label>
                      <input
                        type="text"
                        name="direccion"
                        value={formData.direccion}
                        onChange={handleInputChange}
                        placeholder="Calle 123, Ciudad"
                      />
                    </div>
                    <div className="input-group">
                      <label>Rubro</label>
                      <input
                        type="text"
                        name="rubro"
                        value={formData.rubro}
                        onChange={handleInputChange}
                        placeholder="Transporte de alimentos"
                      />
                    </div>
                  </>
                )}

                {currentStep === "seguridad" && (
                  <>
                    <div className="input-group">
                      <label>PIN (4 dígitos)</label>
                      <input
                        type="text"
                        name="pin"
                        value={formData.pin}
                        onChange={handleInputChange}
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="1234"
                      />
                      <small style={{ color: "#666", marginTop: "0.25rem" }}>
                        Este PIN lo usarás para volver a ingresar sin complicaciones.
                      </small>
                    </div>
                    <div className="input-group">
                      <label>Confirmar PIN</label>
                      <input
                        type="text"
                        name="confirmPin"
                        value={formData.confirmPin}
                        onChange={handleInputChange}
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="1234"
                      />
                    </div>
                  </>
                )}

                {currentStep === "prioridades" && (
                  <>
                    <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
                      Selecciona las prioridades de inspección para tu flota
                    </p>
                    {[
                      { key: "prioridad_frio", label: "Sistema de Frío" },
                      { key: "prioridad_carroceria", label: "Carrocería" },
                      { key: "prioridad_estructura", label: "Estructura" },
                      { key: "prioridad_camion", label: "Camión" },
                      { key: "prioridad_acople", label: "Acople" },
                    ].map((item) => (
                      <label
                        key={item.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          border: "1px solid #ddd",
                          borderRadius: "8px",
                          marginBottom: "0.5rem",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData[item.key as keyof FormData] as boolean}
                          onChange={() => handleCheckboxChange(item.key as keyof FormData)}
                          style={{ width: "18px", height: "18px", accentColor: "var(--primary)" }}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </>
                )}

                <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ marginTop: "1.5rem" }}>
                  {isSubmitting
                    ? "Registrando..."
                    : currentStep === "prioridades"
                    ? "Crear cuenta"
                    : "Continuar"}
                </button>

                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={goPrev}
                    className="btn-outline"
                    style={{ marginTop: "0.75rem" }}
                  >
                    Volver
                  </button>
                )}
              </form>

              <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.9rem", color: "#666" }}>
                ¿Ya tienes una cuenta?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/cliente/ingresar")}
                  style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}
                >
                  Inicia sesión
                </button>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
