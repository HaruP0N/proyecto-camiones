"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

type Truck = {
  id: number
  patente: string
}

type PhotoState = {
  file: File
  previewUrl: string
}

export function TruckPhotosForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const empresaId = searchParams.get("empresaId")

  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // key = truckId
  const [photosByTruckId, setPhotosByTruckId] = useState<Record<number, PhotoState | undefined>>({})

  // ---- cargar camiones por empresa ----
  useEffect(() => {
    if (!empresaId) {
      setLoading(false)
      return
    }

    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/trucks?empresaId=${empresaId}`)
        const data = await res.json()

        if (!res.ok) throw new Error(data?.error || "Error al cargar camiones")

        setTrucks(data.trucks ?? [])
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "No se pudieron cargar los camiones",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [empresaId, toast])

  // ---- helpers ----
  const totalRequired = trucks.length
  const totalSelected = useMemo(() => {
    return trucks.reduce((acc, t) => acc + (photosByTruckId[t.id] ? 1 : 0), 0)
  }, [trucks, photosByTruckId])

  const allSelected = totalRequired > 0 && totalSelected === totalRequired

  const handlePickFile = (truckId: number, file: File | null) => {
    if (!file) return

    // validación básica
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Archivo inválido",
        description: "Debe ser una imagen (jpg, png, etc.)",
        variant: "destructive",
      })
      return
    }

    // crea preview local
    const previewUrl = URL.createObjectURL(file)

    // si ya había un preview, lo revocamos para evitar leaks
    const prev = photosByTruckId[truckId]
    if (prev?.previewUrl) {
      URL.revokeObjectURL(prev.previewUrl)
    }

    setPhotosByTruckId((p) => ({
      ...p,
      [truckId]: { file, previewUrl },
    }))
  }

  const handleRemove = (truckId: number) => {
    const prev = photosByTruckId[truckId]
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)

    setPhotosByTruckId((p) => {
      const copy = { ...p }
      delete copy[truckId]
      return copy
    })
  }

  // cleanup previews on unmount
  useEffect(() => {
    return () => {
      Object.values(photosByTruckId).forEach((x) => {
        if (x?.previewUrl) URL.revokeObjectURL(x.previewUrl)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- guardar (mock: guarda URL placeholder) ----
  const handleSave = async () => {
    if (!empresaId) {
      toast({ title: "Error", description: "Falta empresaId en la URL", variant: "destructive" })
      return
    }
    if (trucks.length === 0) {
      toast({ title: "Sin camiones", description: "No hay camiones para subir fotos.", variant: "destructive" })
      return
    }
    if (!allSelected) {
      toast({
        title: "Faltan fotos",
        description: `Has seleccionado ${totalSelected}/${totalRequired}. Debe haber 1 foto por camión.`,
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      // Aquí, mientras no haya storage real, guardaremos un placeholder por camión.
      // Luego esto lo cambiaremos a: subir archivo → obtener URL real → guardar.
      for (const t of trucks) {
        const photo = photosByTruckId[t.id]
        if (!photo) continue

        // placeholder: puedes cambiarlo por una ruta estática si quieres
        const fakeUrl = `pending-upload://${t.patente}`

        const res = await fetch("/api/truck-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            camionId: t.id,
            url: fakeUrl,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || `Error guardando foto de ${t.patente}`)
      }

      toast({
        title: "Listo",
        description: "Fotos registradas (pendiente subir a storage real).",
      })

      // Si quieres, aquí puedes mandar al login, o a “confirmación”
      router.push("/login")
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudieron guardar las fotos",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // ---- render ----
  if (loading) {
    return <div className="p-4">Cargando camiones...</div>
  }

  if (!empresaId) {
    return <div className="p-4 text-red-600">Falta empresaId en la URL. Vuelve a Flota.</div>
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Fotos por Camión</CardTitle>
        <CardDescription>
          1 foto por camión (ideal vista 3/4). Progreso: {totalSelected}/{totalRequired}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {trucks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay camiones registrados para esta empresa.</p>
        ) : (
          trucks.map((t) => {
            const photo = photosByTruckId[t.id]

            return (
              <div key={t.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Patente</p>
                    <p className="text-sm text-muted-foreground">{t.patente}</p>
                  </div>

                  {photo ? (
                    <Button type="button" variant="outline" onClick={() => handleRemove(t.id)}>
                      Quitar
                    </Button>
                  ) : null}
                </div>

                {photo ? (
                  <div className="relative w-full h-56 rounded-md overflow-hidden border">
                    {/* Preview local (blob:) */}
                    <Image
                      src={photo.previewUrl}
                      alt={`Foto ${t.patente}`}
                      fill
                      className="object-contain bg-white"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Aún no seleccionas una foto.</div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePickFile(t.id, e.target.files?.[0] ?? null)}
                />
              </div>
            )
          })
        )}

        <Button className="w-full" onClick={handleSave} disabled={saving || trucks.length === 0}>
          {saving ? "Guardando..." : "Guardar fotos"}
        </Button>

        <p className="text-xs text-muted-foreground">
          Nota: por ahora se guarda un marcador (pending-upload://...). Cuando definan dónde almacenar imágenes, se
          reemplaza por subida real + URL.
        </p>
      </CardContent>
    </Card>
  )
}
