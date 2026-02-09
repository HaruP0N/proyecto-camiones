import Dexie from 'dexie';

export interface PetranDB extends Dexie {
  inspecciones: Dexie.Table<any, number>;
  items_inspeccion: Dexie.Table<any, number>;
  fotos: Dexie.Table<any, number>;
  historial_cambios: Dexie.Table<any, number>;
  cola_sync: Dexie.Table<any, number>;
}

const db = new Dexie('PetranInspectDB') as PetranDB;

db.version(1).stores({
  inspecciones: '++id, patente_sistema, patente_real, timestamp_inicio, estado_sincronizacion, inspector_id',
  items_inspeccion: '++id, inspeccion_id, categoria_id, item_id, veredicto_inspector, veredicto_final, sobreescrito_por_admin',
  fotos: '++id, item_inspeccion_id, inspeccion_id, tipo, reemplazada, timestamp_captura',
  historial_cambios: '++id, item_inspeccion_id, timestamp, usuario_id, accion',
  cola_sync: '++id, tipo, payload, intentos, ultimo_intento'
});

// v2: limpieza de duplicados en items_inspeccion por inspeccion_id + item_id
db.version(2).stores({
  inspecciones: '++id, patente_sistema, patente_real, timestamp_inicio, estado_sincronizacion, inspector_id',
  items_inspeccion: '++id, inspeccion_id, categoria_id, item_id, veredicto_inspector, veredicto_final, sobreescrito_por_admin',
  fotos: '++id, item_inspeccion_id, inspeccion_id, tipo, reemplazada, timestamp_captura',
  historial_cambios: '++id, item_inspeccion_id, timestamp, usuario_id, accion',
  cola_sync: '++id, tipo, payload, intentos, ultimo_intento'
}).upgrade(async tx => {
  const table = tx.table('items_inspeccion');
  const all = await table.toArray();
  const keep = new Map();
  const toDelete = [];

  for (const item of all) {
    const key = `${item.inspeccion_id}:${item.item_id}`;
    const prev = keep.get(key);
    if (!prev) {
      keep.set(key, item);
      continue;
    }
    const prevFinal = prev.veredicto_final !== null && prev.veredicto_final !== undefined;
    const curFinal = item.veredicto_final !== null && item.veredicto_final !== undefined;
    // Preferir el que tenga veredicto_final; si ambos, el más nuevo (id mayor)
    if (curFinal && !prevFinal) {
      toDelete.push(prev.id);
      keep.set(key, item);
    } else if (curFinal === prevFinal) {
      if ((item.id || 0) > (prev.id || 0)) {
        toDelete.push(prev.id);
        keep.set(key, item);
      } else {
        toDelete.push(item.id);
      }
    } else {
      toDelete.push(item.id);
    }
  }

  await table.bulkDelete(toDelete);
});

// v3: limpiar blobs legacy (iOS/IndexedDB falla con Blob/File)
db.version(3).stores({
  inspecciones: '++id, patente_sistema, patente_real, timestamp_inicio, estado_sincronizacion, inspector_id',
  items_inspeccion: '++id, inspeccion_id, categoria_id, item_id, veredicto_inspector, veredicto_final, sobreescrito_por_admin',
  fotos: '++id, item_inspeccion_id, inspeccion_id, tipo, reemplazada, timestamp_captura',
  historial_cambios: '++id, item_inspeccion_id, timestamp, usuario_id, accion',
  cola_sync: '++id, tipo, payload, intentos, ultimo_intento'
}).upgrade(async tx => {
  await tx.table('fotos').toCollection().modify((f: any) => {
    if (f.blob) f.blob = null;
    if (f.thumbnail_blob) f.thumbnail_blob = null;
  });
  await tx.table('inspecciones').toCollection().modify((i: any) => {
    if (i.firma_blob) i.firma_blob = null;
  });
});

// Asigna tablas tipadas
db.inspecciones = db.table('inspecciones');
db.items_inspeccion = db.table('items_inspeccion');
db.fotos = db.table('fotos');
db.historial_cambios = db.table('historial_cambios');
db.cola_sync = db.table('cola_sync');

export default db;
