"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BODY_TYPES, type BodyType } from "@/lib/body-types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

function normalizePlate(p: string) {
  return p.trim().toUpperCase().replace(/\s+/g, "")
}
function parsePlates(text: string) {
  return text
    .split(/\r?\n|,|;/g)
    .map(normalizePlate)
    .filter(Boolean)
}

type FleetLot = {
  carroceria: BodyType | ""
  cantidad: number
  patentesText: string
}

export function FleetForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const { toast } = useToast()

  const empresaId = sp.get("empresaId")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lot, setLot] = useState<FleetLot>({
    carroceria: "",
    cantidad: 1,
    patentesText: "",
  })

  const plates = useMemo(() => parsePlates(lot.patentesText), [lot.patentesText])
  const countOk = plates.length === Number(lot.cantidad)

  const onSubmit = async () => {
    if (!empresaId) {
      toast({ title: "Error", description: "Falta empresaId en la URL", variant: "destructive" })
      return
    }
    if (!lot.carroceria) {
      toast({ title: "Falta carrocería", description: "Selecciona el tipo de carrocería", variant: "destructive" })
      return
    }
    if (Number(lot.cantidad) <= 0) {
      toast({ title: "Cantidad inválida", description: "Cantidad debe ser mayor a 0", variant: "destructive" })
      return
    }
    if (plates.length === 0) {
      toast({ title: "Faltan patentes", description: "Pega al menos 1 patente (una por línea)", variant: "destructive" })
      return
    }
    if (!countOk) {
      toast({
        title: "Cantidad no coincide",
        description: `Indicada: ${lot.cantidad} / Patentes pegadas: ${plates.length}`,
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId: Number(empresaId),
          lot: {
            carroceria: lot.carroceria,
            cantidad: Number(lot.cantidad),
            patentes: plates,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Error al registrar flota")

      toast({ title: "Flota registrada", description: `Se registraron ${data.insertedCount} camiones.` })

      router.push(`/cliente/fotos?empresaId=${empresaId}`)
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Error", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Flota de Camiones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Carrocería *</Label>
          <select
            className="w-full border rounded-md px-3 py-2"
            value={lot.carroceria}
            onChange={(e) => setLot((p) => ({ ...p, carroceria: e.target.value as BodyType | "" }))}
          >
            <option value="">Selecciona...</option>
            {BODY_TYPES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Cantidad *</Label>
          <Input
            type="number"
            min={1}
            value={lot.cantidad}
            onChange={(e) => setLot((p) => ({ ...p, cantidad: Number(e.target.value) }))}
          />
          <p className="text-sm text-muted-foreground">
            Patentes pegadas: <b>{plates.length}</b> / Cantidad: <b>{lot.cantidad}</b>{" "}
            {countOk ? "✅" : "⚠️"}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Patentes (1 por línea) *</Label>
          <Textarea
            rows={6}
            value={lot.patentesText}
            onChange={(e) => setLot((p) => ({ ...p, patentesText: e.target.value }))}
            placeholder={"ABCD12\nEFGH34\nIJKL56"}
          />
        </div>

        <Button className="w-full" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar flota y continuar"}
        </Button>
      </CardContent>
    </Card>
  )
}
