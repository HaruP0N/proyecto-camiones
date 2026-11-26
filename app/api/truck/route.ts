import { requireCliente } from "@/lib/shared/security/cliente-auth"
import { requireAdmin } from "@/lib/shared/security/staff-auth"
import { NextRequest, NextResponse } from "next/server"
import { getPool } from "@/lib/database"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const empresaId = Number(searchParams.get("empresaId"))

    if (!empresaId || Number.isNaN(empresaId)) {
      return NextResponse.json({ error: "empresaId es requerido" }, { status: 400 })
    }

    const cliente = requireCliente(req)
    if (!requireAdmin(req) && cliente?.empresaId !== empresaId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
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
