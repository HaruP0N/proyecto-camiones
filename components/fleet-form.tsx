"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

type Carroceria =
  | "camion_con_carro"
  | "carro_reefer"
  | "camara_de_frio"
  | "camion_paquetero"

type TruckRow = {
  patente: string
  carroceria: Carroceria
  marca: string
  modelo: string
  anio: string // lo guardamos string para input; convertimos a number al enviar
}

const CARROCERIAS: { value: Carroceria; label: string }[] = [
  { value: "camion_con_carro", label: "Camión con carro" },
  { value: "carro_reefer", label: "Carro reefer" },
  { value: "camara_de_frio", label: "Cámara de frío" },
  { value: "camion_paquetero", label: "Camión paquetero" },
]

function normalizePatente(x: string) {
  return x.replace(/\s+/g, "").toUpperCase()
}

export function FleetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const empresaId = searchParams.get("empresaId")

  const [defaultCarroceria, setDefaultCarroceria] = useState<Carroceria>("camion_con_carro")
  const [paste, setPaste] = useState("")
  const [rows, setRows] = useState<TruckRow[]>([])
  const [saving, setSaving] = useState(false)

  const duplicatesInForm = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      const p = normalizePatente(r.patente)
      if (!p) continue
      counts.set(p, (counts.get(p) ?? 0) + 1)
    }
    return new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([p]) => p))
  }, [rows])

  const handleGenerateRows = () => {
    const patentes = paste
      .split(/\r?\n/)
      .map((x) => normalizePatente(x))
      .filter(Boolean)

    if (patentes.length === 0) {
      toast({ title: "Sin patentes", description: "Pega al menos 1 patente (una por línea).", variant: "destructive" })
      return
    }

    // crea nuevas filas, evitando duplicados exactos con lo ya existente
    const existing = new Set(rows.map((r) => normalizePatente(r.patente)))
    const toAdd = patentes.filter((p) => !existing.has(p))

    if (toAdd.length === 0) {
      toast({ title: "Nada nuevo", description: "Esas patentes ya están en la lista.", variant: "destructive" })
      return
    }

    setRows((prev) => [
      ...prev,
      ...toAdd.map((p) => ({
        patente: p,
        carroceria: defaultCarroceria,
        marca: "",
        modelo: "",
        anio: "",
      })),
    ])

    toast({ title: "Listo", description: `Se agregaron ${toAdd.length} camiones.` })
  }

  const updateRow = (idx: number, patch: Partial<TruckRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const validate = () => {
    if (!empresaId) return "Falta empresaId en la URL."

    if (rows.length === 0) return "Debes agregar al menos 1 camión."

    // patentes vacías o duplicadas
    for (const r of rows) {
      if (!normalizePatente(r.patente)) return "Hay una fila con patente vacía."
    }
    if (duplicatesInForm.size > 0) return `Hay patentes repetidas en el formulario: ${Array.from(duplicatesInForm).join(", ")}`

    // año opcional, pero si viene debe ser válido
    for (const r of rows) {
      if (r.anio.trim()) {
        const n = Number(r.anio)
        if (!Number.isInteger(n) || n < 1900 || n > 2100) return `Año inválido en patente ${r.patente}.`
      }
    }

    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) {
      toast({ title: "Revisa el formulario", description: err, variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        empresaId: Number(empresaId),
        camiones: rows.map((r) => ({
          patente: normalizePatente(r.patente),
          carroceria: r.carroceria,
          marca: r.marca.trim() || null,
          modelo: r.modelo.trim() || null,
          anio: r.anio.trim() ? Number(r.anio) : null,
          tipo: "camion",
        })),
      }

      const res = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Error al registrar flota")

      const inserted = data?.insertedCount ?? 0
      const dups = (data?.duplicates ?? []) as string[]

      toast({
        title: "Flota registrada",
        description: dups.length
          ? `Insertados: ${inserted}. Duplicados omitidos: ${dups.join(", ")}`
          : `Insertados: ${inserted}.`,
      })

      router.push(`/cliente/fotos?empresaId=${empresaId}`)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo registrar la flota",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Registro de Flota</CardTitle>
        <CardDescription>
          Pega patentes (una por línea) y completa marca/modelo/año por camión. Cada fila = 1 camión.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {!empresaId ? (
          <div className="text-sm text-red-600">Falta empresaId en la URL. Vuelve a /cliente.</div>
        ) : null}

        {/* Defaults + paste */}
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Carrocería por defecto</label>
              <select
                className="w-full h-10 rounded-md border px-3 text-sm"
                value={defaultCarroceria}
                onChange={(e) => setDefaultCarroceria(e.target.value as Carroceria)}
              >
                {CARROCERIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Se aplica a nuevas filas, pero puedes cambiar por camión.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Pegar patentes</label>
              <textarea
                className="w-full min-h-[96px] rounded-md border p-3 text-sm"
                placeholder={"ABCD12\nWXYZ34\n..."}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={handleGenerateRows}>
                Generar filas desde patentes
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Camiones ({rows.length})</p>
            {duplicatesInForm.size > 0 ? (
              <p className="text-xs text-red-600">Hay patentes repetidas en el formulario.</p>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aún no agregas camiones. Pega patentes y genera filas.</div>
          ) : (
            <div className="overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2">Patente</th>
                    <th className="text-left p-2">Carrocería</th>
                    <th className="text-left p-2">Marca</th>
                    <th className="text-left p-2">Modelo</th>
                    <th className="text-left p-2">Año</th>
                    <th className="text-left p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const p = normalizePatente(r.patente)
                    const isDup = p && duplicatesInForm.has(p)

                    return (
                      <tr key={`${p}-${idx}`} className={isDup ? "bg-red-50" : ""}>
                        <td className="p-2 min-w-[140px]">
                          <Input
                            value={r.patente}
                            onChange={(e) => updateRow(idx, { patente: e.target.value })}
                            className={isDup ? "border-red-400" : ""}
                          />
                        </td>

                        <td className="p-2 min-w-[180px]">
                          <select
                            className="w-full h-10 rounded-md border px-3"
                            value={r.carroceria}
                            onChange={(e) => updateRow(idx, { carroceria: e.target.value as Carroceria })}
                          >
                            {CARROCERIAS.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2 min-w-[160px]">
                          <Input value={r.marca} onChange={(e) => updateRow(idx, { marca: e.target.value })} />
                        </td>

                        <td className="p-2 min-w-[160px]">
                          <Input value={r.modelo} onChange={(e) => updateRow(idx, { modelo: e.target.value })} />
                        </td>

                        <td className="p-2 min-w-[110px]">
                          <Input
                            value={r.anio}
                            onChange={(e) => updateRow(idx, { anio: e.target.value })}
                            inputMode="numeric"
                            placeholder="2020"
                          />
                        </td>

                        <td className="p-2">
                          <Button type="button" variant="outline" onClick={() => removeRow(idx)}>
                            Quitar
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Button className="w-full" onClick={handleSave} disabled={saving || rows.length === 0}>
          {saving ? "Guardando..." : "Guardar flota y continuar a fotos"}
        </Button>

        <p className="text-xs text-muted-foreground">
          Regla: solo camiones (no acoples). Puedes dejar marca/modelo/año en blanco por ahora, pero es mejor completarlo.
        </p>
      </CardContent>
    </Card>
  )
}
