import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
import { requireCliente } from "@/lib/shared/security/cliente-auth";

export const runtime = "nodejs";

const ALLOWED_CARROCERIAS = new Set([
  "camion_con_carro",
  "carro_reefer",
  "camara_de_frio",
  "camion_paquetero",
]);

function normalizePatente(p: string) {
  return String(p || "").trim().toUpperCase().replace(/\s+/g, "");
}

/* ======================================================
   POST /api/fleet
   - { camiones: [...] }
   ====================================================== */
export async function POST(req: NextRequest) {
  try {
    const cliente = requireCliente(req);
    if (!cliente) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json().catch(() => null);

    const camiones = Array.isArray(body?.camiones) ? body.camiones : null;
    if (!camiones || camiones.length === 0) {
      return NextResponse.json({ error: "camiones es requerido" }, { status: 400 });
    }

    const items: Array<{
      patente: string;
      carroceria: string;
      marca: string | null;
      modelo: string | null;
      anio: number | null;
      tipo: string;
    }> = [];

    for (const t of camiones) {
      const patente = normalizePatente(t?.patente);
      if (!patente) continue;

      const carroceria = String(t?.carroceria || "");
      if (!ALLOWED_CARROCERIAS.has(carroceria)) {
        return NextResponse.json({ error: `Carrocería inválida: ${carroceria}` }, { status: 400 });
      }

      const anioNum = Number(t?.anio);
      items.push({
        patente,
        carroceria,
        marca: t?.marca ? String(t.marca).trim() : null,
        modelo: t?.modelo ? String(t.modelo).trim() : null,
        anio: Number.isInteger(anioNum) ? anioNum : null,
        tipo: String(t?.tipo || "camion"),
      });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "camiones es requerido" }, { status: 400 });
    }

    const pool = await getPool();
    const empresaId = Number(cliente.empresaId);

    // --- proveedor default por empresa (desde cookie) ---
    const provRes = await pool
      .request()
      .input("empresa_id", empresaId)
      .query(`
        SELECT TOP 1 id
        FROM proveedores
        WHERE empresa_id = @empresa_id
        ORDER BY created_at DESC
      `);

    let proveedorId: number | null = provRes.recordset?.[0]?.id ?? null;

    if (!proveedorId) {
      const createProv = await pool
        .request()
        .input("empresa_id", empresaId)
        .input("nombre", "Proveedor (auto)")
        .input("tipo_transportista", "no_licitado")
        .input("tipo_entidad", "empresa")
        .query(`
          INSERT INTO proveedores (empresa_id, nombre, tipo_transportista, tipo_entidad)
          OUTPUT INSERTED.id
          VALUES (@empresa_id, @nombre, @tipo_transportista, @tipo_entidad)
        `);
      proveedorId = createProv.recordset[0].id;
    }

    const duplicates: string[] = [];
    const insertedTrucks: Array<{ id: number; patente: string }> = [];

    for (const t of items) {
      const exists = await pool
        .request()
        .input("proveedor_id", proveedorId)
        .input("patente", t.patente)
        .query(`
          SELECT TOP 1 id
          FROM camiones
          WHERE proveedor_id = @proveedor_id AND patente = @patente
        `);

      if (exists.recordset.length > 0) {
        duplicates.push(t.patente);
        continue;
      }

      const ins = await pool
        .request()
        .input("proveedor_id", proveedorId)
        .input("patente", t.patente)
        .input("marca", t.marca)
        .input("modelo", t.modelo)
        .input("anio", t.anio)
        .input("tipo", t.tipo || "camion")
        .input("carroceria", t.carroceria)
        .query(`
          INSERT INTO camiones (proveedor_id, patente, marca, modelo, anio, tipo, carroceria)
          OUTPUT INSERTED.id, INSERTED.patente
          VALUES (@proveedor_id, @patente, @marca, @modelo, @anio, @tipo, @carroceria)
        `);

      insertedTrucks.push({ id: ins.recordset[0].id, patente: ins.recordset[0].patente });
    }

    return NextResponse.json({
      success: true,
      proveedorId,
      insertedCount: insertedTrucks.length,
      insertedTrucks,
      duplicates,
    });
  } catch (e) {
    console.error("[fleet][POST] error:", e);
    return NextResponse.json({ error: "Error al registrar flota" }, { status: 500 });
  }
}

/* ======================================================
   PUT /api/fleet
   - { truckId, marca, modelo, anio, carroceria }
   ====================================================== */
export async function PUT(req: NextRequest) {
  try {
    const cliente = requireCliente(req);
    if (!cliente) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json().catch(() => null);

    const truckId = Number(body?.truckId);
    if (!truckId || Number.isNaN(truckId)) {
      return NextResponse.json({ error: "truckId es requerido" }, { status: 400 });
    }

    const carroceria = body?.carroceria ? String(body.carroceria) : null;
    if (carroceria && !ALLOWED_CARROCERIAS.has(carroceria)) {
      return NextResponse.json({ error: `Carrocería inválida: ${carroceria}` }, { status: 400 });
    }

    const marca = body?.marca ? String(body.marca).trim() : null;
    const modelo = body?.modelo ? String(body.modelo).trim() : null;
    const anioNum = Number(body?.anio);
    const anio = Number.isInteger(anioNum) ? anioNum : null;

    const pool = await getPool();
    const empresaId = Number(cliente.empresaId);

    // ✅ verificar pertenencia del camión a la empresa del cliente
    const owns = await pool
      .request()
      .input("truckId", truckId)
      .input("empresaId", empresaId)
      .query(`
        SELECT TOP 1 c.id
        FROM camiones c
        INNER JOIN proveedores p ON p.id = c.proveedor_id
        WHERE c.id = @truckId
          AND p.empresa_id = @empresaId
      `);

    if (owns.recordset.length === 0) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await pool
      .request()
      .input("id", truckId)
      .input("marca", marca)
      .input("modelo", modelo)
      .input("anio", anio)
      .input("carroceria", carroceria)
      .query(`
        UPDATE camiones
        SET
          marca = @marca,
          modelo = @modelo,
          anio = @anio,
          carroceria = COALESCE(@carroceria, carroceria)
        WHERE id = @id
      `);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[fleet][PUT] error:", e);
    return NextResponse.json({ error: "Error al actualizar camión" }, { status: 500 });
  }
}

/* ======================================================
   GET /api/fleet
   - Lista camiones de la empresa del cliente (cookie)
   ====================================================== */
export async function GET(req: NextRequest) {
  try {
    const cliente = requireCliente(req);
    if (!cliente) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const pool = await getPool();
    const empresaId = Number(cliente.empresaId);

    const result = await pool
      .request()
      .input("empresa_id", empresaId)
      .query(`
        SELECT
          c.id,
          c.patente,
          c.marca,
          c.modelo,
          c.anio,
          c.carroceria,
          cf.url AS foto_url
        FROM camiones c
        INNER JOIN proveedores p ON p.id = c.proveedor_id
        LEFT JOIN camion_fotos cf ON cf.camion_id = c.id
        WHERE p.empresa_id = @empresa_id
        ORDER BY c.created_at DESC
      `);

    return NextResponse.json({ success: true, trucks: result.recordset });
  } catch (e) {
    console.error("[fleet][GET] error:", e);
    return NextResponse.json({ error: "Error al obtener camiones" }, { status: 500 });
  }
}
