import { TruckPhotosForm } from "@/components/truck-photos-form"

export default function FotosPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Fotos de los Camiones</h1>
          <p className="text-slate-600">Sube 1 foto por camión. Idealmente una vista 3/4 donde se vea completo.</p>
        </div>

        <TruckPhotosForm />
      </div>
    </main>
  )
}
