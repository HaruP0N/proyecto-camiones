// catalogo.ts
// =========================================================
// PETRAN — Catálogo completo de ítems (tu lista)
// 50 ítems totales + niveles definidos
// =========================================================

import type { ItemChecklist } from "./types";

export const ITEMS: ItemChecklist[] = [
  // ---------------- NIVEL 1 ----------------
  { id: "N1-01", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Frenos (visual)", titulo: "Fugas de aire (en frenos neumáticos)" },
  { id: "N1-02", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Frenos (visual)", titulo: "Mangueras cortadas o sueltas" },
  { id: "N1-03", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Frenos (visual)", titulo: "Cámaras de freno dañadas" },
  { id: "N1-04", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Frenos (visual)", titulo: "Discos/tambores con grietas visibles" },

  { id: "N1-05", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Neumáticos (todos)", titulo: "Desgaste irregular" },
  { id: "N1-06", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Neumáticos (todos)", titulo: "Neumáticos lisos" },
  { id: "N1-07", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Neumáticos (todos)", titulo: "Cortes, globos" },
  { id: "N1-08", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Neumáticos (todos)", titulo: "Doble rueda con piedras u objetos atrapados" },

  { id: "N1-09", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Chasis y estructura", titulo: "Fisuras o grietas" },
  { id: "N1-10", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Chasis y estructura", titulo: "Soldaduras no originales" },
  { id: "N1-11", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Chasis y estructura", titulo: "Óxido estructural (no superficial)" },

  { id: "N1-12", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Acople / Quinta rueda (si aplica)", titulo: "Exceso de juego" },
  { id: "N1-13", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Acople / Quinta rueda (si aplica)", titulo: "Falta de lubricación" },
  { id: "N1-14", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Acople / Quinta rueda (si aplica)", titulo: "Pernos o seguros dañados" },

  { id: "N1-15", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Señalización trasera", titulo: "Luces de freno" },
  { id: "N1-16", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Señalización trasera", titulo: "Luces de posición" },
  { id: "N1-17", nivel: 1, grupo: "NIVEL 1 — CRÍTICO", seccion: "Señalización trasera", titulo: "Reflectantes reglamentarios" },

  // Coincidencia visual con documentos (Nivel 1)
  { id: "N1-45", nivel: 1, grupo: "ASPECTOS CLAVE — OBLIGATORIO", seccion: "Coincidencia visual con documentos", titulo: "Número de chasis legible" },
  { id: "N1-46", nivel: 1, grupo: "ASPECTOS CLAVE — OBLIGATORIO", seccion: "Coincidencia visual con documentos", titulo: "Patente correcta" },
  { id: "N1-47", nivel: 1, grupo: "ASPECTOS CLAVE — OBLIGATORIO", seccion: "Coincidencia visual con documentos", titulo: "Señales de adulteración" },

  // ---------------- NIVEL 2 ----------------
  { id: "N2-18", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Sistema de fluidos", titulo: "Fugas de aceite" },
  { id: "N2-19", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Sistema de fluidos", titulo: "Fugas de combustible" },
  { id: "N2-20", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Sistema de fluidos", titulo: "Fugas de refrigerante" },
  { id: "N2-21", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Sistema de fluidos", titulo: "Manchas recientes bajo el camión" },

  { id: "N2-22", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Suspensión", titulo: "Ballestas quebradas" },
  { id: "N2-23", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Suspensión", titulo: "Amortiguadores con fuga" },
  { id: "N2-24", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Suspensión", titulo: "Bujes dañados" },
  { id: "N2-25", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Suspensión", titulo: "Desalineación visible del eje" },

  { id: "N2-26", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Cabina", titulo: "Puertas cierran correctamente" },
  { id: "N2-27", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Cabina", titulo: "Cerraduras funcionales" },
  { id: "N2-28", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Cabina", titulo: "Cabina bien fijada al chasis" },

  { id: "N2-29", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Seguridad", titulo: "Extintor presente y vigente" },
  { id: "N2-30", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Seguridad", titulo: "Triángulos reflectantes" },
  { id: "N2-31", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Seguridad", titulo: "Botiquín (si aplica por normativa)" },
  { id: "N2-32", nivel: 2, grupo: "NIVEL 2 — ALTO", seccion: "Seguridad", titulo: "Implementos de Seguridad" },

  // Coherencia general (Nivel 2)
  { id: "N2-48", nivel: 2, grupo: "ASPECTOS CLAVE — OBLIGATORIO", seccion: "Coherencia general", titulo: "Cabina muy nueva vs chasis muy viejo" },
  { id: "N2-49", nivel: 2, grupo: "ASPECTOS CLAVE — OBLIGATORIO", seccion: "Coherencia general", titulo: "Kilometraje vs desgaste de pedales/volante" },
  { id: "N2-50", nivel: 2, grupo: "ASPECTOS CLAVE — OBLIGATORIO", seccion: "Coherencia general", titulo: "Neumáticos nuevos solo en un eje" },

  // ---------------- NIVEL 3 ----------------
  { id: "N3-33", nivel: 3, grupo: "NIVEL 3 — MEDIO", seccion: "Sistema eléctrico", titulo: "Cables sueltos" },
  { id: "N3-34", nivel: 3, grupo: "NIVEL 3 — MEDIO", seccion: "Sistema eléctrico", titulo: "Empalmes hechizos" },
  { id: "N3-35", nivel: 3, grupo: "NIVEL 3 — MEDIO", seccion: "Sistema eléctrico", titulo: "Baterías mal fijadas" },
  { id: "N3-36", nivel: 3, grupo: "NIVEL 3 — MEDIO", seccion: "Sistema eléctrico", titulo: "Sulfatación de bornes" },

  { id: "N3-37", nivel: 3, grupo: "NIVEL 3 — MEDIO", seccion: "Accesos", titulo: "Pasamanos firmes" },
  { id: "N3-38", nivel: 3, grupo: "NIVEL 3 — MEDIO", seccion: "Accesos", titulo: "Escaleras antideslizantes" },
  { id: "N3-39", nivel: 3, grupo: "NIVEL 3 — MEDIO", seccion: "Accesos", titulo: "Plataformas sin deformaciones" },

  // ---------------- NIVEL 4 ----------------
  { id: "N4-40", nivel: 4, grupo: "NIVEL 4 — BAJO", seccion: "Estético / Confort", titulo: "Estado de pintura" },
  { id: "N4-41", nivel: 4, grupo: "NIVEL 4 — BAJO", seccion: "Estético / Confort", titulo: "Golpes menores" },
  { id: "N4-42", nivel: 4, grupo: "NIVEL 4 — BAJO", seccion: "Estético / Confort", titulo: "Ruidos interiores" },
  { id: "N4-43", nivel: 4, grupo: "NIVEL 4 — BAJO", seccion: "Estético / Confort", titulo: "Tapices y paneles" },
  { id: "N4-44", nivel: 4, grupo: "NIVEL 4 — BAJO", seccion: "Estético / Confort", titulo: "Detalles plásticos" },
];

// Para render ordenado: grupos -> secciones -> ítems
export function groupItems(items: ItemChecklist[] = ITEMS) {
  const byGrupo = new Map<string, Map<string, ItemChecklist[]>>();

  for (const it of items) {
    if (!byGrupo.has(it.grupo)) byGrupo.set(it.grupo, new Map());
    const bySeccion = byGrupo.get(it.grupo)!;
    if (!bySeccion.has(it.seccion)) bySeccion.set(it.seccion, []);
    bySeccion.get(it.seccion)!.push(it);
  }

  // Orden estable por id
  for (const [, bySeccion] of byGrupo) {
    for (const [sec, arr] of bySeccion) {
      arr.sort((a, b) => a.id.localeCompare(b.id));
      bySeccion.set(sec, arr);
    }
  }

  return byGrupo;
}
