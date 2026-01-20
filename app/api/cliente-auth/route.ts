import { NextResponse } from "next/server"
import { getPool, sql } from "@/lib/azure-sql"
import { isValidPin, verifyPin } from "@/lib/pin"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const rut = String(body?.rut ?? "").trim()
    const pin = String(body?.pin ?? "").trim()

    if (!rut) return NextResponse.json({ error: "RUT es requerido" }, { status: 400 })
    if (!isValidPin(pin)) return NextResponse.json({ error: "PIN inválido (4 dígitos)" }, { status: 400 })

    const pool = await getPool()

    const result = await pool
      .request()
      .input("rut", sql.VarChar(20), rut)
      .query(`
        SELECT TOP 1 id, pin_hash
        FROM empresas
        WHERE rut = @rut
        ORDER BY created_at DESC
      `)

    const row = result.recordset?.[0]
    if (!row) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 })
    if (!row.pin_hash) return NextResponse.json({ error: "Esta empresa no tiene PIN configurado" }, { status: 400 })

    const ok = await verifyPin(pin, row.pin_hash)
    if (!ok) return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 })

    return NextResponse.json({ success: true, empresaId: row.id })
  } catch (e) {
    console.error("[cliente-auth] error:", e)
    return NextResponse.json({ error: "Error al validar acceso" }, { status: 500 })
  }
}
