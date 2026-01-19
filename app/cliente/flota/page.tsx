import { Suspense } from "react"
import { FleetForm } from "@/components/fleet-form"

export default function FlotaPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Registro de Flota</h1>
          <p className="text-slate-600">Indica carrocería, cantidad y pega las patentes (una por línea).</p>
        </div>

        <Suspense fallback={<div className="p-4">Cargando...</div>}>
          <FleetForm />
        </Suspense>
      </div>
    </main>
  )
}
