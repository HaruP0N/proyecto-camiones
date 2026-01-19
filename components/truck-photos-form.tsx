"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

type Truck = {
  id: string
  patente: string
}

export function TruckPhotosForm() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const empresaId = searchParams.get("empresaId")

  const [trucks, setTrucks] = useState<Truck[]>([])
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!empresaId) return

    fetch(`/api/trucks?empresaId=${empresaId}`)
      .then((r) => r.json())
      .then((d) => setTrucks(d.trucks || []))
  }, [empresaId])

  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [previews])

  const completed = useMemo(
    () => trucks.filter((t) => files[t.id]).length,
    [trucks, files]
  )

  const allDone = trucks.length > 0 && completed === trucks.length

  const onPick = (truckId: string, file: File | null) => {
    setFiles((p) => ({ ...p, [truckId]: file }))
    setPreviews((p) => {
      const old = p[truckId]
      if (old) URL.revokeObjectURL(old)
      return file ? { ...p, [truckId]: URL.createObjectURL(file) } : p
    })
  }

  const submit = async () => {
    if (!empresaId || !allDone) {
      toast({
        title: "Faltan fotos",
        description: "Debes subir una foto por cada camión.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      for (const t of trucks) {
        const f = files[t.id]
        if (!f) continue

        const fd = new FormData()
        fd.append("empresaId", empresaId)
        fd.append("truckId", t.id)
        fd.append("photo", f)

        const res = await fetch("/api/truck-photo", {
          method: "POST",
          body: fd,
        })
        if (!res.ok) throw new Error("Error subiendo fotos")
      }

      toast({ title: "Registro completado" })
      router.push("/admin")
    } catch (e) {
      toast({
        title: "Error",
        description: "No se pudieron subir las fotos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fotos por camión</CardTitle>
        <CardDescription>
          Progreso: {completed}/{trucks.length}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {trucks.map((t) => (
          <div
            key={t.id}
            className="flex flex-col md:flex-row items-center gap-4 border rounded p-3"
          >
            <div className="min-w-[120px]">
              <div className="text-sm text-muted-foreground">Patente</div>
              <div className="font-semibold">{t.patente}</div>
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPick(t.id, e.target.files?.[0] || null)}
            />

            <div className="w-[160px] h-[100px] border rounded flex items-center justify-center overflow-hidden">
              {previews[t.id] ? (
                <Image
                  src={previews[t.id]}
                  alt={t.patente}
                  width={160}
                  height={100}
                  className="object-cover"
                />
              ) : (
                <span className="text-xs text-muted-foreground">Sin foto</span>
              )}
            </div>
          </div>
        ))}

        <div className="flex justify-end">
          <Button onClick={submit} disabled={!allDone || loading}>
            {loading ? "Subiendo..." : "Finalizar registro"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
