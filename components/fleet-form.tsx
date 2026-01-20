"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

/* ===== Valores EXACTOS permitidos por CK_camiones_carroceria ===== */
type Carroceria =
  | "CAMION_CON_CARRO"
  | "CARRO_REEFER"
  | "CAMARA_DE_FRIO"
  | "CAMION_PAQUETERO"

type TruckRow = {
  patente: string
  carroceria: Carroceria
  marca: string
  modelo: string
  anio: string
}

type ExistingTruck = {
  id: number
  patente: string
  marca: string | null
  modelo: string | null
  anio: number | null
  carroceria: string | null
  foto_url?: string | null
}

const CARROCERIAS: { value: Carroceria; label: string }[] = [
  { value: "CAMION_CON_CARRO", label: "Camión con carro" },
  { value: "CARRO_REEFER", label: "Carro reefer" },
  { value: "CAMARA_DE_FRIO", label: "Cámara de frío" },
  { value: "CAMION_PAQUETERO", label: "Camión paquetero" },
]

function normalizePatente(x: string) {
  return x.replace(/\s+/g, "").toUpperCase()
}

export function FleetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const empresaId = searchParams.get("empresaId")

  // --- lista de camiones ya registrados ---
  const [existing, setExisting] = useState<ExistingTruck[]>([])
  const [loadingExisting, setLoadingExisting] = useState(false)

  const loadExisting = async () => {
    if (!empresaId) return
    try {
      setLoadingExisting(true)
      const res = await fetch(`/api/fleet?empresaId=${empresaId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Error al cargar camiones registrados")
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

  // --- form para agregar ---
  const [defaultCarroceria, setDefaultCarroceria] = useState<Carroceria>("CAMION_CON_CARRO")
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
      toast({ title: "Sin patentes", description: "Pega al menos una patente.", variant: "destructive" })
      return
    }

    // evita duplicados dentro del form
    const existingInForm = new Set(rows.map((r) => normalizePatente(r.patente)))
    const toAdd = patentes.filter((p) => !existingInForm.has(p))

    // (opcional) aviso si ya existen en BD
    const existingInDB = new Set(existing.map((t) => normalizePatente(t.patente)))
    const alreadyDB = toAdd.filter((p) => existingInDB.has(p))
    const reallyNew = toAdd.filter((p) => !existingInDB.has(p))

    if (alreadyDB.length > 0) {
      toast({
        title: "Patentes ya registradas",
        description: `Estas ya existen y se omiten: ${alreadyDB.join(", ")}`,
        variant: "destructive",
      })
    }

    if (reallyNew.length === 0) {
      setPaste("")
      return
    }

    setRows((prev) => [
      ...prev,
      ...reallyNew.map((p) => ({
        patente: p,
        carroceria: defaultCarroceria,
        marca: "",
        modelo: "",
        anio: "",
      })),
    ])

    setPaste("")
  }

  const updateRow = (idx: number, patch: Partial<TruckRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const validate = () => {
    if (!empresaId) return "Falta empresaId en la URL."
    if (rows.length === 0) return "Debes agregar al menos un camión."

    for (const r of rows) {
      if (!normalizePatente(r.patente)) return "Hay una patente vacía."
      if (r.anio) {
        const n = Number(r.anio)
        if (!Number.isInteger(n) || n < 1900 || n > 2100) return `Año inválido en patente ${r.patente}`
      }
    }

    if (duplicatesInForm.size > 0) return `Patentes duplicadas: ${Array.from(duplicatesInForm).join(", ")}`
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) {
      toast({ title: "Error", description: err, variant: "destructive" })
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

      const inserted = data?.insertedCount ?? 0
      const dups = (data?.duplicates ?? []) as string[]

      toast({
        title: "Flota actualizada",
        description: dups.length
          ? `Insertados: ${inserted}. Duplicados omitidos: ${dups.join(", ")}`
          : `Insertados: ${inserted}.`,
      })

      // refrescar tabla y limpiar
      setRows([])
      await loadExisting()

      // si quieres avanzar directo a fotos:
      router.push(`/cliente/fotos?empresaId=${empresaId}`)
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

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Registro de Flota</CardTitle>
        <CardDescription>
          Se muestran los camiones ya registrados y puedes agregar nuevos.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* ===== Tabla camiones existentes ===== */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Camiones registrados</h3>
            <Button type="button" variant="outline" onClick={loadExisting} disabled={loadingExisting || !empresaId}>
              {loadingExisting ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>

          {!empresaId ? (
            <p className="text-sm text-red-600">Falta empresaId en la URL.</p>
          ) : existing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay camiones registrados para esta empresa.</p>
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

        {/* ===== Form agregar nuevos ===== */}
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
                placeholder="ABCD12&#10;EFGH34"
              />
              <Button className="mt-2" variant="outline" type="button" onClick={handleGenerateRows}>
                Generar filas
              </Button>
            </div>
          </div>

          {rows.length > 0 ? (
            <div className="overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">Patente</th>
                    <th className="p-2 text-left">Carrocería</th>
                    <th className="p-2 text-left">Marca</th>
                    <th className="p-2 text-left">Modelo</th>
                    <th className="p-2 text-left">Año</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const isDup = duplicatesInForm.has(normalizePatente(r.patente))
                    return (
                      <tr key={i} className={isDup ? "bg-red-50" : "border-t"}>
                        <td className="p-2 min-w-[140px]">
                          <Input
                            value={r.patente}
                            onChange={(e) => updateRow(i, { patente: e.target.value })}
                            className={isDup ? "border-red-400" : ""}
                          />
                        </td>

                        <td className="p-2 min-w-[180px]">
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

                        <td className="p-2 min-w-[160px]">
                          <Input value={r.marca} onChange={(e) => updateRow(i, { marca: e.target.value })} />
                        </td>

                        <td className="p-2 min-w-[160px]">
                          <Input value={r.modelo} onChange={(e) => updateRow(i, { modelo: e.target.value })} />
                        </td>

                        <td className="p-2 min-w-[110px]">
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Agrega patentes para crear filas.</p>
          )}

          <Button className="w-full" onClick={handleSave} disabled={saving || rows.length === 0}>
            {saving ? "Guardando..." : "Guardar nuevos camiones"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
