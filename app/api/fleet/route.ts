import { NextResponse } from "next/server"
import { getPool, sql } from "@/lib/azure-sql"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const empresaId = Number(body?.empresaId)
    const lot = body?.lot

    if (!empresaId || Number.isNaN(empresaId)) {
      return NextResponse.json({ error: "empresaId es requerido" }, { status: 400 })
    }
    if (!lot?.carroceria) {
      return NextResponse.json({ error: "carroceria es requerida" }, { status: 400 })
    }
    if (!Array.isArray(lot?.patentes) || lot.patentes.length === 0) {
      return NextResponse.json({ error: "patentes es requerida" }, { status: 400 })
    }

    const pool = await getPool()

    // 1) Proveedor default (si no existe)
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

    // 2) Insert camiones
    const insertedIds: number[] = []
    const duplicates: string[] = []

    for (const raw of lot.patentes as string[]) {
      const patente = String(raw || "").trim().toUpperCase()
      if (!patente) continue

      // evita duplicados por proveedor+patente
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
        .input("marca", sql.VarChar(50), null)
        .input("modelo", sql.VarChar(50), null)
        .input("anio", sql.Int, null)
        .input("tipo", sql.VarChar(20), "camion")
        .input("carroceria", sql.VarChar(30), lot.carroceria)
        .query(`
          INSERT INTO camiones (proveedor_id, patente, marca, modelo, anio, tipo, carroceria)
          OUTPUT INSERTED.id
          VALUES (@proveedor_id, @patente, @marca, @modelo, @anio, @tipo, @carroceria)
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

// ✅ NUEVO: listar camiones por empresaId (JOIN proveedores → camiones)
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
        SELECT c.id, c.patente, c.marca, c.modelo, c.anio, c.carroceria
        FROM camiones c
        INNER JOIN proveedores p ON p.id = c.proveedor_id
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
