"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export function ClienteIngresarForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [rut, setRut] = useState("")
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/cliente-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut: rut.trim(), pin: pin.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "No se pudo ingresar")

      toast({ title: "Listo", description: "Acceso validado. Redirigiendo..." })
      router.push(`/cliente/flota?empresaId=${data.empresaId}`)
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
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Ingresar</CardTitle>
        <CardDescription>Este PIN lo creaste cuando registraste la empresa.</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rut">RUT</Label>
            <Input id="rut" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="Ej: 12.345.678-9" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin">PIN (4 dígitos)</Label>
            <Input
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Ej: 1234"
              inputMode="numeric"
              maxLength={4}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Validando..." : "Continuar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
