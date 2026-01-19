import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!body?.empresaId) {
      return NextResponse.json({ error: "empresaId es requerido" }, { status: 400 })
    }

    if (!Array.isArray(body?.lots) || body.lots.length === 0) {
      return NextResponse.json({ error: "lots es requerido" }, { status: 400 })
    }

    // Aquí luego conectarás a Azure SQL y harás inserts en:
    // EmpresaCamion (empresaId, tipo, patente, ...)
    // Por ahora devolvemos OK para probar el flujo.
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
}
