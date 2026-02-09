"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Camera } from "lucide-react";
import db from "@/lib/inspector/db";
import { PLANTILLAS } from "@/lib/inspector/inspection-items";
import { agregarACola } from "@/lib/inspector/sync";

export default function ResumenFirma() {
  const router = useRouter();
  const canvasRef = useRef(null);
  const photoUrlCache = useRef(new Map());
  const [inspeccion, setInspeccion] = useState(null);
  const [items, setItems] = useState([]);
  const [firmado, setFirmado] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasFirma, setHasFirma] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [fotosPorItem, setFotosPorItem] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return () => {
      photoUrlCache.current.forEach(url => URL.revokeObjectURL(url));
      photoUrlCache.current.clear();
    };
  }, []);

  async function loadData() {
    const insp = await db.inspecciones
      .where('estado_sincronizacion').equals('en_curso')
      .first();
    if (!insp) { router.push('/inspector/validacion-identidad'); return; }
    setInspeccion(insp);

    const itemsList = await db.items_inspeccion
      .where('inspeccion_id').equals(insp.id)
      .toArray();
    // Deduplicar por item_id: preferir el registro con veredicto_final definido, o el más reciente
    const byId = new Map();
    itemsList.sort((a, b) => (a.id || 0) - (b.id || 0)).forEach(item => {
      const prev = byId.get(item.item_id);
      if (!prev) {
        byId.set(item.item_id, item);
        return;
      }
      const prevFinal = prev.veredicto_final !== null && prev.veredicto_final !== undefined;
      const curFinal = item.veredicto_final !== null && item.veredicto_final !== undefined;
      if (curFinal && !prevFinal) {
        byId.set(item.item_id, item);
      } else if (!prevFinal && !curFinal) {
        byId.set(item.item_id, item);
      } else if (curFinal && prevFinal) {
        byId.set(item.item_id, item);
      }
    });
    const dedup = Array.from(byId.values());
    setItems(dedup);

    const fotos = await db.fotos
      .where('inspeccion_id')
      .equals(insp.id)
      .filter(f => !f.reemplazada)
      .toArray();
    const map = {};
    fotos.forEach(f => {
      const key = f.item_inspeccion_id || f.tipo || 'general';
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    setFotosPorItem(map);
  }

  const aprobados = items.filter(i => (i.veredicto_final || i.veredicto_inspector) === 'APROBADO').length;
  const rechazados = items.filter(i => (i.veredicto_final || i.veredicto_inspector) === 'RECHAZADO').length;
  const total = items.length;
  const resultadoFinal = rechazados > 0 ? 'RECHAZADO' : 'APROBADO';

  // Canvas firma
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasFirma(true);
  };

  const endDraw = (e) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const limpiarFirma = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasFirma(false);
  };

  const handleFinalizar = async () => {
    if (!hasFirma || !inspeccion) return;

    const canvas = canvasRef.current;
    const firmaDataUrl = canvas.toDataURL('image/png');

    await db.inspecciones.update(inspeccion.id, {
      estado_sincronizacion: 'pendiente_sync',
      resultado_final: resultadoFinal,
      timestamp_fin: new Date().toISOString(),
      firma_blob: null,
      firma_data_url: firmaDataUrl
    });

    await agregarACola("inspeccion_completa", { inspeccionId: inspeccion.id });

    setFirmado(true);
  };

  const handleCancelar = async () => {
    if (!inspeccion) return;
    await db.inspecciones.update(inspeccion.id, {
      estado_sincronizacion: 'cancelada',
      resultado_final: 'CANCELADA',
      timestamp_fin: new Date().toISOString()
    });
    localStorage.removeItem('inspeccion_actual_id');
    localStorage.removeItem('patente_validada');
    localStorage.removeItem('patente_sistema');
    localStorage.removeItem('tipo_camion');
    localStorage.removeItem('carroceria_camion');
    router.push('/inspector');
  };

  const handleNuevaInspeccion = () => {
    localStorage.removeItem('inspeccion_actual_id');
    localStorage.removeItem('patente_validada');
    localStorage.removeItem('patente_sistema');
    localStorage.removeItem('tipo_camion');
    localStorage.removeItem('carroceria_camion');
    router.push('/inspector');
  };

  const getFotoUrl = (foto) => {
    if (foto.url_remota) return foto.url_remota;
    if (foto.data_url) return foto.data_url;
    if (!foto.blob) return '';
    const cached = photoUrlCache.current.get(foto.id);
    if (cached) return cached;
    const url = URL.createObjectURL(foto.blob);
    photoUrlCache.current.set(foto.id, url);
    return url;
  };

  const itemLabelMap = (() => {
    const map = new Map();
    Object.values(PLANTILLAS).forEach(tpl => {
      Object.values(tpl).forEach(cat => {
        cat.forEach(item => {
          map.set(item.id, item.nombre);
        });
      });
    });
    return map;
  })();

  if (firmado) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50"
      >
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-6 ${
          resultadoFinal === 'APROBADO' ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {resultadoFinal === 'APROBADO' ? '✓' : '✗'}
        </div>
        <h1 className="text-2xl font-bold mb-2">Inspección Realizada</h1>
        <p className={`text-lg font-bold mb-1 ${
          resultadoFinal === 'APROBADO' ? 'text-[var(--color-exito)]' : 'text-[var(--color-error)]'
        }`}>
          {resultadoFinal}
        </p>
        <p className="text-sm text-gray-500 mb-2">
          Patente: {inspeccion?.patente_sistema}
        </p>
        <p className="text-xs text-gray-400 mb-8">
          {navigator.onLine ? 'Sincronizado' : 'Pendiente de sincronización'}
        </p>
        <button
          onClick={handleNuevaInspeccion}
          className="w-full max-w-xs py-4 rounded-2xl bg-[#7f1d1d] text-white font-bold text-base shadow-lg shadow-red-200"
        >
          Volver al inicio
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, duration: 0.3 }}
      className="min-h-screen bg-gray-50 pb-28 font-sans"
    >
      <div className="relative overflow-hidden px-6 pt-12 pb-8 bg-gradient-to-br from-gray-900 via-red-950 to-black">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.4),transparent)] pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-white text-2xl font-bold">Resumen de Inspección</h1>
          <p className="text-white/70 text-sm mt-1">Revise y firme para finalizar</p>
        </div>
      </div>

      <div className="px-6 -mt-6 space-y-5">
        {/* Estadísticas */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-24 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-gray-800 leading-none">{total}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Total</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-24 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-green-600 leading-none">{aprobados}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Aprobados</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-24 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-red-600 leading-none">{rechazados}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Rechazados</span>
          </div>
        </div>

        {/* Detalle items */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Detalle de ítems</h3>
          <div className="space-y-3">
            {items.map(item => {
              const label = itemLabelMap.get(item.item_id) || item.item_id;
              const veredicto = item.veredicto_final || item.veredicto_inspector || 'Pendiente';
              const isOpen = !!expanded[item.id];
              const fotos = fotosPorItem[item.id] || fotosPorItem[item.item_id] || [];
              return (
                <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex-1 pr-3">
                      <p className="text-sm font-semibold text-gray-800">{label}</p>
                      <p className="text-[11px] text-gray-400">Ver detalles</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                        veredicto === 'APROBADO'
                          ? 'bg-green-100 text-green-700'
                          : veredicto === 'RECHAZADO'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-200 text-gray-600'
                      }`}>
                        {veredicto}
                      </span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className="pt-3 border-t border-gray-200 space-y-3">
                        <div>
                          <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Observaciones</p>
                          <p className="text-sm text-gray-700">
                            {item.observaciones ? item.observaciones : 'Sin observaciones'}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                            <Camera className="w-4 h-4" /> Evidencias
                          </p>
                          {fotos.length === 0 ? (
                            <p className="text-sm text-gray-400">Sin fotos registradas</p>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {fotos.map(f => (
                                <img
                                  key={f.id}
                                  src={getFotoUrl(f)}
                                  alt="Evidencia"
                                  className="w-full h-20 object-cover rounded-xl border border-gray-200"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Firma */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold mb-2">Firma del Inspector <span className="text-red-500">*</span></h3>
          <div className="border-2 border-gray-300 rounded-2xl overflow-hidden bg-gray-50 relative">
            <canvas
              ref={canvasRef}
              className="w-full h-40 touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {!hasFirma && (
              <p className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm pointer-events-none">
                Firme aquí
              </p>
            )}
          </div>
          <button
            onClick={limpiarFirma}
            className="text-xs text-gray-500 mt-2 underline"
          >
            Limpiar firma
          </button>
        </div>
      </div>

      {/* Botón finalizar */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex gap-3">
          <button
            onClick={handleCancelar}
            className="flex-1 py-4 rounded-2xl text-sm font-bold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleFinalizar}
            disabled={!hasFirma}
            className={`flex-[2] py-4 rounded-2xl text-base font-bold transition-all ${
              hasFirma
                ? 'bg-[#7f1d1d] text-white shadow-lg hover:bg-red-900'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Enviar Inspección
          </button>
        </div>
      </div>
    </motion.div>
  );
}
