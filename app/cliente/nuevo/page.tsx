import { EmpresaForm } from "@/components/empresa-form"

export default function ClienteNuevoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Cliente Nuevo</h1>
          <p className="text-slate-600">Registra tu empresa y crea un PIN simple de 4 dígitos.</p>
        </div>
        <EmpresaForm />
      </div>
    </main>
  )
}
