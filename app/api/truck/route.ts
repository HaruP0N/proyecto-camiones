import { NextResponse } from "next/server"
import { getPool } from "@/lib/azure-sql"

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
      .input("empresa_id", empresaId)
      .query(`
        SELECT c.id, c.patente
        FROM camiones c
        INNER JOIN proveedores p ON p.id = c.proveedor_id
        WHERE p.empresa_id = @empresa_id
        ORDER BY c.created_at DESC
      `)

    return NextResponse.json({ success: true, trucks: result.recordset })
  } catch (e) {
    console.error("[trucks] error:", e)
    return NextResponse.json({ error: "Error al obtener camiones" }, { status: 500 })
  }
}
