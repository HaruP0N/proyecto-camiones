"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import {
  Truck,
  Search,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  MapPin,
  Calendar,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils-cn";

// Tipos adaptados a tu API real
interface CamionDashboard {
  id: number;        // ID de la inspección
  camionId: number;  // ID DEL CAMIÓN (Importante para la ruta)
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  empresa: string;
  estado: "disponible" | "en_inspeccion" | "programado" | "finalizado";
  fechaProgramada: string;
  resultado?: string | null;
}

interface InspectorProfile {
  id: string;
  nombre: string;
  email: string;
}

type FilterType = "all" | "pending" | "completed";

export default function InspectorDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [items, setItems] = useState<CamionDashboard[]>([]);
  const [filteredItems, setFilteredItems] = useState<CamionDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [inspector, setInspector] = useState<InspectorProfile | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterItems();
  }, [searchQuery, activeFilter, items]);

  async function fetchData() {
    try {
      setLoading(true);
      
      // 1. Obtener datos del inspector
      fetch("/api/inspector/me")
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (data) setInspector(data);
        })
        .catch(() => console.log("No session info"));

      // 2. Obtener inspecciones de HOY
      const res = await fetch("/api/inspector/inspecciones/hoy");
      if (!res.ok) throw new Error("Error al cargar agenda");

      const payload = await res.json();
      const rawData = Array.isArray(payload.data) ? payload.data : [];

      // Mapear datos
      const dashboardData: CamionDashboard[] = rawData.map((insp: any) => {
        let estado: CamionDashboard["estado"] = "programado";
        
        // Lógica de estados
        if (insp.resultado_general && insp.resultado_general !== "PENDIENTE") {
            estado = "finalizado";
        } else if (insp.estado === "EN_PROGRESO") {
            estado = "en_inspeccion";
        }

        return {
          id: insp.id,
          camionId: insp.camion_id, // ✅ Guardamos el ID del camión para la ruta
          patente: insp.patente || "S/P",
          marca: insp.marca || "Camión",
          modelo: insp.modelo || "Genérico",
          anio: insp.anio || new Date().getFullYear(),
          empresa: insp.empresa_nombre || "Empresa Cliente",
          estado,
          fechaProgramada: insp.fecha_programada,
          resultado: insp.resultado_general
        };
      });

      setItems(dashboardData);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error de conexión",
        description: "No pudimos cargar tu agenda de hoy.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function filterItems() {
    let filtered = [...items];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.patente.toLowerCase().includes(q) ||
          c.marca.toLowerCase().includes(q) ||
          c.modelo.toLowerCase().includes(q) ||
          c.empresa.toLowerCase().includes(q)
      );
    }

    if (activeFilter === "pending") {
        filtered = filtered.filter(c => c.estado === "programado" || c.estado === "en_inspeccion");
    } else if (activeFilter === "completed") {
        filtered = filtered.filter(c => c.estado === "finalizado");
    }

    setFilteredItems(filtered);
  }

  // ✅ CORRECCIÓN DE RUTAS DE NAVEGACIÓN
  const handleCardClick = (item: CamionDashboard) => {
    if (item.estado === "finalizado") {
        // Si está finalizada, ir al reporte o historial
        // Ruta sugerida: ver reporte de ese camión
        router.push(`/inspector/inspeccion/${item.camionId}/reporte`);
    } else if (item.estado === "en_inspeccion") {
        // Si ya está iniciada ("en_inspeccion"), ir directo a la activa
        router.push(`/inspector/inspeccion/${item.camionId}/activa`);
    } else {
        // Si está pendiente ("programado"), ir a la pre-inspección
        router.push(`/inspector/inspeccion/${item.camionId}`);
    }
  };

  const getEstadoBadge = (estado: string, resultado?: string | null) => {
    if (estado === "finalizado") {
        const colorClass = resultado === "APROBADO" ? "bg-green-100 text-green-700 border-green-200" 
                         : resultado === "RECHAZADO" ? "bg-red-100 text-red-700 border-red-200"
                         : "bg-gray-100 text-gray-700 border-gray-200";
        return (
            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border", colorClass)}>
              <CheckCircle className="h-3 w-3" /> {resultado || "Finalizado"}
            </span>
        );
    }
    if (estado === "en_inspeccion") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
              <AlertTriangle className="h-3 w-3" /> En Progreso
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
          <Clock className="h-3 w-3" /> Pendiente
        </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Spinner className="h-10 w-10 text-slate-900" />
        <p className="text-slate-500 animate-pulse">Sincronizando agenda...</p>
      </div>
    );
  }

  const stats = {
    all: items.length,
    pending: items.filter(i => i.estado === "programado" || i.estado === "en_inspeccion").length,
    completed: items.filter(i => i.estado === "finalizado").length
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header Sticky */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
           <div>
               <h1 className="text-xl font-bold text-slate-900">Agenda de Hoy</h1>
               <p className="text-xs text-slate-500 font-medium">
                  {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
               </p>
           </div>
           <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm">
              {inspector?.nombre ? inspector.nombre.charAt(0).toUpperCase() : "I"}
           </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        
        {/* Buscador */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Buscar patente, empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent shadow-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filtros Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
           <button
             onClick={() => setActiveFilter("all")}
             className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2", 
                activeFilter === "all" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200")}
           >
             Todos <span className={cn("px-1.5 py-0.5 rounded text-[10px]", activeFilter === "all" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-600")}>{stats.all}</span>
           </button>
           <button
             onClick={() => setActiveFilter("pending")}
             className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2", 
                activeFilter === "pending" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200")}
           >
             Pendientes <span className={cn("px-1.5 py-0.5 rounded text-[10px]", activeFilter === "pending" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-600")}>{stats.pending}</span>
           </button>
           <button
             onClick={() => setActiveFilter("completed")}
             className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2", 
                activeFilter === "completed" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200")}
           >
             Finalizados <span className={cn("px-1.5 py-0.5 rounded text-[10px]", activeFilter === "completed" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-600")}>{stats.completed}</span>
           </button>
        </div>

        {/* Lista de Tarjetas */}
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
               <div className="bg-white h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                  <Truck className="h-10 w-10 text-slate-300" />
               </div>
               <h3 className="text-slate-900 font-bold text-lg">Sin resultados</h3>
               <p className="text-slate-500 text-sm">No hay inspecciones que coincidan con tu búsqueda.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)} // ✅ Se llama a la función corregida
                className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group active:scale-[0.99]"
              >
                <div className="flex items-start gap-4">
                  <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors", 
                      item.estado === "finalizado" ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white")}>
                     <Truck className="h-6 w-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start">
                        <div>
                           <h3 className="font-bold text-slate-900 text-lg leading-tight">{item.patente}</h3>
                           <p className="text-sm text-slate-500 font-medium truncate">{item.marca} {item.modelo}</p>
                        </div>
                        {getEstadoBadge(item.estado, item.resultado)}
                     </div>
                     
                     <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                           <Calendar className="h-3.5 w-3.5" /> {new Date(item.fechaProgramada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        <span className="flex items-center gap-1 truncate max-w-[150px]">
                           <MapPin className="h-3.5 w-3.5" /> {item.empresa}
                        </span>
                     </div>
                  </div>
                  
                  <div className="self-center pl-2">
                     <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-900" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* FAB: Botón flotante para iniciar escaneo rápido (opcional) */}
      <button
         onClick={() => router.push('/inspector/scanner')} // Si tienes ruta de escáner QR
         className="fixed bottom-6 right-6 w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg shadow-red-600/40 flex items-center justify-center transition-all active:scale-95 z-30"
         aria-label="Escanear Patente"
      >
         <Plus className="h-6 w-6" />
      </button>

    </div>
  );
}