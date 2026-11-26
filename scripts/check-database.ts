import { getPool } from '../lib/database';

const required: Record<string, string[]> = {
  usuarios: ['id','nombre','email','password_hash','rol','activo'],
  empresas: ['id','nombre','rut','pin_hash','prioridad_frio','prioridad_carroceria','prioridad_estructura','prioridad_camion','prioridad_acople','productos_transportados','rubro','direccion','telefono_contacto','email_contacto','created_at'],
  proveedores: ['id','empresa_id','nombre','tipo_transportista','tipo_entidad','created_at'],
  camiones: ['id','proveedor_id','patente','marca','modelo','anio','tipo','carroceria','created_at','estado'],
  camion_fotos: ['id','camion_id','url'],
  inspecciones: ['id','camion_id','inspector_id','fecha_programada','fecha_inspeccion','fecha_realizada','estado','resultado_general','nota_final','revision_admin','comentario_admin','observaciones_generales','resultado_detallado'],
  detalle_inspeccion: ['id','inspeccion_id','camion_id','item_id','resultado','estado_item','descripcion_falla','motivo_no_aplica','categoria','nivel','seccion','resultado_admin','comentario_admin'],
  fotos_inspeccion: ['id','detalle_inspeccion_id','nombre_archivo','url_archivo','datos_binarios','tipo_mime','fecha_captura','latitud','longitud'],
  notificaciones: ['id','usuario_id','inspeccion_id','tipo','titulo','mensaje','leida','created_at'],
};
async function main() {
  const db = await getPool();
  try {
    const columns = await db.request().query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`);
    const missing = Object.entries(required).flatMap(([table, fields]) => fields.filter(field => !columns.recordset.some(c => c.table_name === table && c.column_name === field)).map(field => `${table}.${field}`));
    if (missing.length) throw new Error(`Faltan columnas: ${missing.join(', ')}`);
    const indexes = await db.request().query(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'inspecciones_programada_unique'`);
    if (!indexes.recordset.length) throw new Error('Falta índice único de inspecciones programadas');
    const rls = await db.request().query(`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`);
    if (rls.recordset.some(row => required[row.tablename] && !row.rowsecurity)) throw new Error('Hay tablas de la aplicación sin RLS');
    console.log('Conexión correcta: las 9 tablas, columnas requeridas, RLS e índice de agenda están disponibles.');
  } finally { await db.pool.end(); }
}
main().catch(() => { console.error('No se pudo verificar la conexión y el esquema. Revisa DATABASE_URL, el certificado y la migración.'); process.exitCode = 1; });
