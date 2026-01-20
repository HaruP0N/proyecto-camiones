import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ClienteHomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Registro de Camiones</h1>
          <p className="text-slate-600">Elige una opción para continuar</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>¿Qué necesitas hacer?</CardTitle>
            <CardDescription>Si ya estás registrado, entra con tu RUT y PIN (4 dígitos).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild className="w-full h-12 text-base">
              <Link href="/cliente/nuevo">✅ Soy cliente nuevo</Link>
            </Button>

            <Button asChild variant="outline" className="w-full h-12 text-base">
              <Link href="/cliente/ingresar">🔁 Ya estoy registrado</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
