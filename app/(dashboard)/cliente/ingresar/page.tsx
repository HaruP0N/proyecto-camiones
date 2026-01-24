import { Suspense } from "react"
import { ClienteIngresarForm } from "@/components/cliente-ingresar-form"

export default function ClienteIngresarPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Ya estoy registrado</h1>
          <p className="text-slate-600">Ingresa tu RUT y tu PIN (4 dígitos).</p>
        </div>

        <Suspense fallback={<div className="p-4">Cargando...</div>}>
          <ClienteIngresarForm />
        </Suspense>
      </div>
    </main>
  )
}
