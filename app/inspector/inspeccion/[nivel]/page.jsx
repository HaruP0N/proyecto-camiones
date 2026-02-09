"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  AlertCircle,
  ChevronLeft,
  Camera,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils-cn";
import PhotoCapture from "@/components/inspector/PhotoCapture";
import Stepper from "@/components/inspector/Stepper";
import { CATEGORIAS, getItemsPorCategoria, inferPlantilla } from "@/lib/inspector/inspection-items";
import db from "@/lib/inspector/db";


const CATEGORIA_POR_RUTA = {
  criticos: 'cat_criticos',
  operacion: 'cat_operacion',
  seguridad: 'cat_seguridad_cabina'
};


// ========== COMPONENTE INSPECTION ITEM ==========
function InspectionItem({ item, inspeccionId, categoriaId, onItemComplete }) {
  // ✅ VALIDACIÓN
  if (!item) {
    console.error('InspectionItem: item is undefined');
    return null;
  }

  const [veredicto, setVeredicto] = useState(null);
  const [fotosCaptured, setFotosCaptured] = useState([]);
  const [itemDbId, setItemDbId] = useState(null);
  const [observaciones, setObservaciones] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [editMode, setEditMode] = useState(false);


  useEffect(() => {
    if (inspeccionId) {
      loadOrCreateItem();
    }
  }, [inspeccionId]);


  async function loadOrCreateItem() {
    const existing = await db.items_inspeccion
      .where({ inspeccion_id: inspeccionId, item_id: item.id })
      .first();

    if (existing) {
      setItemDbId(existing.id);
      setVeredicto(existing.veredicto_inspector || existing.veredicto_final || null);
      setObservaciones(existing.observaciones || '');
      setIsConfirmed(!!existing.veredicto_final);
      
      const fotos = await db.fotos
        .where({ item_inspeccion_id: existing.id })
        .filter(f => !f.reemplazada)
        .toArray();
      
      setFotosCaptured(fotos);
      
      if (existing.veredicto_inspector && !existing.veredicto_final) {
        setIsExpanded(true);
      }
    } else {
      const id = await db.items_inspeccion.add({
        inspeccion_id: inspeccionId,
        categoria_id: categoriaId,
        item_id: item.id,
        veredicto_inspector: null,
        veredicto_final: null,
        sobreescrito_por_admin: false,
        observaciones: ''
      });
      setItemDbId(id);
    }
  }


  const handleVeredicto = async (valor) => {
    setVeredicto(valor);
    setIsExpanded(true);
    setIsConfirmed(false);
    
    if (itemDbId) {
      await db.items_inspeccion.update(itemDbId, {
        veredicto_inspector: valor,
        veredicto_final: null
      });
    }
  };


  const handlePhotoCaptured = async () => {
    const fotos = await db.fotos
      .where({ item_inspeccion_id: itemDbId })
      .filter(f => !f.reemplazada)
      .toArray();
    
    setFotosCaptured(fotos);
    setShowCamera(false);
  };


  const handleDeletePhoto = async (fotoId) => {
    await db.fotos.update(fotoId, { reemplazada: true });
    const fotos = await db.fotos
      .where({ item_inspeccion_id: itemDbId })
      .filter(f => !f.reemplazada)
      .toArray();
    setFotosCaptured(fotos);
  };


  const handleObservaciones = async (text) => {
    setObservaciones(text);
    if (itemDbId) {
      await db.items_inspeccion.update(itemDbId, { observaciones: text });
    }
    if (isConfirmed) {
      onItemComplete?.(item.id, false);
      setIsConfirmed(false);
    }
  };


  const handleConfirmar = async () => {
    if (!canConfirm) return;
    
    setIsConfirmed(true);
    setEditMode(false);
    if (itemDbId) {
      await db.items_inspeccion.update(itemDbId, {
        veredicto_final: veredicto
      });
    }
    
    onItemComplete?.(item.id, true);
    setIsExpanded(false);
  };

  const handleEditar = async () => {
    setIsConfirmed(false);
    setEditMode(true);
    setIsExpanded(true);
    if (itemDbId) {
      await db.items_inspeccion.update(itemDbId, { veredicto_final: null });
    }
    onItemComplete?.(item.id, false);
  };

  // marcar progreso si ya estaba confirmado al cargar
  useEffect(() => {
    if (isConfirmed) {
      onItemComplete?.(item.id, true);
    }
  }, [isConfirmed, item.id, onItemComplete]);


  const needsPhoto = item.foto_requerida === 'SIEMPRE' || 
                    (item.foto_requerida === 'SI_FALLA' && veredicto === 'RECHAZADO');
  
  const minFotos = needsPhoto ? (item.cantidad_fotos_minimas || 1) : 0;
  const maxFotos = item.cantidad_fotos_maximas || 5;
  const fotosCapturedCount = fotosCaptured.length;
  const faltanFotos = Math.max(0, minFotos - fotosCapturedCount);
  const canAddMore = fotosCapturedCount < maxFotos;
  
  const canConfirm = veredicto && 
                     (faltanFotos === 0) && 
                     (veredicto === 'APROBADO' || (veredicto === 'RECHAZADO' && observaciones.trim().length > 0));


  return (
    <motion.div 
      layout
      className={cn(
        "border-2 rounded-2xl transition-all duration-300 overflow-hidden",
        isConfirmed ? "bg-gray-50 border-gray-200" :
        veredicto === 'APROBADO' ? "bg-white border-green-200 shadow-lg shadow-green-100" : 
        veredicto === 'RECHAZADO' ? "bg-white border-red-200 shadow-lg shadow-red-100" : 
        "bg-white border-gray-100 hover:border-gray-200 shadow-sm"
      )}
    >
      
      {/* HEADER */}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <div className="flex items-start gap-2">
              <h3 className="font-bold text-gray-900 text-sm leading-tight flex-1">
                {item.nombre}
              </h3>
              {isConfirmed && (
                <div className="bg-green-500 text-white p-1 rounded-full">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{item.descripcion_inspector}</p>
          </div>
          
          {item.foto_requerida === 'SIEMPRE' && (
            <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-bold">
              <Camera className="w-3 h-3" />
              <span className="hidden sm:inline">Foto</span>
            </div>
          )}
        </div>


        {/* BOTONES APROBAR/RECHAZAR */}
        {!isConfirmed && (
          <div className="flex gap-2">
            <button
              onClick={() => handleVeredicto('APROBADO')}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                veredicto === 'APROBADO'
                  ? "bg-green-500 text-white shadow-md"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
              )}
            >
              <Check className="w-4 h-4" strokeWidth={3} />
              Aprobar
            </button>
            
            <button
              onClick={() => handleVeredicto('RECHAZADO')}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                veredicto === 'RECHAZADO'
                  ? "bg-red-500 text-white shadow-md"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
              )}
            >
              <X className="w-4 h-4" strokeWidth={3} />
              Rechazar
            </button>
          </div>
        )}

        {/* ESTADO CONFIRMADO */}
        {isConfirmed && (
          <div className={cn(
            "py-2 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2",
            veredicto === 'APROBADO' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          )}>
            <CheckCircle2 className="w-4 h-4" />
            {veredicto === 'APROBADO' ? 'Item Aprobado' : 'Item Rechazado'} - Confirmado
          </div>
        )}
      </div>


      {/* ÁREA EXPANDIBLE */}
{/* ÁREA EXPANDIBLE */}
<AnimatePresence>
  {isExpanded && !isConfirmed && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-gray-50 border-t border-gray-200 overflow-hidden"
    >
      <div className="p-4 space-y-4">
        
        {/* CONTADOR DE FOTOS - NEGRO en vez de AMARILLO ✅ */}
        {needsPhoto && (
          <div className={cn(
            "p-3 rounded-xl border-2 font-bold text-sm flex items-center justify-between",
            faltanFotos === 0 
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-gray-900 border-gray-800 text-white"
          )}>
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <span>
                {fotosCapturedCount}/{minFotos} fotos requeridas
                {maxFotos > minFotos && ` (máx. ${maxFotos})`}
              </span>
            </div>
            {faltanFotos === 0 && <CheckCircle2 className="w-5 h-5" />}
          </div>
        )}


        {/* GALERÍA DE FOTOS CAPTURADAS */}
        {fotosCaptured.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase">Fotos Capturadas</p>
            <div className="grid grid-cols-3 gap-2">
              {fotosCaptured.map((foto, idx) => (
                <motion.div
                  key={foto.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="relative aspect-square rounded-xl overflow-hidden border-2 border-green-200 bg-green-50"
                >
                  <img 
                    src={foto.url_remota || foto.data_url || foto.blob_local || foto.url_cloudinary} 
                    alt={`Foto ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-1">
                    <Check className="w-3 h-3" />
                  </div>
                  <button
                    onClick={() => handleDeletePhoto(foto.id)}
                    className="absolute bottom-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}


        {/* BOTÓN AGREGAR FOTO - ROJO en vez de AZUL ✅ */}
        {(needsPhoto || !isConfirmed) && canAddMore && !showCamera && (
          <button
            onClick={() => setShowCamera(true)}
            className="w-full py-3 rounded-xl bg-[#7f1d1d] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-900 transition-colors shadow-lg shadow-red-200"
          >
            <Camera className="w-4 h-4" />
            {fotosCapturedCount === 0 ? 'Capturar Foto' : 'Agregar Otra Foto'}
          </button>
        )}


        {/* COMPONENTE DE CÁMARA - GRIS neutral ✅ */}
        {showCamera && (
          <div className="border-2 border-dashed border-gray-300 rounded-xl bg-white p-2">
            <PhotoCapture
              itemInspeccionId={itemDbId}
              inspeccionId={inspeccionId}
              itemId={item.id}
              onPhotoCaptured={handlePhotoCaptured}
              autoCapture
            />
            <button
              onClick={() => setShowCamera(false)}
              className="w-full mt-2 py-2 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
        )}


        {/* OBSERVACIONES (Solo si rechaza) */}
        {veredicto === 'RECHAZADO' && (
          <div>
            <label className="text-xs font-bold text-gray-600 mb-2 block flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              Observaciones del Rechazo *
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => handleObservaciones(e.target.value)}
              placeholder="Describa detalladamente el problema encontrado..."
              className="w-full text-sm p-3 rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none min-h-[100px] resize-none"
            />
            {observaciones.trim().length === 0 && (
              <p className="text-xs text-red-500 mt-1 font-medium">Las observaciones son obligatorias para rechazos</p>
            )}
          </div>
        )}


        {/* BOTÓN CONFIRMAR */}
        <button
          onClick={handleConfirmar}
          disabled={!canConfirm}
          className={cn(
            "w-full h-12 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all",
            canConfirm
              ? "bg-[#7f1d1d] text-white hover:bg-red-900 active:scale-[0.98] shadow-lg shadow-red-200"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
        >
          <CheckCircle2 className="w-5 h-5" />
          Confirmar y Continuar
        </button>

      </div>
    </motion.div>
  )}
</AnimatePresence>


      {/* TOGGLE PARA VER DETALLES SI YA ESTÁ CONFIRMADO */}
      {isConfirmed && (
        <div className="flex">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 py-2 bg-gray-100 text-gray-500 flex items-center justify-center gap-1 hover:bg-gray-200 transition-colors border-t border-gray-200"
          >
            {isExpanded ? (
              <><ChevronUp className="w-4 h-4" /> <span className="text-xs">Ocultar</span></>
            ) : (
              <><ChevronDown className="w-4 h-4" /> <span className="text-xs">Ver Detalles</span></>
            )}
          </button>
          <button
            onClick={handleEditar}
            className="w-32 py-2 bg-white text-[#7f1d1d] text-xs font-bold border-t border-l border-gray-200 hover:bg-red-50 transition-colors"
          >
            Editar
          </button>
        </div>
      )}
    </motion.div>
  );
}


// ========== COMPONENTE PRINCIPAL ==========
export default function InspeccionCategoria() {
  const params = useParams();
  const nivel = typeof params?.nivel === "string" ? params.nivel : "";
  const router = useRouter();
  
  const categoriaId = CATEGORIA_POR_RUTA[nivel];
  const categoria = CATEGORIAS.find(c => c.id === categoriaId);
  const [plantillaId, setPlantillaId] = useState('general');
  const [carroceriaCamion, setCarroceriaCamion] = useState("");
  const items = useMemo(
    () => getItemsPorCategoria(categoriaId, plantillaId, carroceriaCamion),
    [categoriaId, plantillaId, carroceriaCamion]
  );

  const [inspeccionId, setInspeccionId] = useState(null);
  const [itemsCompletados, setItemsCompletados] = useState({});
  const [categoriasCompletadas, setCategoriasCompletadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tipoCamion, setTipoCamion] = useState('');

  useEffect(() => {
    loadInspeccion();
  }, [nivel]);

  async function loadInspeccion() {
    try {
      const inspeccion = await db.inspecciones
        .where('estado_sincronizacion').equals('en_curso')
        .first();
        
      const patenteValidada = localStorage.getItem('patente_validada') === 'true';

      if (!inspeccion || !patenteValidada) {
        router.replace('/inspector/validacion-identidad');
        return;
      }

      setInspeccionId(inspeccion.id);
      const tipo = inspeccion.tipo || localStorage.getItem('tipo_camion') || 'general';
      const carroceria = inspeccion.carroceria || localStorage.getItem('carroceria_camion') || '';
      setTipoCamion(tipo);
      setCarroceriaCamion(carroceria);
      setPlantillaId(inferPlantilla(tipo, carroceria));
      setCategoriasCompletadas(inspeccion.categorias_completadas || []);
    } catch (error) {
      console.error('Error cargando inspección:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleItemComplete = useCallback((itemId, complete) => {
    setItemsCompletados(prev => {
      if (prev[itemId] === complete) return prev;
      return { ...prev, [itemId]: complete };
    });
  }, []);

  const itemsPendientes = items.filter(item => !itemsCompletados[item.id]);
  const todosCompletados = itemsPendientes.length === 0 && items.length > 0;
  const progreso = items.length > 0 
    ? (Object.values(itemsCompletados).filter(Boolean).length / items.length) * 100 
    : 0;

  // Sincronizar mapa de completados al cargar la categoría desde Dexie
  useEffect(() => {
    const cargarCompletados = async () => {
      if (!inspeccionId || items.length === 0) return;
      const completados = {};
      const registros = await db.items_inspeccion
        .where('inspeccion_id').equals(inspeccionId)
        .and(r => r.veredicto_final !== null && r.veredicto_final !== undefined)
        .toArray();
      registros.forEach(r => { completados[r.item_id] = true; });
      setItemsCompletados(prev => ({ ...prev, ...completados }));
    };
    cargarCompletados();
  }, [inspeccionId, items]);

  const nextCategoria = categoria
    ? CATEGORIAS.find(c => c.nivel === categoria.nivel + 1)
    : null;
  const prevCategoria = categoria
    ? CATEGORIAS.find(c => c.nivel === categoria.nivel - 1)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-700 mx-auto mb-4"></div>
          <p className="text-gray-600 font-bold">Cargando inspección...</p>
        </div>
      </div>
    );
  }

  if (!categoria) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-sky-700 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Categoría no encontrada</h2>
          <button 
            onClick={() => router.push('/inspector')}
            className="bg-sky-800 text-white px-6 py-2 rounded-xl font-bold hover:bg-sky-900 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      
      {/* HEADER */}
      <div className='relative overflow-hidden px-6 pt-10 pb-10 bg-gradient-to-br from-gray-900 via-red-950 to-black'>
        <div className='absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.4),transparent)] pointer-events-none' />

        <div className='relative z-10'>
          <button 
            onClick={() => {
              if (prevCategoria) {
                router.push(prevCategoria.ruta);
              } else {
                router.push('/inspector');
              }
            }}
            className='mb-4 flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-medium'
          >
            <ChevronLeft className='w-4 h-4' />
            Volver
          </button>

          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-2xl">
                {categoria.badge_icono}
              </div>
              <div>
                <p className='text-red-200 text-xs font-bold uppercase tracking-wider'>Inspección</p>
                <h1 className='text-white text-xl font-bold'>{categoria.nombre}</h1>
              </div>
            </div>
            
            <div className='bg-white/10 backdrop-blur-sm border border-white/20 text-white px-3 py-1 rounded-full text-xs font-bold'>
              {Math.round(progreso)}%
            </div>
          </div>

          <Stepper currentCategoria={categoriaId} completadas={categoriasCompletadas} />
        </div>
      </div>

      {/* ESTADÍSTICAS */}
      <div className='px-6 -mt-6 relative z-20 mb-6'>
        <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
          <div className='grid grid-cols-3 divide-x divide-gray-100'>
            <div className='text-center'>
              <p className='text-2xl font-black text-gray-800'>{items.length}</p>
              <p className='text-[10px] font-bold text-gray-400 uppercase mt-1'>Total</p>
            </div>
            <div className='text-center'>
              <p className='text-2xl font-black text-[#7f1d1d]'>
                {Object.values(itemsCompletados).filter(Boolean).length}
              </p>
              <p className='text-[10px] font-bold text-gray-400 uppercase mt-1'>Completados</p>
            </div>
            <div className='text-center'>
              <p className='text-2xl font-black text-gray-800'>{itemsPendientes.length}</p>
              <p className='text-[10px] font-bold text-gray-400 uppercase mt-1'>Pendientes</p>
            </div>
          </div>
        </div>
      </div>

      {/* LISTA DE ITEMS */}
      <div className="px-6 space-y-3 pb-40">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <InspectionItem
              item={item}
              inspeccionId={inspeccionId}
              categoriaId={categoriaId}
              onItemComplete={handleItemComplete}
            />
          </motion.div>
        ))}
      </div>

      {/* FOOTER FIJO */}
      <div className="fixed bottom-[96px] left-0 right-0 p-6 bg-white/95 backdrop-blur-md border-t border-gray-100 z-[60]">
        {!todosCompletados && items.length > 0 && (
          <div className="flex items-center justify-center gap-2 text-sky-800 text-xs font-bold mb-3 bg-sky-50 py-2 px-4 rounded-full border border-sky-100">
            <AlertCircle className="w-4 h-4" />
            <span>Completa {itemsPendientes.length} ítem(s) para continuar</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => prevCategoria && router.push(prevCategoria.ruta)}
            disabled={!prevCategoria}
            className={cn(
              "h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
              prevCategoria
                ? "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                : "bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            Volver
          </button>

          <button
            onClick={() => {
              if (!todosCompletados) return;
              if (nextCategoria) {
                router.push(nextCategoria.ruta);
              } else {
                router.push('/inspector/resumen-firma');
              }
            }}
            disabled={!todosCompletados}
            className={cn(
              "h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
              todosCompletados
                ? "bg-[#7f1d1d] text-white hover:bg-red-900 shadow-xl shadow-red-200 active:scale-[0.98]"
                : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
            )}
          >
            {todosCompletados
              ? (nextCategoria ? 'Continuar' : 'Ir a Resumen')
              : 'Completa los ítems'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
