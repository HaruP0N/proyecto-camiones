"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

// Definición robusta de la interfaz
interface InspeccionHistorial {
  id: number;
  patente: string;
  fecha_programada?: string; // API devuelve fecha_programada
  fecha?: string; // Compatibilidad legacy
  estado: string;
  resultado_general?: string | null;
}

const PAGE_SIZE = 20;

export default function HistorialPage() { // Quitamos props iniciales que causaban confusión
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inspecciones, setInspecciones] = useState<InspeccionHistorial[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredInspecciones, setFilteredInspecciones] = useState<InspeccionHistorial[]>([]);

  // Infinite scroll states
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    try {
      // Usamos el endpoint correcto
      const res = await fetch("/api/inspector/inspecciones/hoy");
      
      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status}`);
      }

      const json = await res.json();

      // 🛡️ BLOQUE DEFENSIVO ANTI-CRASH
      // Buscamos los datos donde sea que vengan (data, inspecciones, o raíz)
      const rawList = json.data || json.inspecciones || [];
      
      if (!Array.isArray(rawList)) {
        console.error("Formato de respuesta inesperado:", json);
        setInspecciones([]);
        return;
      }

      // Filtramos solo las completadas/realizadas
      const list = rawList.filter((i: any) =>
          i.estado === "REALIZADA" ||
          i.estado === "COMPLETADA" ||
          (i.resultado_general && i.resultado_general !== "PENDIENTE")
      );

      setInspecciones(list);
    } catch (err) {
      console.error("Error fetching historial:", err);
      // En caso de error, array vacío para no romper UI
      setInspecciones([]); 
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial]);

  useEffect(() => {
    let filtered = [...inspecciones];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((i) =>
        (i.patente || "").toLowerCase().includes(query)
      );
    }

    setFilteredInspecciones(filtered);
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, inspecciones]);

  // Observer para Infinite Scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredInspecciones.length) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredInspecciones.length));
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, filteredInspecciones.length]);

  const getResultadoBadge = (resultado: string | null | undefined) => {
    const res = (resultado || "").toUpperCase();
    if (res === "APROBADO") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
          <CheckCircle className="h-3 w-3" /> Aprobado
        </span>
      );
    }
    if (res === "OBSERVADO") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">
          <AlertCircle className="h-3 w-3" /> Observado
        </span>
      );
    }
    if (res === "RECHAZADO") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
          <XCircle className="h-3 w-3" /> Rechazado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
        {resultado || "---"}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner className="h-10 w-10 text-primary" />
      </div>
    );
  }

  const visibleItems = filteredInspecciones.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link href="/inspector">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Link>
        </Button>
        <h2 className="text-xl font-bold">Historial de Hoy</h2>
      </div>

      {/* Input de Búsqueda (Opcional, agregar si tienes el componente Input) */}
      
      {/* Vista Escritorio */}
      <div className="hidden md:block overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">Patente</th>
              <th className="px-4 py-3 text-left font-semibold">Fecha Programada</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
              <th className="px-4 py-3 text-left font-semibold">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibleItems.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-50/50">
                <td className="px-4 py-3">{item.id}</td>
                <td className="px-4 py-3 font-medium">{item.patente}</td>
                <td className="px-4 py-3">
                    {/* Preferimos fecha_programada si existe, sino fecha */}
                    {item.fecha_programada 
                        ? new Date(item.fecha_programada).toLocaleDateString("es-CL") 
                        : (item.fecha || "-")}
                </td>
                <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold">
                        {item.estado}
                    </span>
                </td>
                <td className="px-4 py-3">{getResultadoBadge(item.resultado_general)}</td>
              </tr>
            ))}
            {visibleItems.length === 0 && (
                <tr>
                    <td colSpan={5} className="p-8 text-center text-neutral-500">
                        No se encontraron inspecciones finalizadas hoy.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Vista Móvil (Cards) */}
      <div className="block md:hidden space-y-3">
        {visibleItems.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No hay inspecciones en el historial hoy.
          </div>
        ) : (
          visibleItems.map((item) => (
            <Card key={item.id} className="shadow-sm border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">{item.patente}</CardTitle>
                        <CardDescription>ID: #{item.id}</CardDescription>
                    </div>
                    {getResultadoBadge(item.resultado_general)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estado:</span>
                    <span className="font-medium">{item.estado}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fecha:</span>
                    <span>
                        {item.fecha_programada 
                        ? new Date(item.fecha_programada).toLocaleDateString("es-CL") 
                        : (item.fecha || "-")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      {/* Elemento centinela para Infinite Scroll */}
      <div ref={sentinelRef} className="h-4 w-full" />
    </div>
  );
}