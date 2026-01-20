"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

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
  carroceria: Carroceria | null
  foto_url?: string | null
}

type TruckRow = {
  patente: string
  carroceria: Carroceria
  marca: string
  modelo: string
  anio: string
}

type PhotoState = { file: File; previewUrl: string }

/** ✅ Estado editable para tabla de existentes (anio como string) */
type EditTruckPatch = {
  marca?: string
  modelo?: string
  anio?: string
  carroceria?: Carroceria
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

  // -------- existentes --------
  const [existing, setExisting] = useState<ExistingTruck[]>([])
  const [loadingExisting, setLoadingExisting] = useState(false)

  /** ✅ ahora el patch tiene anio string */
  const [editById, setEditById] = useState<Record<number, EditTruckPatch>>({})

  // fotos seleccionadas para existentes (key=truckId)
  const [photoExisting, setPhotoExisting] = useState<Record<number, PhotoState | undefined>>({})
  const fileRefsExisting = useRef<Record<number, HTMLInputElement | null>>({})

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

  // -------- nuevos --------
  const [defaultCarroceria, setDefaultCarroceria] = useState<Carroceria>("CAMION_CON_CARRO")
  const [paste, setPaste] = useState("")
  const [rows, setRows] = useState<TruckRow[]>([])
  const [saving, setSaving] = useState(false)

  // fotos para nuevos (key = patente normalizada)
  const [photoNewByPatente, setPhotoNewByPatente] = useState<Record<string, PhotoState | undefined>>({})
  const fileRefsNew = useRef<Record<string, HTMLInputElement | null>>({})

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

    const existingInDB = new Set(existing.map((t) => normalizePatente(t.patente)))
    const existingInForm = new Set(rows.map((r) => normalizePatente(r.patente)))

    const toAdd = patentes.filter((p) => !existingInForm.has(p))
    const alreadyDB = toAdd.filter((p) => existingInDB.has(p))
    const reallyNew = toAdd.filter((p) => !existingInDB.has(p))

    if (alreadyDB.length > 0) {
      toast({
        title: "Patentes ya registradas",
        description: `Se omiten: ${alreadyDB.join(", ")}`,
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
    const patente = normalizePatente(rows[idx]?.patente || "")
    const prev = photoNewByPatente[patente]
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)

    setPhotoNewByPatente((p) => {
      const copy = { ...p }
      delete copy[patente]
      return copy
    })

    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  // --- foto helpers ---
  const pickPhotoNew = (patente: string, file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo inválido", description: "Debe ser una imagen.", variant: "destructive" })
      return
    }
    const key = normalizePatente(patente)
    const previewUrl = URL.createObjectURL(file)

    const prev = photoNewByPatente[key]
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)

    setPhotoNewByPatente((p) => ({ ...p, [key]: { file, previewUrl } }))
  }

  const openPickerNew = (patente: string) => {
    const key = normalizePatente(patente)
    const input = fileRefsNew.current[key]
    if (!input) return
    input.click()
  }

  const pickPhotoExisting = (truckId: number, file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo inválido", description: "Debe ser una imagen.", variant: "destructive" })
      return
    }
    const previewUrl = URL.createObjectURL(file)

    const prev = photoExisting[truckId]
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)

    setPhotoExisting((p) => ({ ...p, [truckId]: { file, previewUrl } }))
  }

  const openPickerExisting = (truckId: number) => {
    const input = fileRefsExisting.current[truckId]
    if (!input) return
    input.click()
  }

  // --- validar nuevos ---
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

  // --- guardar nuevos camiones + fotos placeholder ---
  const handleSaveNew = async () => {
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

      const insertedTrucks: Array<{ id: number; patente: string }> = data?.insertedTrucks ?? []
      const duplicates: string[] = data?.duplicates ?? []

      for (const it of insertedTrucks) {
        const key = normalizePatente(it.patente)
        const photo = photoNewByPatente[key]
        if (!photo) continue

        const fakeUrl = `pending-upload://${key}`

        const r2 = await fetch("/api/truck-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ camionId: it.id, url: fakeUrl }),
        })
        const d2 = await r2.json()
        if (!r2.ok) throw new Error(d2?.error || `Error guardando foto de ${key}`)
      }

      toast({
        title: "Flota actualizada",
        description: duplicates.length
          ? `Insertados: ${insertedTrucks.length}. Duplicados omitidos: ${duplicates.join(", ")}`
          : `Insertados: ${insertedTrucks.length}.`,
      })

      rows.forEach((r) => {
        const key = normalizePatente(r.patente)
        const prev = photoNewByPatente[key]
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      })
      setRows([])
      setPhotoNewByPatente({})

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

  // ✅ convertir string -> number|null al guardar edición
  const parseYear = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null
    if (typeof value === "number") return value
    const s = String(value).trim()
    if (s === "") return null
    const n = Number(s)
    if (!Number.isInteger(n)) return null
    return n
  }

  // --- guardar edición de existente ---
  const saveExistingRow = async (t: ExistingTruck) => {
    const patch = editById[t.id] ?? {}

    const carroceria = (patch.carroceria ?? t.carroceria) as Carroceria | null
    const anio = parseYear(patch.anio ?? t.anio)

    if (anio !== null && (anio < 1900 || anio > 2100)) {
      toast({ title: "Error", description: "Año inválido.", variant: "destructive" })
      return
    }

    try {
      const res = await fetch("/api/fleet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truckId: t.id,
          marca: (patch.marca ?? t.marca) ?? null,
          modelo: (patch.modelo ?? t.modelo) ?? null,
          anio,
          carroceria: carroceria ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar el camión")

      toast({ title: "Actualizado", description: `Camión ${t.patente} actualizado.` })
      setEditById((p) => {
        const copy = { ...p }
        delete copy[t.id]
        return copy
      })
      await loadExisting()
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Error", variant: "destructive" })
    }
  }

  // --- guardar foto existente (placeholder) ---
  const saveExistingPhoto = async (t: ExistingTruck) => {
    const photo = photoExisting[t.id]
    if (!photo) {
      toast({ title: "Falta foto", description: "Selecciona una foto primero.", variant: "destructive" })
      return
    }

    try {
      const fakeUrl = `pending-upload://${normalizePatente(t.patente)}`

      const res = await fetch("/api/truck-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camionId: t.id, url: fakeUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar la foto")

      toast({ title: "Foto registrada", description: `Foto guardada para ${t.patente} (placeholder).` })

      if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl)
      setPhotoExisting((p) => {
        const copy = { ...p }
        delete copy[t.id]
        return copy
      })

      await loadExisting()
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Error", variant: "destructive" })
    }
  }

  if (!empresaId) {
    return <div className="p-4 text-red-600">Falta empresaId en la URL.</div>
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Registro de Flota</CardTitle>
        <CardDescription>Puedes ver, editar y agregar camiones. También seleccionar foto por camión.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* ===== Camiones existentes (editable + foto) ===== */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Camiones registrados</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push(`/cliente/fotos?empresaId=${empresaId}`)}>
                Ir a página de fotos (opcional)
              </Button>
              <Button variant="outline" onClick={loadExisting} disabled={loadingExisting}>
                {loadingExisting ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </div>

          {existing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay camiones registrados.</p>
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
                    <th className="p-2 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {existing.map((t) => {
                    const patch = editById[t.id] ?? {}
                    const effective = {
                      marca: patch.marca ?? t.marca ?? "",
                      modelo: patch.modelo ?? t.modelo ?? "",
                      anio: patch.anio ?? (t.anio !== null ? String(t.anio) : ""),
                      carroceria: (patch.carroceria ?? t.carroceria ?? "CAMION_CON_CARRO") as Carroceria,
                    }

                    const photo = photoExisting[t.id]

                    return (
                      <tr key={t.id} className="border-t align-top">
                        <td className="p-2 font-medium">{t.patente}</td>

                        <td className="p-2 min-w-[160px]">
                          <Input
                            value={effective.marca}
                            onChange={(e) =>
                              setEditById((p) => ({
                                ...p,
                                [t.id]: { ...(p[t.id] ?? {}), marca: e.target.value },
                              }))
                            }
                          />
                        </td>

                        <td className="p-2 min-w-[160px]">
                          <Input
                            value={effective.modelo}
                            onChange={(e) =>
                              setEditById((p) => ({
                                ...p,
                                [t.id]: { ...(p[t.id] ?? {}), modelo: e.target.value },
                              }))
                            }
                          />
                        </td>

                        <td className="p-2 min-w-[110px]">
                          <Input
                            value={effective.anio}
                            inputMode="numeric"
                            placeholder="2020"
                            onChange={(e) =>
                              setEditById((p) => ({
                                ...p,
                                [t.id]: { ...(p[t.id] ?? {}), anio: e.target.value },
                              }))
                            }
                          />
                        </td>

                        <td className="p-2 min-w-[190px]">
                          <select
                            className="w-full h-10 rounded-md border px-2"
                            value={effective.carroceria}
                            onChange={(e) =>
                              setEditById((p) => ({
                                ...p,
                                [t.id]: { ...(p[t.id] ?? {}), carroceria: e.target.value as Carroceria },
                              }))
                            }
                          >
                            {CARROCERIAS.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2 min-w-[240px] space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{t.foto_url ? "✅ registrada" : "— sin foto"}</span>
                            <Button type="button" variant="outline" onClick={() => openPickerExisting(t.id)}>
                              {photo ? "Cambiar" : "Seleccionar"}
                            </Button>
                          </div>

                          {photo ? (
                            <div className="relative w-full h-32 rounded-md overflow-hidden border">
                              <Image
                                src={photo.previewUrl}
                                alt={`Foto ${t.patente}`}
                                fill
                                className="object-contain bg-white"
                              />
                            </div>
                          ) : null}

                          <input
                            ref={(el) => {
                              fileRefsExisting.current[t.id] = el
                            }}
                            className="hidden"
                            type="file"
                            accept="image/*"
                            onChange={(e) => pickPhotoExisting(t.id, e.target.files?.[0] ?? null)}
                          />

                          <Button type="button" className="w-full" onClick={() => saveExistingPhoto(t)}>
                            Guardar foto
                          </Button>
                        </td>

                        <td className="p-2 min-w-[160px]">
                          <Button type="button" className="w-full" onClick={() => saveExistingRow(t)}>
                            Guardar cambios
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

        {/* ===== Agregar nuevos camiones + foto ===== */}
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

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Agrega patentes para crear filas.</p>
          ) : (
            <div className="overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">Patente</th>
                    <th className="p-2 text-left">Carrocería</th>
                    <th className="p-2 text-left">Marca</th>
                    <th className="p-2 text-left">Modelo</th>
                    <th className="p-2 text-left">Año</th>
                    <th className="p-2 text-left">Foto</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const key = normalizePatente(r.patente)
                    const isDup = duplicatesInForm.has(key)
                    const photo = photoNewByPatente[key]

                    return (
                      <tr key={i} className={isDup ? "bg-red-50" : "border-t align-top"}>
                        <td className="p-2 min-w-[140px]">
                          <Input
                            value={r.patente}
                            onChange={(e) => updateRow(i, { patente: e.target.value })}
                            className={isDup ? "border-red-400" : ""}
                          />
                        </td>

                        <td className="p-2 min-w-[190px]">
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

                        <td className="p-2 min-w-[240px] space-y-2">
                          <Button type="button" variant="outline" onClick={() => openPickerNew(r.patente)}>
                            {photo ? "Cambiar foto" : "Agregar foto"}
                          </Button>

                          {photo ? (
                            <div className="relative w-full h-32 rounded-md overflow-hidden border">
                              <Image src={photo.previewUrl} alt={`Foto ${key}`} fill className="object-contain bg-white" />
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Opcional: puedes agregar foto ahora o después.</p>
                          )}

                          <input
                            ref={(el) => {
                              fileRefsNew.current[key] = el
                            }}
                            className="hidden"
                            type="file"
                            accept="image/*"
                            onChange={(e) => pickPhotoNew(r.patente, e.target.files?.[0] ?? null)}
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
          )}

          <Button className="w-full" onClick={handleSaveNew} disabled={saving || rows.length === 0}>
            {saving ? "Guardando..." : "Guardar nuevos camiones"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Nota: por ahora la “foto” se registra como marcador (pending-upload://...). Cuando definamos storage, se reemplaza
            por URL real sin cambiar la UI.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
