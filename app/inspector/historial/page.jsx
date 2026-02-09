"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  ChevronRight,
  CheckCircle2,
  XCircle,
  FileText,
  ChevronLeft,
  Clock,
  User,
  MapPin,
  Truck,
  Filter,
} from "lucide-react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react";
import db from "@/lib/inspector/db";

const PERIODOS = [
  { id: 'hoy', label: 'Hoy', days: 0 },
  { id: 'semana', label: 'Semana', days: 7 },
  { id: 'mes', label: 'Mes', days: 30 },
  { id: 'todo', label: 'Todo', days: null }
];

const ESTADOS = [
  { id: 'todas', label: 'Todas' },
  { id: "completada", label: "Completadas" },
  { id: "pendiente", label: "Pendiente Sync" },
];

const normalize = (v) => (v || '').toString().toLowerCase().trim();

const toDateKey = (fecha) => {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const labelFecha = (fecha) => {
  const d = new Date(fecha);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });
};

const formatearFechaHora = (fecha) => {
  if (!fecha) return '--:--';
  const d = new Date(fecha);
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
};

const tipoLabel = (insp) => {
  if (insp.carroceria) return insp.carroceria.replace(/_/g, ' ');
  if (insp.tipo) return insp.tipo.replace(/_/g, ' ');
  return 'general';
};

export default function HistorialInspecciones() {
  const router = useRouter();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [inspecciones, setInspecciones] = useState([]);
  const [inspeccionSeleccionada, setInspeccionSeleccionada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [estado, setEstado] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');

  useEffect(() => {
    cargarInspecciones();
  }, []);

  async function cargarInspecciones() {
    setLoading(true);
    try {
      const list = await db.inspecciones
        .where('estado_sincronizacion')
        .anyOf(['pendiente_sync', 'sincronizado', 'cancelada', 'en_curso'])
        .reverse()
        .sortBy('fecha_hora_inicio');
      const lastErr = (globalThis).__petranSyncLastError;
      if (lastErr) {
        console.warn('[Sync] Último error de sincronización:', lastErr);
      }
      setInspecciones(list || []);
    } catch (error) {
      console.error('Error cargando inspecciones:', error);
    } finally {
      setLoading(false);
    }
  }

  async function cargarDetalles(inspeccion) {
    try {
      const items = await db.items_inspeccion
        .where('inspeccion_id')
        .equals(inspeccion.id)
        .toArray();

      const fotos = await db.fotos
        .where('inspeccion_id')
        .equals(inspeccion.id)
        .filter(f => !f.reemplazada)
        .toArray();

      const aprobados = items.filter(i => (i.veredicto_final || i.veredicto_inspector) === 'APROBADO').length;
      const rechazados = items.filter(i => (i.veredicto_final || i.veredicto_inspector) === 'RECHAZADO').length;

      setInspeccionSeleccionada({
        ...inspeccion,
        items,
        fotos,
        aprobados,
        rechazados,
        itemsConFotos: fotos.length
      });
      onOpen();
    } catch (error) {
      console.error('Error cargando detalles:', error);
    }
  }

  const tiposDisponibles = useMemo(() => {
    const set = new Set();
    inspecciones.forEach(i => set.add(tipoLabel(i)));
    return Array.from(set).filter(Boolean);
  }, [inspecciones]);

  const filtradas = useMemo(() => {
    const ahora = new Date();
    const filtroPeriodo = PERIODOS.find(p => p.id === periodo);
    return inspecciones.filter(insp => {
      const fecha = insp.fecha_hora_inicio || insp.timestamp_inicio || insp.fecha_programada || new Date().toISOString();
      const fechaInsp = new Date(fecha);
      const diffDias = Math.floor((ahora - fechaInsp) / (1000 * 60 * 60 * 24));
      if (filtroPeriodo?.days !== null && filtroPeriodo?.days !== undefined) {
        if (filtroPeriodo.days === 0 && diffDias !== 0) return false;
        if (filtroPeriodo.days > 0 && diffDias > filtroPeriodo.days) return false;
      }

      if (estado !== 'todas') {
        if (estado === 'completada' && insp.estado_sincronizacion !== 'sincronizado') return false;
        if (estado === 'pendiente' && insp.estado_sincronizacion === 'sincronizado') return false;
      }

      if (tipoFiltro !== 'todos') {
        if (normalize(tipoLabel(insp)) !== normalize(tipoFiltro)) return false;
      }

      const q = normalize(busqueda);
      if (q) {
        return normalize(insp.patente).includes(q) || normalize(insp.nombre_cliente).includes(q);
      }
      return true;
    });
  }, [inspecciones, periodo, estado, tipoFiltro, busqueda]);

  const grupos = useMemo(() => {
    const map = new Map();
    filtradas.forEach(insp => {
      const fecha = insp.fecha_hora_inicio || insp.timestamp_inicio || insp.fecha_programada || new Date().toISOString();
      const key = toDateKey(fecha);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ ...insp, _fecha: fecha });
    });
    const orden = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return orden.map(key => ({
      key,
      label: labelFecha(key),
      items: map.get(key)
    }));
  }, [filtradas]);

  const completadas = filtradas.filter(i => i.estado_sincronizacion === "sincronizado").length;
  const pendientesSinc = filtradas.filter(i => i.estado_sincronizacion !== "sincronizado").length;
  const total = filtradas.length;

  return (
    <div className="min-h-screen bg-gray-50 pb-28 font-sans">
      {/* HEADER */}
      <div className="relative overflow-hidden px-6 pt-10 pb-10 bg-gradient-to-br from-gray-900 via-red-950 to-black">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,#FF0000,transparent)] pointer-events-none" />
        <div className="relative z-10">
          <button 
            onClick={() => router.push('/inspector')}
            className="mb-4 flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver
          </button>

          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-red-200 text-xs font-bold uppercase tracking-wider">Mis Inspecciones</p>
              <h1 className="text-white text-2xl font-bold">Historial</h1>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1 rounded-full">
              <span className="text-white text-xs font-bold">{total} inspecciones</span>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-white/60 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar patente o cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm text-white placeholder-white/60 focus:bg-white/20 outline-none"
            />
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="px-6 -mt-5 relative z-20">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
            <Filter className="w-4 h-4" /> Filtros
          </div>

          <div className="flex flex-wrap gap-2">
            {PERIODOS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-all ${
                  periodo === p.id 
                    ? 'bg-[#7f1d1d] text-white shadow-md' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {ESTADOS.map(e => (
              <button
                key={e.id}
                onClick={() => setEstado(e.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-all ${
                  estado === e.id
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500 uppercase">Tipo</span>
            <select
              className="flex-1 h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700"
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
            >
              <option value="todos">Todos</option>
              {tiposDisponibles.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-6 mt-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-24 flex flex-col items-center justify-center text-center">
            <div className="text-green-500 mb-1">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-xl font-black text-gray-800 leading-none">{completadas}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Completadas</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-24 flex flex-col items-center justify-center text-center">
            <div className="text-[#7f1d1d] mb-1">
              <FileText size={20} />
            </div>
            <span className="text-xl font-black text-gray-800 leading-none">{total}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Total</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-24 flex flex-col items-center justify-center text-center">
            <div className="text-orange-500 mb-1">
              <Clock size={20} />
            </div>
            <span className="text-xl font-black text-gray-800 leading-none">{pendientesSinc}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Pendientes</span>
          </div>
        </div>
      </div>

      {/* LISTA AGRUPADA */}
      <div className="px-6 mt-8 space-y-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
            <p className="text-gray-500 text-sm mt-3">Cargando...</p>
          </div>
        ) : grupos.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {busqueda ? 'No se encontraron inspecciones' : 'No hay inspecciones en este período'}
            </p>
          </div>
        ) : (
          grupos.map((grupo) => (
            <div key={grupo.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{grupo.label}</h3>
                <span className="text-xs text-gray-400">{grupo.items.length} inspecciones</span>
              </div>

              <div className="space-y-3">
                {grupo.items.map((item, idx) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <div
                      onClick={() => cargarDetalles(item)}
                      className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer p-4"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <h4 className="text-base font-bold text-gray-900">{item.patente || 'Sin patente'}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{item.nombre_cliente || 'Sin cliente'}</p>
                          <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1">
                            <Truck size={12} />
                            <span>{tipoLabel(item)}</span>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                          item.estado_sincronizacion === 'sincronizado'
                            ? 'bg-green-50 text-green-700 border border-green-100'
                            : 'bg-orange-50 text-orange-700 border border-orange-100'
                        }`}>
                          {item.estado_sincronizacion === 'sincronizado' ? 'COMPLETADA' : 'PENDIENTE SYNC'}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-3">
                        <span className="text-xs text-gray-400 flex items-center gap-1 font-medium">
                          <Clock size={12} /> {formatearFechaHora(item.fecha_hora_inicio || item.timestamp_inicio)}
                        </span>
                        <ChevronRight className="text-gray-300 w-5 h-5" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DE DETALLES */}
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="bottom"
        backdrop="blur"
        scrollBehavior="inside"
        classNames={{
          base: 'm-0 rounded-t-[2rem] sm:rounded-lg mb-0'
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="pt-8 px-6 pb-2">
                <div className="w-full">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Detalle de Inspección
                  </div>
                  <div className="text-3xl font-black text-gray-900">
                    {inspeccionSeleccionada?.patente || 'Sin patente'}
                  </div>
                </div>
              </ModalHeader>

              <ModalBody className="px-6 py-4">
                {inspeccionSeleccionada && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
                      <DetailRow 
                        label="Cliente" 
                        value={inspeccionSeleccionada.nombre_cliente || 'N/A'} 
                        icon={<User size={16} />} 
                      />
                      <DetailRow 
                        label="Ubicación" 
                        value={inspeccionSeleccionada.ubicacion || 'N/A'} 
                        icon={<MapPin size={16} />} 
                      />
                      <DetailRow 
                        label="Fecha/Hora" 
                        value={formatearFechaHora(inspeccionSeleccionada.fecha_hora_inicio || inspeccionSeleccionada.timestamp_inicio)} 
                        icon={<Clock size={16} />} 
                      />
                      <DetailRow 
                        label="Estado" 
                        value={inspeccionSeleccionada.estado_sincronizacion === 'sincronizado' ? 'Completada' : 'Pendiente Sincronización'} 
                        icon={<CheckCircle2 size={16} />} 
                      />
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-4">
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Resultados de Inspección</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="text-green-500 mb-1 flex justify-center">
                            <CheckCircle2 size={20} />
                          </div>
                          <p className="text-xl font-black text-gray-800">{inspeccionSeleccionada.aprobados}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold">Aprobados</p>
                        </div>
                        <div className="text-center">
                          <div className="text-red-500 mb-1 flex justify-center">
                            <XCircle size={20} />
                          </div>
                          <p className="text-xl font-black text-gray-800">{inspeccionSeleccionada.rechazados}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold">Rechazados</p>
                        </div>
                        <div className="text-center">
                          <div className="text-blue-500 mb-1 flex justify-center">
                            <FileText size={20} />
                          </div>
                          <p className="text-xl font-black text-gray-800">{inspeccionSeleccionada.itemsConFotos}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold">Fotos</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </ModalBody>

              <ModalFooter className="px-6 pb-6">
                <button
                  onClick={onClose}
                  className="w-full h-12 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

function DetailRow({ label, value, icon }) {
  return (
    <div className="flex justify-between items-center border-b border-gray-100 last:border-0 pb-2 last:pb-0">
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-sm font-bold text-gray-800">{value}</span>
    </div>
  );
}
