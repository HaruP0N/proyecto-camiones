"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

interface FormData {
  nombre: string
  rut: string
  rubro: string
  productos_transportados: string
  telefono_contacto: string
  email_contacto: string
  direccion: string
  prioridad_frio: boolean
  prioridad_carroceria: boolean
  prioridad_estructura: boolean
  prioridad_camion: boolean
  prioridad_acople: boolean
}

function normalizeRut(rut: string) {
  return rut.trim()
}

export function EmpresaForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    nombre: "",
    rut: "",
    rubro: "",
    productos_transportados: "",
    telefono_contacto: "",
    email_contacto: "",
    direccion: "",
    prioridad_frio: false,
    prioridad_carroceria: false,
    prioridad_estructura: false,
    prioridad_camion: false,
    prioridad_acople: false,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (name: keyof FormData, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  const redirectToExistingEmpresa = async (rut: string) => {
    const res = await fetch(`/api/empresas?rut=${encodeURIComponent(rut)}`)
    const data = await res.json()

    if (!res.ok) throw new Error(data?.error || "No se pudo buscar la empresa existente")

    const empresa = data?.empresa
    const empresaId = empresa?.id

    if (!empresaId) {
      throw new Error("El RUT ya existe, pero no se encontró la empresa para redirigir.")
    }

    toast({
      title: "Empresa ya registrada",
      description: `Este RUT ya existe. Te llevaremos a la flota para agregar más camiones.`,
    })

    router.push(`/cliente/flota?empresaId=${empresaId}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const rut = normalizeRut(formData.rut)

    try {
      const response = await fetch("/api/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, rut }),
      })

      const result = await response.json()

      if (response.ok) {
        const empresaId = result?.id

        toast({
          title: "Empresa registrada",
          description: `${formData.nombre} ha sido registrada exitosamente.`,
        })

        if (!empresaId) throw new Error("No se recibió id desde el servidor")

        router.push(`/cliente/flota?empresaId=${empresaId}`)
        return
      }

      const msg = String(result?.error || "")

      // ✅ Caso: RUT duplicado → buscar y redirigir
      if (msg.toLowerCase().includes("rut ya está registrado")) {
        await redirectToExistingEmpresa(rut)
        return
      }

      throw new Error(result?.error || "Error al registrar empresa")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al registrar empresa",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Información de la Empresa</CardTitle>
        <CardDescription>Ingrese los datos del cliente y sus prioridades de inspección</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre de la Empresa *</Label>
                <Input
                  id="nombre"
                  name="nombre"
                  required
                  value={formData.nombre}
                  onChange={handleInputChange}
                  placeholder="Ej: Transportes del Sur S.A."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rut">RUT *</Label>
                <Input
                  id="rut"
                  name="rut"
                  required
                  value={formData.rut}
                  onChange={handleInputChange}
                  placeholder="Ej: 12.345.678-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rubro">Rubro</Label>
              <Input
                id="rubro"
                name="rubro"
                value={formData.rubro}
                onChange={handleInputChange}
                placeholder="Ej: Transporte de carga refrigerada"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                name="direccion"
                value={formData.direccion}
                onChange={handleInputChange}
                placeholder="Ej: Av. Siempre Viva 123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="productos_transportados">Productos Transportados</Label>
              <Textarea
                id="productos_transportados"
                name="productos_transportados"
                value={formData.productos_transportados}
                onChange={handleInputChange}
                placeholder="Ej: Carnes, productos lácteos, frutas y verduras"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono_contacto">Teléfono de Contacto</Label>
                <Input
                  id="telefono_contacto"
                  name="telefono_contacto"
                  type="tel"
                  value={formData.telefono_contacto}
                  onChange={handleInputChange}
                  placeholder="+56 9 1234 5678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_contacto">Email de Contacto</Label>
                <Input
                  id="email_contacto"
                  name="email_contacto"
                  type="email"
                  value={formData.email_contacto}
                  onChange={handleInputChange}
                  placeholder="contacto@empresa.cl"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <h3 className="font-semibold text-lg">Prioridades de Inspección</h3>
            <p className="text-sm text-muted-foreground">Seleccione las categorías prioritarias para esta empresa</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="prioridad_frio"
                  checked={formData.prioridad_frio}
                  onCheckedChange={(checked) => handleCheckboxChange("prioridad_frio", checked as boolean)}
                />
                <Label htmlFor="prioridad_frio" className="cursor-pointer">
                  Sistema de Frío
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="prioridad_carroceria"
                  checked={formData.prioridad_carroceria}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange("prioridad_carroceria", checked as boolean)
                  }
                />
                <Label htmlFor="prioridad_carroceria" className="cursor-pointer">
                  Carrocería
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="prioridad_estructura"
                  checked={formData.prioridad_estructura}
                  onCheckedChange={(checked) => handleCheckboxChange("prioridad_estructura", checked as boolean)}
                />
                <Label htmlFor="prioridad_estructura" className="cursor-pointer">
                  Estructura
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="prioridad_camion"
                  checked={formData.prioridad_camion}
                  onCheckedChange={(checked) => handleCheckboxChange("prioridad_camion", checked as boolean)}
                />
                <Label htmlFor="prioridad_camion" className="cursor-pointer">
                  Camión
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="prioridad_acople"
                  checked={formData.prioridad_acople}
                  onCheckedChange={(checked) => handleCheckboxChange("prioridad_acople", checked as boolean)}
                />
                <Label htmlFor="prioridad_acople" className="cursor-pointer">
                  Acople
                </Label>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Procesando..." : "Registrar Empresa"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
