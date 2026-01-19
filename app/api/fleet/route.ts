import { NextResponse } from "next/server"
import { getPool, sql } from "@/lib/azure-sql"

const ALLOWED_CARROCERIAS = new Set([
  "CAMION_CON_CARRO",
  "CARRO_REEFER",
  "CAMARA_DE_FRIO",
  "CAMION_PAQUETERO",
])

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const empresaId = Number(body?.empresaId)

    if (!empresaId || Number.isNaN(empresaId)) {
      return NextResponse.json({ error: "empresaId es requerido" }, { status: 400 })
    }

    const camiones = Array.isArray(body?.camiones) ? body.camiones : null
    const items: any[] = []

    if (camiones && camiones.length > 0) {
      for (const t of camiones) {
        const patente = String(t?.patente || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "")

        if (!patente) continue

        if (!ALLOWED_CARROCERIAS.has(t.carroceria)) {
          return NextResponse.json(
            { error: `Carrocería inválida: ${t.carroceria}` },
            { status: 400 }
          )
        }

        items.push({
          patente,
          carroceria: t.carroceria,
          marca: t.marca ?? null,
          modelo: t.modelo ?? null,
          anio: Number.isInteger(Number(t.anio)) ? Number(t.anio) : null,
        })
      }
    } else {
      return NextResponse.json({ error: "camiones es requerido" }, { status: 400 })
    }

    const pool = await getPool()

    const provRes = await pool
      .request()
      .input("empresa_id", sql.Int, empresaId)
      .query(`
        SELECT TOP 1 id
        FROM proveedores
        WHERE empresa_id = @empresa_id
        ORDER BY created_at DESC
      `)

    let proveedorId = provRes.recordset?.[0]?.id

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

    const insertedIds: number[] = []
    const duplicates: string[] = []

    for (const t of items) {
      const exists = await pool
        .request()
        .input("proveedor_id", sql.Int, proveedorId)
        .input("patente", sql.VarChar(15), t.patente)
        .query(`
          SELECT 1 FROM camiones
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
        .input("tipo", sql.VarChar(20), "camion")
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
      insertedCount: insertedIds.length,
      duplicates,
    })
  } catch (e) {
    console.error("[fleet][POST] error:", e)
    return NextResponse.json({ error: "Error al registrar flota" }, { status: 500 })
  }
}

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

    return NextResponse.json({ success: true, trucks: result.recordset })
  } catch (e) {
    console.error("[fleet][GET] error:", e)
    return NextResponse.json({ error: "Error al obtener camiones" }, { status: 500 })
  }
}
