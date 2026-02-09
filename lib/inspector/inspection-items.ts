export const CATEGORIAS = [
  { id: "cat_criticos", nivel: 1, nombre: "Críticos (Seguridad)", color_alerta: "#FF0000", badge_icono: "⚠️", ruta: "/inspector/inspeccion/criticos" },
  { id: "cat_operacion", nivel: 2, nombre: "Operación Segura", color_alerta: "#FFA500", badge_icono: "⚙️", ruta: "/inspector/inspeccion/operacion" },
  { id: "cat_seguridad_cabina", nivel: 3, nombre: "Seguridad y Cabina", color_alerta: "#FFD700", badge_icono: "🛡️", ruta: "/inspector/inspeccion/seguridad" }
];

const makeItem = (id, categoria_id, nombre, descripcion_inspector, foto_requerida = 'SI_FALLA', min = 1, max = 3) => ({
  id,
  categoria_id,
  nombre,
  descripcion_inspector,
  foto_requerida,
  cantidad_fotos_minimas: min,
  cantidad_fotos_maximas: max,
  instruccion_foto: descripcion_inspector,
});

const PLANTILLAS = {
  general: {
    cat_criticos: [
      makeItem('frenos_seguridad', 'cat_criticos', 'Frenos (fugas/mangueras/cámaras/discos)', 'Fugas de aire, mangueras cortadas o sueltas, cámaras dañadas, discos/tambores con grietas', 'SIEMPRE', 1, 3),
      makeItem('neumaticos_seguridad', 'cat_criticos', 'Neumáticos (desgaste/cortes/globos)', 'Desgaste irregular, lisos, cortes o globos; objetos entre ruedas dobles', 'SIEMPRE', 2, 4),
      makeItem('chasis_quinta', 'cat_criticos', 'Chasis / Quinta rueda', 'Fisuras o soldaduras no originales, óxido estructural, juego o falta de lubricación en quinta rueda', 'SI_FALLA', 1, 3),
      makeItem('senalizacion_trasera', 'cat_criticos', 'Señalización trasera', 'Luces de freno/posición y reflectantes reglamentarios', 'SI_FALLA', 1, 2),
    ],
    cat_operacion: [
      makeItem('fluidos_fugas', 'cat_operacion', 'Sistema de fluidos', 'Fugas de aceite, combustible, refrigerante o manchas recientes'),
      makeItem('suspension', 'cat_operacion', 'Suspensión', 'Ballestas quebradas, amortiguadores con fuga, bujes dañados, desalineación visible'),
      makeItem('cabina_fijaciones', 'cat_operacion', 'Cabina y cierres', 'Puertas y cerraduras operativas, cabina bien fijada al chasis'),
      makeItem('seguridad_equipos', 'cat_operacion', 'Elementos de seguridad', 'Extintor vigente, triángulos, botiquín e implementos obligatorios'),
    ],
    cat_seguridad_cabina: [
      makeItem('electrico_cableado', 'cat_seguridad_cabina', 'Sistema eléctrico', 'Cables sueltos, empalmes hechizos, baterías mal fijadas o sulfatadas'),
      makeItem('accesos', 'cat_seguridad_cabina', 'Accesos y plataformas', 'Pasamanos firmes, escaleras antideslizantes, plataformas sin deformaciones'),
      makeItem('coherencia_documentos', 'cat_seguridad_cabina', 'Coincidencia con documentos', 'Número de chasis legible, patente correcta, sin señales de adulteración'),
      makeItem('estetica_confort', 'cat_seguridad_cabina', 'Estética/Confort', 'Pintura, golpes menores, ruidos, tapices y plásticos'),
    ],
  },

  caja_seca: {
    cat_criticos: [
      makeItem('fijacion_caja', 'cat_criticos', 'Fijación de la caja al chasis', 'Pernos y anclajes firmes, sin juego'),
      makeItem('estructura_principal', 'cat_criticos', 'Estructura principal', 'Paneles sin grietas, sin deformaciones graves'),
      makeItem('puertas_traseras', 'cat_criticos', 'Puertas traseras', 'Bisagras, cerraduras y trabas operativas; cierre hermético'),
      makeItem('piso_carga', 'cat_criticos', 'Piso de carga', 'Sin roturas ni perforaciones; capacidad intacta'),
    ],
    cat_operacion: [
      makeItem('paneles_laterales', 'cat_operacion', 'Paneles laterales', 'Golpes profundos u ondulaciones'),
      makeItem('techo_caja', 'cat_operacion', 'Techo de la caja', 'Abolladuras o filtraciones de agua'),
      makeItem('postes_estructurales', 'cat_operacion', 'Postes estructurales', 'Esquinas y laterales rectos, sin corrosión avanzada'),
      makeItem('parachoques_defensa', 'cat_operacion', 'Parachoques / defensa', 'Bien fijado, sin deformaciones severas ni elementos cortantes'),
    ],
    cat_seguridad_cabina: [
      makeItem('revestimiento_interior', 'cat_seguridad_cabina', 'Revestimiento interior', 'Golpes o desprendimientos'),
      makeItem('rieles_amarre', 'cat_seguridad_cabina', 'Rieles / puntos de amarre', 'Firmes y no deformados'),
      makeItem('ventilacion_iluminacion', 'cat_seguridad_cabina', 'Ventilación / iluminación', 'Rejillas limpias, luces interiores (si existen) operativas'),
      makeItem('estetica_rotulacion', 'cat_seguridad_cabina', 'Estética y rotulación', 'Pintura, detalles interiores, gráficas'),
    ],
  },

  remolque_refrigerado: {
    cat_criticos: [
      makeItem('unidad_refrigeracion', 'cat_criticos', 'Unidad de refrigeración', 'Golpes, ruidos anormales, fugas en compresor/panel frontal', 'SIEMPRE', 1, 3),
      makeItem('aislamiento_paneles', 'cat_criticos', 'Aislación y paneles', 'Humedad, deformaciones, fisuras en techo/paneles, pérdida de frío'),
      makeItem('puertas_sellos', 'cat_criticos', 'Puertas y sellos', 'Sellos intactos y cierre hermético'),
      makeItem('drenaje_linea_carga', 'cat_criticos', 'Drenaje y línea de carga', 'Tapón presente/funcional y línea de máxima carga visible'),
    ],
    cat_operacion: [
      makeItem('ventilacion_flujo', 'cat_operacion', 'Ventilación / ventiladores', 'Flujo de aire correcto'),
      makeItem('rieles_superiores', 'cat_operacion', 'Rieles superiores', 'Riel frontal y trasero soportan y distribuyen el frío'),
      makeItem('postes_estructura', 'cat_operacion', 'Postes estructurales', 'Postes frontal/trasero/laterales con rigidez y alineación'),
      makeItem('placa_deflectora', 'cat_operacion', 'Placa deflectora', 'Dirige correctamente el flujo de aire'),
    ],
    cat_seguridad_cabina: [
      makeItem('paneles_interiores', 'cat_seguridad_cabina', 'Paneles y rieles interiores', 'Golpes, fisuras, higiene; riel lateral en buen estado'),
      makeItem('piso_aluminio', 'cat_seguridad_cabina', 'Piso de aluminio tipo T', 'Deformaciones, higiene'),
      makeItem('control_display', 'cat_seguridad_cabina', 'Display / caja de control / cable', 'Lectura visible, cableado y plug protegidos'),
      makeItem('drenaje_condensacion', 'cat_seguridad_cabina', 'Drenaje / condensación', 'Rejillas internas, drenaje y condensación sin obstrucciones'),
    ],
  },
};

function inferPlantilla(tipo = 'general', carroceria = '') {
  const t = (tipo + ' ' + carroceria).toLowerCase();
  if (t.includes('reefer') || t.includes('refriger') || t.includes('camara_de_frio')) return 'remolque_refrigerado';
  if (t.includes('carro') || t.includes('remolque') || t.includes('caja') || t.includes('paquete')) return 'caja_seca';
  return 'general';
}

export function getItemsPorCategoria(categoriaId, plantilla = 'general', carroceria = '') {
  const tplKey = PLANTILLAS[plantilla] ? plantilla : inferPlantilla(plantilla, carroceria);
  const tpl = PLANTILLAS[tplKey] || PLANTILLAS.general;
  return tpl[categoriaId] || [];
}

export { PLANTILLAS, inferPlantilla };
