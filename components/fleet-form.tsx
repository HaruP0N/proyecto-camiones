"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

/* ===== Valores EXACTOS permitidos por la BD ===== */
type Carroceria =
  | "CAMION_CON_CARRO"
  | "CARRO_REEFER"
  | "CAMARA_DE_FRIO"
  | "CAMION_PAQUETERO"

type ExistingTruck = {
  id: number
  patente: string
  marca: string | null
  modelo: string | null
  anio: number | null
  carroceria: string | null
  foto_url?: string | null
}

type NewTruckRow = {
  patente: string
  carroceria: Carroceria
  marca: string
  modelo: string
  anio: string
}

const CARROCERIAS: { value: Carroceria; label: string }[] = [
  { value: "CAMION_CON_CARRO", label: "Camión con carro" },
  { value: "CARRO_REEFER", label: "Carro reefer" },
  { value: "CAMARA_DE_FRIO", label: "Cámara de frío" },
  { value: "CAMION_PAQUETERO", label: "Camión paquetero" },
]

function normalizePatente(p: string) {
  return p.replace(/\s+/g, "").toUpperCase()
}

export function FleetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const empresaId = searchParams.get("empresaId")

  /* ===============================
     BOTONES DE NAVEGACIÓN (OPCIÓN B)
     =============================== */
  const NavigationButtons = () => (
    <div className="flex gap-3 mb-6">
      <Button variant="outline" type="button" onClick={() => router.back()}>
        ← Volver
      </Button>

      <Button variant="outline" type="button" onClick={() => router.push("/cliente")}>
        ⌂ Volver al inicio
      </Button>
    </div>
  )

  /* ===============================
     CAMIONES EXISTENTES
     =============================== */
  const [existing, setExisting] = useState<ExistingTruck[]>([])
  const [loadingExisting, setLoadingExisting] = useState(false)

  const loadExisting = async () => {
    if (!empresaId) return
    try {
      setLoadingExisting(true)
      const res = await fetch(`/api/fleet?empresaId=${empresaId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Error al cargar camiones")
      setExisting(data?.trucks ?? [])
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudieron cargar camiones",
        variant: "destructive",
      })
    } finally {
      setLoadingExisting(false)
    }
  }

  useEffect(() => {
    loadExisting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  /* ===============================
     NUEVOS CAMIONES
     =============================== */
  const [paste, setPaste] = useState("")
  const [defaultCarroceria, setDefaultCarroceria] = useState<Carroceria>("CAMION_CON_CARRO")
  const [rows, setRows] = useState<NewTruckRow[]>([])
  const [saving, setSaving] = useState(false)

  const duplicatesInForm = useMemo(() => {
    const counts = new Map<string, number>()
    rows.forEach((r) => {
      const p = normalizePatente(r.patente)
      if (!p) return
      counts.set(p, (counts.get(p) ?? 0) + 1)
    })
    return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([p]) => p))
  }, [rows])

  const handleGenerateRows = () => {
    const patentes = paste
      .split(/\r?\n/)
      .map(normalizePatente)
      .filter(Boolean)

    if (patentes.length === 0) {
      toast({ title: "Sin patentes", description: "Pega al menos una patente.", variant: "destructive" })
      return
    }

    const existentes = new Set(existing.map((e) => normalizePatente(e.patente)))

    const nuevas = patentes.filter((p) => !existentes.has(p))
    if (nuevas.length === 0) {
      toast({
        title: "Sin cambios",
        description: "Todas las patentes ya existen.",
        variant: "destructive",
      })
      setPaste("")
      return
    }

    setRows((prev) => [
      ...prev,
      ...nuevas.map((p) => ({
        patente: p,
        carroceria: defaultCarroceria,
        marca: "",
        modelo: "",
        anio: "",
      })),
    ])
    setPaste("")
  }

  const updateRow = (idx: number, patch: Partial<NewTruckRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!empresaId) {
      toast({ title: "Error", description: "Falta empresaId.", variant: "destructive" })
      return
    }
    if (rows.length === 0) {
      toast({ title: "Sin camiones", description: "No hay camiones para guardar.", variant: "destructive" })
      return
    }
    if (duplicatesInForm.size > 0) {
      toast({
        title: "Patentes duplicadas",
        description: Array.from(duplicatesInForm).join(", "),
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        empresaId: Number(empresaId),
        camiones: rows.map((r) => ({
          patente: normalizePatente(r.patente),
          carroceria: r.carroceria,
          marca: r.marca || null,
          modelo: r.modelo || null,
          anio: r.anio ? Number(r.anio) : null,
          tipo: "camion",
        })),
      }

      const res = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Error al guardar flota")

      toast({
        title: "Listo",
        description: `Camiones agregados correctamente.`,
      })

      setRows([])
      await loadExisting()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error inesperado",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  /* ===============================
     RENDER
     =============================== */
  return (
    <>
      <NavigationButtons />

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Registro de Flota</CardTitle>
          <CardDescription>
            Aquí puedes ver tus camiones registrados y agregar nuevos.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* ===== Camiones existentes ===== */}
          <div>
            <h3 className="font-semibold mb-2">Camiones registrados</h3>

            {existing.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay camiones registrados.
              </p>
            ) : (
              <div className="overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 text-left">Patente</th>
                      <th className="p-2 text-left">Marca</th>
                      <th className="p-2 text-left">Modelo</th>
                      <th className="p-2 text-left">Año</th>
                      <th className="p-2 text-left">Carrocería</th>
                      <th className="p-2 text-left">Foto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existing.map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="p-2 font-medium">{t.patente}</td>
                        <td className="p-2">{t.marca ?? "-"}</td>
                        <td className="p-2">{t.modelo ?? "-"}</td>
                        <td className="p-2">{t.anio ?? "-"}</td>
                        <td className="p-2">{t.carroceria ?? "-"}</td>
                        <td className="p-2">{t.foto_url ? "✅" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ===== Agregar nuevos ===== */}
          <div className="space-y-4">
            <h3 className="font-semibold">Agregar camiones</h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Carrocería por defecto</label>
                <select
                  className="w-full h-10 rounded-md border px-3"
                  value={defaultCarroceria}
                  onChange={(e) => setDefaultCarroceria(e.target.value as Carroceria)}
                >
                  {CARROCERIAS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Pegar patentes (una por línea)</label>
                <textarea
                  className="w-full min-h-[96px] rounded-md border p-2 text-sm"
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                />
                <Button className="mt-2" variant="outline" type="button" onClick={handleGenerateRows}>
                  Generar filas
                </Button>
              </div>
            </div>

            {rows.length > 0 && (
              <div className="overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2">Patente</th>
                      <th className="p-2">Carrocería</th>
                      <th className="p-2">Marca</th>
                      <th className="p-2">Modelo</th>
                      <th className="p-2">Año</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">
                          <Input value={r.patente} onChange={(e) => updateRow(i, { patente: e.target.value })} />
                        </td>
                        <td className="p-2">
                          <select
                            className="w-full h-10 rounded-md border px-2"
                            value={r.carroceria}
                            onChange={(e) => updateRow(i, { carroceria: e.target.value as Carroceria })}
                          >
                            {CARROCERIAS.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <Input value={r.marca} onChange={(e) => updateRow(i, { marca: e.target.value })} />
                        </td>
                        <td className="p-2">
                          <Input value={r.modelo} onChange={(e) => updateRow(i, { modelo: e.target.value })} />
                        </td>
                        <td className="p-2">
                          <Input
                            value={r.anio}
                            inputMode="numeric"
                            placeholder="2020"
                            onChange={(e) => updateRow(i, { anio: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Button variant="outline" type="button" onClick={() => removeRow(i)}>
                            Quitar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button className="w-full" onClick={handleSave} disabled={saving || rows.length === 0}>
              {saving ? "Guardando..." : "Guardar nuevos camiones"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
