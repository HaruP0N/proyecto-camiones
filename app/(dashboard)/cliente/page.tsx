"use client"

import "@/styles/petran-login.css"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function ClienteHomePage() {
  const router = useRouter()

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
            <div className="client-welcome">
              <h2>Certifica tu camión</h2>
              <p>Registra tu unidad y obtiene certificación profesional</p>

              <button className="btn-primary" onClick={() => router.push("/cliente/nuevo")}>
                REGISTRAR MI CAMIÓN
              </button>

              <div className="divider">
                <span>o</span>
              </div>

              <button className="btn-outline" onClick={() => router.push("/cliente/ingresar")}>
                Ya tengo cuenta
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
