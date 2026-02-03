import { Suspense } from "react"
import { FleetForm } from "@/components/fleet-form"

export default function FlotaPage() {
  return (
    <main className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={<div className="p-4 text-center text-gray-500">Cargando...</div>}>
          <FleetForm />
        </Suspense>
      </div>
    </main>
  )
}
