import { NextResponse } from "next/server"
import { getPool, sql } from "@/lib/azure-sql"

/* ======================================================
   POST /api/fleet
   - Nuevo: { empresaId, camiones: [] }
   - Antiguo: { empresaId, lot: { carroceria, patentes[] } }
   ====================================================== */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const empresaId = Number(body?.empresaId)

    if (!empresaId || Number.isNaN(empresaId)) {
      return NextResponse.json({ error: "empresaId es requerido" }, { status: 400 })
    }

    const camionesArray = Array.isArray(body?.camiones) ? body.camiones : null
    const lot = body?.lot

    const items: Array<{
      patente: string
      carroceria: string
      marca: string | null
      modelo: string | null
      anio: number | null
      tipo: string
    }> = []

    // -------- FORMATO NUEVO --------
    if (camionesArray && camionesArray.length > 0) {
      for (const t of camionesArray as any[]) {
        const patente = String(t?.patente || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "")

        if (!patente) continue

        items.push({
          patente,
          carroceria: String(t?.carroceria || ""),
          marca: t?.marca ? String(t.marca).trim() : null,
          modelo: t?.modelo ? String(t.modelo).trim() : null,
          anio: Number.isInteger(Number(t?.anio)) ? Number(t.anio) : null,
          tipo: String(t?.tipo || "camion"),
        })
      }

      if (items.length === 0) {
        return NextResponse.json({ error: "camiones es requerido" }, { status: 400 })
      }

      if (items.some((x) => !x.carroceria)) {
        return NextResponse.json({ error: "carroceria es requerida por camión" }, { status: 400 })
      }
    }
    // -------- FORMATO ANTIGUO (COMPATIBILIDAD) --------
    else {
      if (!lot?.carroceria) {
        return NextResponse.json({ error: "carroceria es requerida" }, { status: 400 })
      }
      if (!Array.isArray(lot?.patentes) || lot.patentes.length === 0) {
        return NextResponse.json({ error: "patentes es requerida" }, { status: 400 })
      }

      for (const raw of lot.patentes as string[]) {
        const patente = String(raw || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "")

        if (!patente) continue

        items.push({
          patente,
          carroceria: String(lot.carroceria),
          marca: null,
          modelo: null,
          anio: null,
          tipo: "camion",
        })
      }
    }

    const pool = await getPool()

    // -------- PROVEEDOR DEFAULT --------
    const provRes = await pool
      .request()
      .input("empresa_id", sql.Int, empresaId)
      .query(`
        SELECT TOP 1 id
        FROM proveedores
        WHERE empresa_id = @empresa_id
        ORDER BY created_at DESC
      `)

    let proveedorId: number | null = provRes.recordset?.[0]?.id ?? null

    if (!proveedorId) {
      const createProv = await pool
        .request()
        .input("empresa_id", sql.Int, empresaId)
        .input("nombre", sql.VarChar(150), "Proveedor (auto)")
        .input("tipo_transportista", sql.VarChar(20), "no_licitado")
        .input("tipo_entidad", sql.VarChar(20), "empresa")
        .query(`
          INSERT INTO proveedores (empresa_id, nombre, tipo_transportista, tipo_entidad)
          OUTPUT INSERTED.id
          VALUES (@empresa_id, @nombre, @tipo_transportista, @tipo_entidad)
        `)

      proveedorId = createProv.recordset[0].id
    }

    // -------- INSERT CAMIONES --------
    const insertedIds: number[] = []
    const duplicates: string[] = []

    for (const t of items) {
      const exists = await pool
        .request()
        .input("proveedor_id", sql.Int, proveedorId)
        .input("patente", sql.VarChar(15), t.patente)
        .query(`
          SELECT TOP 1 id
          FROM camiones
          WHERE proveedor_id = @proveedor_id AND patente = @patente
        `)

      if (exists.recordset.length > 0) {
        duplicates.push(t.patente)
        continue
      }

      const ins = await pool
        .request()
        .input("proveedor_id", sql.Int, proveedorId)
        .input("patente", sql.VarChar(15), t.patente)
        .input("marca", sql.VarChar(50), t.marca)
        .input("modelo", sql.VarChar(50), t.modelo)
        .input("anio", sql.Int, t.anio)
        .input("tipo", sql.VarChar(20), t.tipo || "camion")
        .input("carroceria", sql.VarChar(30), t.carroceria)
        .query(`
          INSERT INTO camiones
            (proveedor_id, patente, marca, modelo, anio, tipo, carroceria)
          OUTPUT INSERTED.id
          VALUES
            (@proveedor_id, @patente, @marca, @modelo, @anio, @tipo, @carroceria)
        `)

      insertedIds.push(ins.recordset[0].id)
    }

    return NextResponse.json({
      success: true,
      proveedorId,
      insertedCount: insertedIds.length,
      insertedIds,
      duplicates,
    })
  } catch (e) {
    console.error("[fleet][POST] error:", e)
    return NextResponse.json({ error: "Error al registrar flota" }, { status: 500 })
  }
}

/* ======================================================
   GET /api/fleet?empresaId=...
   - Lista camiones por empresaId
   - Trae foto guardada (si existe)
   ====================================================== */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const empresaId = Number(searchParams.get("empresaId"))

    if (!empresaId || Number.isNaN(empresaId)) {
      return NextResponse.json({ error: "empresaId es requerido" }, { status: 400 })
    }

    const pool = await getPool()

    const result = await pool
      .request()
      .input("empresa_id", sql.Int, empresaId)
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
      `)

    return NextResponse.json({
      success: true,
      trucks: result.recordset,
    })
  } catch (e) {
    console.error("[fleet][GET] error:", e)
    return NextResponse.json({ error: "Error al obtener camiones" }, { status: 500 })
  }
}
