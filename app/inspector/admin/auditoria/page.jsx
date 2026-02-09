"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import db from "@/lib/inspector/db";

export default function AdminAuditoria() {
  const [inspecciones, setInspecciones] = useState([]);
  const [selectedInspeccion, setSelectedInspeccion] = useState(null);
  const [items, setItems] = useState([]);
  const [modalItem, setModalItem] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [errorJustificacion, setErrorJustificacion] = useState('');
  const [fotoModal, setFotoModal] = useState(null);
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    loadInspecciones();
  }, []);

  async function loadInspecciones() {
    const all = await db.inspecciones.toArray();
    setInspecciones(all);
  }

  async function selectInspeccion(insp) {
    setSelectedInspeccion(insp);
    const itemsList = await db.items_inspeccion
      .where('inspeccion_id').equals(insp.id)
      .toArray();

    const itemsConFotos = await Promise.all(itemsList.map(async (item) => {
      const fotos = await db.fotos
        .where('item_inspeccion_id').equals(item.id)
        .filter(f => !f.reemplazada)
        .toArray();
      const hist = await db.historial_cambios
        .where('item_inspeccion_id').equals(item.id)
        .toArray();
      return { ...item, fotos, historial: hist };
    }));

    setItems(itemsConFotos);
  }

  const handleSobreescribir = (item) => {
    setModalItem(item);
    setNuevoEstado('');
    setJustificacion('');
    setErrorJustificacion('');
  };

  const confirmarSobreescritura = async () => {
    if (!justificacion || justificacion.length < 20) {
      setErrorJustificacion('Justificación obligatoria (mínimo 20 caracteres)');
      return;
    }
    if (!nuevoEstado) {
      setErrorJustificacion('Seleccione un nuevo estado');
      return;
    }

    await db.historial_cambios.add({
      item_inspeccion_id: modalItem.id,
      timestamp: new Date().toISOString(),
      usuario_id: 'admin-actual',
      accion: 'sobreescritura',
      estado_anterior: modalItem.veredicto_inspector,
      estado_nuevo: nuevoEstado,
      justificacion
    });

    await db.items_inspeccion.update(modalItem.id, {
      veredicto_final: nuevoEstado,
      sobreescrito_por_admin: true,
      admin_id: 'admin-actual'
    });

    setModalItem(null);
    if (selectedInspeccion) selectInspeccion(selectedInspeccion);
  };

  const verFoto = async (foto) => {
    const url = foto.url_remota || foto.data_url || (foto.blob ? URL.createObjectURL(foto.blob) : '');
    setFotoModal({ url, metadata: foto.metadata });
  };

  const verHistorial = async (item) => {
    const hist = await db.historial_cambios
      .where('item_inspeccion_id').equals(item.id)
      .toArray();
    setHistorial(hist);
  };

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, duration: 0.3 }}
      className="min-h-screen bg-gray-50 pb-20"
    >
      <div className="bg-gray-900 text-white px-5 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-xl font-bold">Auditoría</h1>
        <p className="text-sm opacity-70 mt-1">Panel de administración</p>
      </div>

      <div className="px-4 py-4">
        {!selectedInspeccion ? (
          <>
            <h2 className="text-sm font-semibold mb-3">Inspecciones registradas</h2>
            {inspecciones.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-sm">No hay inspecciones registradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inspecciones.map(insp => (
                  <button
                    key={insp.id}
                    onClick={() => selectInspeccion(insp)}
                    className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">Patente: {insp.patente_sistema}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(insp.timestamp_inicio).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {insp.flag_discrepancia && (
                          <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            DISCREPANCIA
                          </span>
                        )}
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          insp.resultado_final === 'APROBADO'
                            ? 'bg-green-100 text-green-700'
                            : insp.resultado_final === 'RECHAZADO'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {insp.resultado_final || 'EN CURSO'}
                        </span>
                        <span className="text-gray-300">→</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setSelectedInspeccion(null)}
              className="text-sm text-gray-500 mb-4 flex items-center gap-1"
            >
              ← Volver a lista
            </button>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
              <p className="font-bold">Patente: {selectedInspeccion.patente_sistema}</p>
              {selectedInspeccion.patente_real && (
                <p className="text-sm text-red-600 mt-1">
                  Patente real observada: {selectedInspeccion.patente_real}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(selectedInspeccion.timestamp_inicio).toLocaleString()}
              </p>
            </div>

            <h2 className="text-sm font-semibold mb-3">Ítems de inspección</h2>
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="grid grid-cols-[80px_1fr_auto] gap-3 p-3 items-center">
                    {/* Columna izquierda: miniatura */}
                    <div>
                      {item.fotos && item.fotos.length > 0 ? (
                        <button
                          onClick={() => verFoto(item.fotos[0])}
                          className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100"
                        >
                          {item.fotos[0].thumbnail_blob ? (
                            <img
                              src={URL.createObjectURL(item.fotos[0].thumbnail_blob)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">📷</div>
                          )}
                        </button>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
                          Sin foto
                        </div>
                      )}
                    </div>

                    {/* Columna centro: veredicto */}
                    <div>
                      <p className="text-xs font-medium text-gray-600">{item.item_id}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                          item.veredicto_final === 'APROBADO'
                            ? 'bg-green-100 text-green-700'
                            : item.veredicto_final === 'RECHAZADO'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {item.veredicto_final || 'PENDIENTE'}
                        </span>
                        {item.sobreescrito_por_admin && (
                          <span className="text-[10px] text-orange-500 font-semibold">CORREGIDO</span>
                        )}
                      </div>
                    </div>

                    {/* Columna derecha: controles */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleSobreescribir(item)}
                        className="text-[10px] bg-gray-900 text-white px-3 py-1.5 rounded-lg font-semibold"
                      >
                        Corregir
                      </button>
                      <button
                        onClick={() => verHistorial(item)}
                        className="text-[10px] bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-semibold"
                      >
                        Historial
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal sobreescritura */}
      <AnimatePresence>
        {modalItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setModalItem(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white w-full rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-base font-bold mb-4">Corregir Veredicto</h3>
              <p className="text-xs text-gray-500 mb-3">Ítem: {modalItem.item_id}</p>
              <p className="text-xs text-gray-500 mb-4">
                Estado actual: <span className="font-bold">{modalItem.veredicto_inspector}</span>
              </p>

              <div className="space-y-2 mb-4">
                {['APROBADO', 'RECHAZADO', 'RE-INSPECCIÓN'].map(estado => (
                  <button
                    key={estado}
                    onClick={() => setNuevoEstado(estado)}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                      nuevoEstado === estado
                        ? estado === 'APROBADO'
                          ? 'bg-green-500 text-white'
                          : estado === 'RECHAZADO'
                            ? 'bg-red-500 text-white'
                            : 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {estado === 'APROBADO' ? '✓ ' : estado === 'RECHAZADO' ? '✗ ' : '↻ '}{estado}
                  </button>
                ))}
              </div>

              <textarea
                value={justificacion}
                onChange={e => { setJustificacion(e.target.value); setErrorJustificacion(''); }}
                placeholder="Justificación (mínimo 20 caracteres)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <p className="text-[10px] text-gray-400 mt-1 text-right">{justificacion.length}/20 caracteres mínimos</p>
              {errorJustificacion && (
                <p className="text-xs text-red-500 mt-1">{errorJustificacion}</p>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setModalItem(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarSobreescritura}
                  className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-bold text-sm"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal foto fullscreen */}
      <AnimatePresence>
        {fotoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex flex-col"
            onClick={() => { URL.revokeObjectURL(fotoModal.url); setFotoModal(null); }}
          >
            <div className="flex-1 flex items-center justify-center p-4">
              <img src={fotoModal.url} alt="Evidencia" className="max-w-full max-h-full object-contain rounded-xl" />
            </div>
            {fotoModal.metadata && (
              <div className="bg-black/80 text-white p-4 text-xs space-y-1">
                <p>Timestamp: {fotoModal.metadata.timestamp}</p>
                <p>GPS: {fotoModal.metadata.gps_coords?.lat}, {fotoModal.metadata.gps_coords?.long}</p>
                <p>Precisión GPS: {fotoModal.metadata.gps_coords?.accuracy}m</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal historial */}
      <AnimatePresence>
        {historial.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setHistorial([])}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full rounded-t-3xl p-5 max-h-[60vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-base font-bold mb-4">Historial de Cambios</h3>
              <div className="space-y-3">
                {historial.map((h, idx) => (
                  <div key={idx} className="border-l-2 border-gray-300 pl-3 py-1">
                    <p className="text-[10px] text-gray-400">{new Date(h.timestamp).toLocaleString()}</p>
                    <p className="text-xs font-medium">
                      {h.estado_anterior} → <span className="font-bold">{h.estado_nuevo}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{h.justificacion}</p>
                    <p className="text-[10px] text-gray-400">Por: {h.usuario_id}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setHistorial([])}
                className="w-full mt-4 py-3 rounded-xl bg-gray-100 text-sm font-semibold"
              >
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
