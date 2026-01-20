import { NextRequest, NextResponse } from "next/server"
import { getPool, sql } from "@/lib/azure-sql"

type Carroceria = "CAMION_CON_CARRO" | "CARRO_REEFER" | "CAMARA_DE_FRIO" | "CAMION_PAQUETERO"
const ALLOWED: Carroceria[] = ["CAMION_CON_CARRO", "CARRO_REEFER", "CAMARA_DE_FRIO", "CAMION_PAQUETERO"]

function normPatente(p: string) {
  return p.replace(/\s+/g, "").toUpperCase()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
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
        FROM proveedores p
        INNER JOIN camiones c ON c.proveedor_id = p.id
        LEFT JOIN camion_fotos cf ON cf.camion_id = c.id
        WHERE p.empresa_id = @empresa_id
        ORDER BY c.created_at DESC, c.id DESC
      `)

    return NextResponse.json({ success: true, trucks: result.recordset })
  } catch (e) {
    console.error("[fleet][GET] error:", e)
    return NextResponse.json({ error: "Error al cargar flota" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const empresaId = Number(body?.empresaId)
    const camiones = body?.camiones

    if (!empresaId || Number.isNaN(empresaId)) {
      return NextResponse.json({ error: "empresaId es requerido" }, { status: 400 })
    }
    if (!Array.isArray(camiones) || camiones.length === 0) {
      return NextResponse.json({ error: "camiones es requerido" }, { status: 400 })
    }

    const pool = await getPool()

    // proveedor default para la empresa
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

    const insertedTrucks: Array<{ id: number; patente: string }> = []
    const duplicates: string[] = []

    for (const c of camiones) {
      const patente = normPatente(String(c?.patente ?? ""))
      const carroceria = String(c?.carroceria ?? "") as Carroceria
      const marca = c?.marca ? String(c.marca) : null
      const modelo = c?.modelo ? String(c.modelo) : null
      const anio = c?.anio === null || c?.anio === undefined || c?.anio === "" ? null : Number(c.anio)

      if (!patente) {
        continue
      }
      if (!ALLOWED.includes(carroceria)) {
        return NextResponse.json(
          { error: `carroceria inválida: ${carroceria}. Debe ser: ${ALLOWED.join(", ")}` },
          { status: 400 }
        )
      }

      // evitar duplicados por proveedor + patente
      const exists = await pool
        .request()
        .input("proveedor_id", sql.Int, proveedorId)
        .input("patente", sql.VarChar(15), patente)
        .query(`
          SELECT TOP 1 id FROM camiones
          WHERE proveedor_id = @proveedor_id AND patente = @patente
        `)

      if (exists.recordset.length > 0) {
        duplicates.push(patente)
        continue
      }

      const ins = await pool
        .request()
        .input("proveedor_id", sql.Int, proveedorId)
        .input("patente", sql.VarChar(15), patente)
        .input("marca", sql.VarChar(50), marca)
        .input("modelo", sql.VarChar(50), modelo)
        .input("anio", sql.Int, Number.isNaN(anio as any) ? null : anio)
        .input("tipo", sql.VarChar(20), "camion")
        .input("carroceria", sql.VarChar(30), carroceria)
        .query(`
          INSERT INTO camiones (proveedor_id, patente, marca, modelo, anio, tipo, carroceria)
          OUTPUT INSERTED.id
          VALUES (@proveedor_id, @patente, @marca, @modelo, @anio, @tipo, @carroceria)
        `)

      insertedTrucks.push({ id: ins.recordset[0].id, patente })
    }

    return NextResponse.json({
      success: true,
      proveedorId,
      insertedTrucks,
      duplicates,
    })
  } catch (e) {
    console.error("[fleet][POST] error:", e)
    return NextResponse.json({ error: "Error al registrar flota" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const truckId = Number(body?.truckId)

    if (!truckId || Number.isNaN(truckId)) {
      return NextResponse.json({ error: "truckId es requerido" }, { status: 400 })
    }

    const marca = body?.marca === "" ? null : (body?.marca ?? null)
    const modelo = body?.modelo === "" ? null : (body?.modelo ?? null)
    const anioRaw = body?.anio
    const anio = anioRaw === "" || anioRaw === null || anioRaw === undefined ? null : Number(anioRaw)
    const carroceria = body?.carroceria ?? null

    if (carroceria && !ALLOWED.includes(carroceria)) {
      return NextResponse.json(
        { error: `carroceria inválida: ${carroceria}. Debe ser: ${ALLOWED.join(", ")}` },
        { status: 400 }
      )
    }

    const pool = await getPool()

    await pool
      .request()
      .input("id", sql.Int, truckId)
      .input("marca", sql.VarChar(50), marca)
      .input("modelo", sql.VarChar(50), modelo)
      .input("anio", sql.Int, Number.isNaN(anio as any) ? null : anio)
      .input("carroceria", sql.VarChar(30), carroceria)
      .query(`
        UPDATE camiones
        SET
          marca = @marca,
          modelo = @modelo,
          anio = @anio,
          carroceria = COALESCE(@carroceria, carroceria)
        WHERE id = @id
      `)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[fleet][PUT] error:", e)
    return NextResponse.json({ error: "Error al actualizar camión" }, { status: 500 })
  }
}
