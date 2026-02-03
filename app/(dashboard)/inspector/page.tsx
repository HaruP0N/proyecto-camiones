"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import {
  Truck,
  Search,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  Filter,
  Plus,
  Calendar,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils-cn";

interface Camion {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  tipo: string;
  empresa: string;
  estado?: "disponible" | "en_inspeccion" | "programado";
  ultimaInspeccion?: string;
  proximaInspeccion?: string;
}

interface Inspector {
  id: string;
  nombre: string;
  email: string;
}

type FilterType = "all" | "available" | "scheduled" | "inspecting";

export default function InspectorFleetPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [camiones, setCamiones] = useState<Camion[]>([]);
  const [filteredCamiones, setFilteredCamiones] = useState<Camion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [inspector, setInspector] = useState<Inspector | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterCamiones();
  }, [searchQuery, activeFilter, camiones]);

  async function fetchData() {
    try {
      // Obtener datos del inspector
      const meRes = await fetch("/api/inspector/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        setInspector(meData.data);
      }

      // Obtener camiones disponibles para inspección
      const res = await fetch("/api/inspector/inspecciones/hoy");
      if (!res.ok) throw new Error("Error al cargar datos");

      const data = await res.json();
      const camionesData = (data.data || []).map((insp: any) => ({
        id: insp.camion_id,
        patente: insp.patente,
        marca: insp.marca,
        modelo: insp.modelo,
        anio: insp.anio || 2020,
        tipo: insp.tipo || "Camión",
        empresa: insp.empresa,
        estado: insp.estado === "PROGRAMADA" ? "programado" :
                insp.estado === "EN_PROGRESO" ? "en_inspeccion" : "disponible",
        proximaInspeccion: insp.fecha_programada,
      }));

      setCamiones(camionesData);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function filterCamiones() {
    let filtered = [...camiones];

    // Filtro por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.patente.toLowerCase().includes(query) ||
          c.marca.toLowerCase().includes(query) ||
          c.modelo.toLowerCase().includes(query) ||
          c.empresa.toLowerCase().includes(query)
      );
    }

    // Filtro por estado
    if (activeFilter !== "all") {
      const estadoMap: Record<FilterType, string> = {
        all: "",
        available: "disponible",
        scheduled: "programado",
        inspecting: "en_inspeccion",
      };
      filtered = filtered.filter((c) => c.estado === estadoMap[activeFilter]);
    }

    setFilteredCamiones(filtered);
  }

  // Ir a la pantalla de pre-inspección
  const handleSelectTruck = (camion: Camion) => {
    router.push(`/inspector/inspeccion/${camion.id}`);
  };

  const getEstadoBadge = (estado?: string) => {
    switch (estado) {
      case "disponible":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
            <CheckCircle className="h-4 w-4" />
            Disponible
          </span>
        );
      case "programado":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
            <Calendar className="h-4 w-4" />
            Programado
          </span>
        );
      case "en_inspeccion":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
            <AlertTriangle className="h-4 w-4" />
            En curso
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <Spinner className="h-10 w-10 mx-auto text-red-600" />
          <p className="text-neutral-500">Cargando flota...</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: camiones.length,
    disponibles: camiones.filter((c) => c.estado === "disponible").length,
    programados: camiones.filter((c) => c.estado === "programado").length,
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header Sticky Simplificado y Posicionado Correctamente */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-16 z-40">
        <div className="px-4 py-4">
           <h1 className="text-xl font-bold text-white mb-1">Tu Flota</h1>
           <p className="text-sm text-neutral-400">
            Bienvenido, {inspector?.nombre || "Inspector"}. Selecciona para comenzar.
           </p>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6">
        
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por patente, marca..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-neutral-100 border border-neutral-200 rounded-2xl text-base text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-200 rounded-full"
            >
              <X className="h-4 w-4 text-neutral-500" />
            </button>
          )}
        </div>

        {/* Section Title con filtro más visible */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-600 uppercase tracking-wide">
            Vehículos Asignados
          </h2>
          <button className="p-2.5 hover:bg-neutral-100 rounded-xl transition-colors border border-neutral-200">
            <Filter className="h-5 w-5 text-neutral-600" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
          {[
            { key: "all", label: "Todos", count: stats.total },
            { key: "scheduled", label: "Programados", count: stats.programados },
            { key: "available", label: "Disponibles", count: stats.disponibles },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key as FilterType)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                activeFilter === filter.key
                  ? "bg-red-600 text-white"
                  : "bg-white border border-neutral-300 text-neutral-700 hover:border-neutral-400"
              )}
            >
              {filter.label}
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  activeFilter === filter.key
                    ? "bg-red-500 text-white"
                    : "bg-neutral-100 text-neutral-600"
                )}
              >
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        {/* Truck List */}
        <div className="space-y-3 pb-24">
          {filteredCamiones.length === 0 ? (
            <div className="bg-neutral-50 rounded-2xl p-8 text-center border border-neutral-200">
              <Truck className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-900 font-semibold mb-1">
                No se encontraron vehículos
              </p>
              <p className="text-neutral-500 text-sm">
                {searchQuery
                  ? "Intenta con otra búsqueda"
                  : "No hay vehículos asignados"}
              </p>
            </div>
          ) : (
            filteredCamiones.map((camion) => (
              <div
                key={camion.id}
                onClick={() => handleSelectTruck(camion)}
                className="bg-white rounded-2xl p-4 border border-neutral-200 hover:border-red-300 hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  {/* Truck Icon */}
                  <div className="w-14 h-14 bg-neutral-900 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Truck className="h-7 w-7 text-red-500" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-neutral-900 truncate">
                        {camion.patente}
                      </h3>
                      {getEstadoBadge(camion.estado)}
                    </div>
                    <p className="text-sm text-neutral-600 truncate">
                      {camion.marca} {camion.modelo}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <span>Año: {camion.anio}</span>
                      <span>•</span>
                      <span className="truncate">{camion.empresa}</span>
                    </div>
                    {camion.estado === "programado" && camion.proximaInspeccion && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-yellow-600">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(camion.proximaInspeccion).toLocaleDateString("es-CL", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-neutral-400 flex-shrink-0" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FAB - Floating Action Button */}
      {filteredCamiones.length > 0 && (
        <button
          onClick={() => handleSelectTruck(filteredCamiones[0])}
          className="fixed bottom-24 right-4 w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg shadow-red-600/40 flex items-center justify-center transition-all active:scale-95 z-30"
          aria-label="Iniciar nueva inspección"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}