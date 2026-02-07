"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { getPlantilla } from "@/lib/inspection/plantillas";
import type { ItemChecklist, RespuestaItem } from "@/lib/inspection/types";
import { calcularNotaResultado } from "@/lib/inspection/rules";
import { InspectionItemRow } from "./InspectionItemRow";
import { PhotoUpload } from "./PhotoUpload";

const inspectionFormSchema = z.object({
  camionId: z.string().min(1, "Selecciona un camion"),
  observacionesGenerales: z.string().optional(),
});

type InspectionFormValues = z.infer<typeof inspectionFormSchema>;

interface InspectionFormProps {
  camionId: string;
  inspectorId: string;
  tipoVehiculo?: string;
  tipoRemolque?: string;
  onComplete?: (inspeccionId: string) => void;
  onCancel?: () => void;
}

export function InspectionForm({
  camionId,
  inspectorId,
  tipoVehiculo,
  tipoRemolque,
  onComplete,
  onCancel,
}: InspectionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("N1");
  const [fotosEvidencia, setFotosEvidencia] = useState<string[]>([]);
  // Para vehículos con remolque: "tracto" o "remolque"
  const [activeUnit, setActiveUnit] = useState<"tracto" | "remolque">("tracto");

  // Determinar items dinámicamente según tipoVehiculo
  const tractoItems = useMemo(() => {
    if (!tipoVehiculo) return [];
    const plantilla = getPlantilla(tipoVehiculo);
    return plantilla?.items ?? [];
  }, [tipoVehiculo]);

  const remolqueItems = useMemo<ItemChecklist[]>(() => {
    if (!tipoRemolque) return [];
    const plantilla = getPlantilla(tipoRemolque);
    return plantilla?.items ?? [];
  }, [tipoRemolque]);

  const hasRemolque = remolqueItems.length > 0;

  // Items activos según la unidad seleccionada
  const activeItems = useMemo(() => {
    if (!hasRemolque || activeUnit === "tracto") return tractoItems;
    return remolqueItems;
  }, [activeUnit, hasRemolque, tractoItems, remolqueItems]);

  // Estado de respuestas para ambas unidades
  const [respuestas, setRespuestas] = useState<
    Record<string, RespuestaItem>
  >(() => {
    const initial: Record<string, RespuestaItem> = {};
    // Inicializar tracto
    tractoItems.forEach((item) => {
      initial[item.id] = { estado: undefined, fotos: [] };
    });
    // Inicializar remolque si aplica
    if (hasRemolque) {
      remolqueItems.forEach((item) => {
        initial[item.id] = { estado: undefined, fotos: [] };
      });
    }
    return initial;
  });

  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues: {
      camionId: camionId,
      observacionesGenerales: "",
    },
  });

  // Calcular nota en tiempo real usando todos los items (tracto + remolque)
  const allItems = useMemo(() => {
    return hasRemolque ? [...tractoItems, ...remolqueItems] : tractoItems;
  }, [hasRemolque, tractoItems, remolqueItems]);

  const notaFinal = useMemo(() => {
    const itemsConRespuesta = allItems.filter(
      (item) => respuestas[item.id]?.estado
    );
    if (itemsConRespuesta.length === 0) return 0;

    // Construir un pseudo-state compatible con calcularNotaResultado
    const state = {
      meta: {
        fechaHoraISO: "",
        inspector: "",
        empresa: "",
        lugar: "",
        patenteCamion: "",
      },
      respuestas,
    };

    const resultado = calcularNotaResultado(state, allItems);
    return typeof resultado.nota === "number" ? resultado.nota : 0;
  }, [respuestas, allItems]);

  // Contar fallos por nivel (solo para los items activos visibles)
  const fallosPorNivel = useMemo(() => {
    const counts = { N1: 0, N2: 0, N3: 0, N4: 0 };
    Object.entries(respuestas).forEach(([itemId, resp]) => {
      const item = activeItems.find((i) => i.id === itemId);
      if (item && resp.estado === "no_cumple") {
        counts[`N${item.nivel}` as keyof typeof counts]++;
      }
    });
    return counts;
  }, [respuestas, activeItems]);

  const handleSubmit = async (values: InspectionFormValues) => {
    try {
      setIsSubmitting(true);

      const respuestasArray = allItems.map((item) => ({
        itemId: item.id,
        ...respuestas[item.id],
      }));

      const response = await fetch(
        `/api/inspector/inspecciones/${camionId}/completar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            camionId,
            respuestas: respuestasArray,
            observacionesGenerales: values.observacionesGenerales,
            notaFinal: Math.round(notaFinal),
            fotos_evidencia: fotosEvidencia,
            tipoVehiculo: tipoVehiculo || "camion",
            tipoRemolque: tipoRemolque || null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al guardar");
      }

      const result = await response.json();
      toast({
        title: "Inspeccion completada",
        description: `Nota final: ${notaFinal.toFixed(1)}/100`,
        duration: 5000,
      });

      onComplete?.(result.data?.inspeccion_id || camionId);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const levels = ["N1", "N2", "N3", "N4"];

  // Nombre legible de la plantilla del remolque
  const remolqueNombre = useMemo(() => {
    if (!tipoRemolque) return "";
    const plantilla = getPlantilla(tipoRemolque);
    return plantilla?.nombre ?? tipoRemolque;
  }, [tipoRemolque]);

  return (
    <div className="w-full space-y-4">
      {/* Resumen de nota */}
      <Card className="border-l-4 border-l-blue-600">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">
                Inspeccion de Vehiculo
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                ID: {camionId} - Inspector: {inspectorId}
              </CardDescription>
              {hasRemolque && (
                <CardDescription className="text-xs mt-1">
                  Remolque: {remolqueNombre}
                </CardDescription>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs sm:text-sm text-gray-600">
                Nota actual
              </div>
              <div
                className={`text-3xl sm:text-4xl font-bold ${
                  notaFinal >= 80
                    ? "text-green-600"
                    : notaFinal >= 60
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {notaFinal.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500">/100</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {levels.map((level) => (
              <div
                key={level}
                className="text-center p-1.5 sm:p-2 bg-gray-50 rounded"
              >
                <div className="text-xs font-semibold text-gray-600">
                  {level}
                </div>
                <div className="text-lg font-bold text-red-600">
                  {fallosPorNivel[level as keyof typeof fallosPorNivel]}
                </div>
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>

      {/* Selector Tracto / Remolque (solo si hay remolque) */}
      {hasRemolque && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveUnit("tracto")}
            className={`py-3 px-4 rounded-xl text-sm font-semibold transition-all min-h-[48px] ${
              activeUnit === "tracto"
                ? "bg-neutral-900 text-white shadow-md"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 active:bg-neutral-200"
            }`}
          >
            Tracto (Camion)
          </button>
          <button
            type="button"
            onClick={() => setActiveUnit("remolque")}
            className={`py-3 px-4 rounded-xl text-sm font-semibold transition-all min-h-[48px] ${
              activeUnit === "remolque"
                ? "bg-neutral-900 text-white shadow-md"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 active:bg-neutral-200"
            }`}
          >
            {remolqueNombre}
          </button>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Tabs por nivel */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              {levels.map((level) => (
                <TabsTrigger
                  key={level}
                  value={level}
                  className="min-h-[44px] text-xs sm:text-sm"
                >
                  {level}
                  {fallosPorNivel[level as keyof typeof fallosPorNivel] > 0 && (
                    <span className="ml-1 text-red-600 font-bold">
                      {fallosPorNivel[level as keyof typeof fallosPorNivel]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {levels.map((level) => {
              const nivelNum = parseInt(level.replace("N", "")) as
                | 1
                | 2
                | 3
                | 4;
              const itemsForLevel = activeItems.filter(
                (item) => item.nivel === nivelNum
              );

              return (
                <TabsContent
                  key={level}
                  value={level}
                  className="space-y-3 mt-3"
                >
                  {itemsForLevel.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 text-sm">
                      No hay items de nivel {level} para{" "}
                      {activeUnit === "tracto" ? "el tracto" : "el remolque"}.
                    </div>
                  ) : (
                    itemsForLevel.map((item) => (
                      <InspectionItemRow
                        key={item.id}
                        item={item}
                        respuesta={
                          respuestas[item.id] || {
                            estado: undefined,
                            fotos: [],
                          }
                        }
                        onChange={(newRespuesta) => {
                          setRespuestas((prev) => ({
                            ...prev,
                            [item.id]: newRespuesta,
                          }));
                        }}
                      />
                    ))
                  )}
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Fotos de evidencia */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fotos de Evidencia</CardTitle>
              <CardDescription className="text-xs">
                Sube fotos de la inspeccion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PhotoUpload onPhotosChange={setFotosEvidencia} maxFiles={10} />
            </CardContent>
          </Card>

          {/* Observaciones */}
          <FormField
            control={form.control}
            name="observacionesGenerales"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observaciones Generales</FormLabel>
                <FormControl>
                  <textarea
                    {...field}
                    placeholder="Notas adicionales"
                    className="w-full min-h-[100px] p-3 border rounded-xl text-sm resize-y"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Acciones */}
          <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 min-h-[48px]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-green-600 hover:bg-green-700 active:bg-green-800 min-h-[48px]"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Guardando...
                </>
              ) : (
                "Completar Inspeccion"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
