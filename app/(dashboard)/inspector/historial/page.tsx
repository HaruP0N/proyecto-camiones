"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Truck, Search, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils-cn";

interface InspeccionHistorial {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  empresa: string;
  fecha: string;
}

export default function HistorialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inspecciones, setInspecciones] = useState<InspeccionHistorial[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredInspecciones, setFilteredInspecciones] = useState<InspeccionHistorial[]>([]);

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setInspecciones([
        {
        {
          id: 1,
          patente: "BJFP-32",
          marca: "Volvo",
          modelo: "FH16",
          empresa: "Transportes ABC",
          fecha: "2024-01-28T10:30:00",
        },
        {
          id: 2,
          patente: "CKLM-45",
          marca: "Mercedes",
          modelo: "Actros",
          empresa: "Logística XYZ",
          fecha: "2024-01-27T14:15:00",
        },
        {
          id: 3,
          patente: "DFGH-78",
          marca: "Scania",
          modelo: "R500",
          empresa: "Transportes Norte",
          fecha: "2024-01-26T09:00:00",
        },
        {
          id: 4,
          patente: "WXYZ-12",
          marca: "DAF",
          modelo: "XF",
          empresa: "Carga Sur",
          fecha: "2024-01-25T16:45:00",
        },
      ]);
      setLoading(false);
    }, 600);
  }, []);

  useEffect(() => {
    let filtered = [...inspecciones];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.patente.toLowerCase().includes(query) ||
          i.marca.toLowerCase().includes(query) ||
          i.empresa.toLowerCase().includes(query)
      );
    }

    setFilteredInspecciones(filtered);
  }, [searchQuery, inspecciones]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner className="h-10 w-10 text-red-600" />
      </div>
    );
  }

  const stats = {
    total: inspecciones.length,
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-16 z-40">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-white mb-1">Historial</h1>
          <p className="text-sm text-neutral-400">
            Inspecciones realizadas
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-4">
        {/* Total Stats */}
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-neutral-400 mb-1">Total de inspecciones</p>
              <p className="text-4xl font-bold">{stats.total}</p>
            </div>
            <Truck className="h-12 w-12 text-neutral-400 opacity-50" />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar patente, marca o empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* List */}
        <div className="space-y-2">
          {filteredInspecciones.length === 0 ? (
            <div className="bg-neutral-50 rounded-2xl p-8 text-center border border-neutral-200">
              <Calendar className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-900 font-semibold mb-1">
                Sin inspecciones
              </p>
              <p className="text-neutral-500 text-sm">
                No hay inspecciones que coincidan con tu búsqueda
              </p>
            </div>
          ) : (
            filteredInspecciones.map((insp) =>
              <div
                key={insp.id}
                onClick={() =>
                  router.push(`/inspector/inspeccion/${insp.id}/reporte`)
                }
                className="bg-white rounded-xl p-4 border border-neutral-200 hover:border-red-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-neutral-900">
                        {insp.patente}
                      </p>
                    </div>
                    <p className="text-sm text-neutral-600">
                      {insp.marca} {insp.modelo}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(insp.fecha).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-neutral-400" />
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
