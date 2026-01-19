"use client"

import { useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { BODY_TYPES } from "@/lib/body-types"
import type { BodyType } from "@/lib/body-types"

type FleetLot = {
  id: string
  tipo: string
  marca: string
  modelo: string
  anio: number
  carroceria: BodyType | ""
  cantidad: number
  patentesText: string
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function normalizePlate(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "")
}

function isValidPlate(plate: string) {
  return /^[A-Z]{4}\d{2}$/.test(plate)
}

function parsePlates(text: string) {
  return text
    .split(/\r?\n|,|;/g)
    .map((x) => normalizePlate(x))
    .filter((x) => x.length > 0)
}

function analyzeLot(lot: FleetLot) {
  const plates = parsePlates(lot.patentesText)

  const invalid = plates.filter((p) => !isValidPlate(p))

  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const p of plates) {
    if (seen.has(p)) dup.add(p)
    seen.add(p)
  }

  const uniqueValid = plates.filter((p) => isValidPlate(p))
  const uniqueValidSet = Array.from(new Set(uniqueValid))

  const missingCount = Math.max(0, (lot.cantidad || 0) - uniqueValidSet.length)
  const extraCount = Math.max(0, uniqueValidSet.length - (lot.cantidad || 0))

  return {
    uniqueValid: uniqueValidSet,
    invalid,
    duplicates: Array.from(dup),
    missingCount,
    extraCount,
  }
}

export function FleetForm() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const empresaId = searchParams.get("empresaId")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lots, setLots] = useState<FleetLot[]>([
    {
      id: uid(),
      tipo: "",
      marca: "",
      modelo: "",
      anio: new Date().getFullYear(),
      carroceria: "",
      cantidad: 1,
      patentesText: "",
    },
  ])

  const globalDuplicates = useMemo(() => {
    const all = lots.flatMap((l) => analyzeLot(l).uniqueValid)
    const seen = new Set<string>()
    const dup = new Set<string>()
    for (const p of all) {
      if (seen.has(p)) dup.add(p)
      seen.add(p)
    }
    return Array.from(dup)
  }, [lots])

  const lotsAnalysis = useMemo(() => lots.map((l) => analyzeLot(l)), [lots])

  const hasErrors = useMemo(() => {
    if (!empresaId) return true
    if (globalDuplicates.length > 0) return true

    for (let i = 0; i < lots.length; i++) {
      const lot = lots[i]
      const a = lotsAnalysis[i]

      if (!lot.tipo.trim()) return true
      if (!lot.marca.trim()) return true
      if (!lot.modelo.trim()) return true
      if (!lot.anio || lot.anio < 1980 || lot.anio > new Date().getFullYear() + 1) return true
      if (!lot.carroceria) return true
      if (!lot.cantidad || lot.cantidad < 1) return true

      if (a.invalid.length > 0) return true
      if (a.missingCount > 0) return true
    }
    return false
  }, [empresaId, lots, lotsAnalysis, globalDuplicates])

  const addLot = () => {
    setLots((prev) => [
      ...prev,
      {
        id: uid(),
        tipo: "",
        marca: "",
        modelo: "",
        anio: new Date().getFullYear(),
        carroceria: "",
        cantidad: 1,
        patentesText: "",
      },
    ])
  }

  const removeLot = (id: string) => {
    setLots((prev) => prev.filter((l) => l.id !== id))
  }

  const updateLot = (id: string, patch: Partial<FleetLot>) => {
    setLots((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const handleSubmit = async () => {
    if (!empresaId) {
      toast({
        title: "Falta empresaId",
        description: "Vuelve al paso anterior y registra la empresa primero.",
        variant: "destructive",
      })
      return
    }

    if (hasErrors) {
      toast({
        title: "Revisa la flota",
        description: "Hay errores: faltan datos, patentes inválidas/duplicadas o faltan patentes para completar la cantidad.",
        variant: "destructive",
      })
      return
    }

    const payload = {
      empresaId,
      lots: lots.map((l) => ({
        tipo: l.tipo.trim(),
        marca: l.marca.trim(),
        modelo: l.modelo.trim(),
        anio: l.anio,
        carroceria: l.carroceria,
        cantidad: l.cantidad,
        patentes: analyzeLot(l).uniqueValid,
      })),
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar la flota")

      toast({ title: "Flota guardada", description: "Ahora sube 1 foto por camión." })
      router.push(`/cliente/fotos?empresaId=${empresaId}`)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error al guardar flota",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Flota de Camiones</CardTitle>
        <CardDescription>
          Agrega lotes por tipo. Pega las patentes (una por línea). Formato esperado: ABCD12.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {!empresaId && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <div className="font-semibold text-destructive">Falta empresaId</div>
            <div className="text-muted-foreground mt-1">
              Debes llegar aquí desde el registro de empresa (paso 1). Ej: /cliente/flota?empresaId=123
            </div>
          </div>
        )}

        {globalDuplicates.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <div className="font-semibold text-destructive">Patentes duplicadas entre lotes</div>
            <div className="text-muted-foreground mt-1">
              Corrige estas patentes repetidas: <span className="font-medium">{globalDuplicates.join(", ")}</span>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {lots.map((lot, idx) => {
            const a = lotsAnalysis[idx]
            const validCount = a.uniqueValid.length
            const target = lot.cantidad || 0

            return (
              <div key={lot.id} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <div className="space-y-2">
                      <Label>Tipo / Categoría *</Label>
                      <Input
                        value={lot.tipo}
                        onChange={(e) => updateLot(lot.id, { tipo: e.target.value })}
                        placeholder='Ej: "Tipo X" / "Tipo Y"'
                      />
                      {!lot.tipo.trim() && <p className="text-xs text-destructive">Obligatorio.</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Carrocería *</Label>
                      <select
                        className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                        value={lot.carroceria}
                        onChange={(e) => updateLot(lot.id, { carroceria: e.target.value as BodyType })}
                      >
                        <option value="">Selecciona una</option>
                        {BODY_TYPES.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                      {!lot.carroceria && <p className="text-xs text-destructive">Obligatorio.</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Marca *</Label>
                      <Input
                        value={lot.marca}
                        onChange={(e) => updateLot(lot.id, { marca: e.target.value })}
                        placeholder="Ej: Volvo"
                      />
                      {!lot.marca.trim() && <p className="text-xs text-destructive">Obligatorio.</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Modelo *</Label>
                      <Input
                        value={lot.modelo}
                        onChange={(e) => updateLot(lot.id, { modelo: e.target.value })}
                        placeholder="Ej: FH 460"
                      />
                      {!lot.modelo.trim() && <p className="text-xs text-destructive">Obligatorio.</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Año *</Label>
                      <Input
                        type="number"
                        min={1980}
                        max={new Date().getFullYear() + 1}
                        value={lot.anio}
                        onChange={(e) => updateLot(lot.id, { anio: Number(e.target.value) })}
                      />
                      {(!lot.anio || lot.anio < 1980) && <p className="text-xs text-destructive">Año inválido.</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Cantidad *</Label>
                      <Input
                        type="number"
                        min={1}
                        value={lot.cantidad}
                        onChange={(e) => updateLot(lot.id, { cantidad: Number(e.target.value) })}
                      />
                      {(!lot.cantidad || lot.cantidad < 1) && <p className="text-xs text-destructive">Debe ser 1 o más.</p>}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Estado</Label>
                      <div className="rounded-md border px-3 py-2 text-sm">
                        <span className={validCount === target && a.invalid.length === 0 ? "font-semibold" : ""}>
                          {validCount}/{target}
                        </span>{" "}
                        patentes válidas
                        {a.missingCount > 0 && <span className="text-destructive"> · faltan {a.missingCount}</span>}
                        {a.extraCount > 0 && <span className="text-destructive"> · sobran {a.extraCount}</span>}
                      </div>
                    </div>
                  </div>

                  <Button type="button" variant="outline" onClick={() => removeLot(lot.id)} disabled={lots.length === 1}>
                    Quitar
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Patentes (una por línea) *</Label>
                  <Textarea
                    value={lot.patentesText}
                    onChange={(e) => updateLot(lot.id, { patentesText: e.target.value })}
                    placeholder={"ABCD12\nBCDE23\nCDEF34"}
                    rows={6}
                  />

                  {a.duplicates.length > 0 && (
                    <p className="text-xs text-destructive">Duplicadas dentro del lote: {a.duplicates.join(", ")}</p>
                  )}
                  {a.invalid.length > 0 && (
                    <p className="text-xs text-destructive">Formato inválido: {a.invalid.join(", ")}</p>
                  )}
                  {a.missingCount > 0 && (
                    <p className="text-xs text-destructive">
                      Faltan {a.missingCount} patentes válidas para completar la cantidad.
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <Button type="button" variant="outline" onClick={addLot}>
            + Agregar lote
          </Button>

          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || hasErrors}>
            {isSubmitting ? "Guardando..." : "Guardar flota y subir fotos"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
