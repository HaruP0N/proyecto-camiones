import { EmpresaForm } from "@/components/empresa-form"

export default function ClientePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Registro de Empresas</h1>
          <p className="text-slate-600">Complete el formulario para registrar una nueva empresa cliente</p>
        </div>

        <EmpresaForm />
      </div>
    </main>
  )
}
