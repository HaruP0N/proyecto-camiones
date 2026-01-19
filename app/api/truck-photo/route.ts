import { NextResponse } from "next/server"
import { getPool, sql } from "@/lib/azure-sql"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const camionId = Number(body?.camionId)
    const url = String(body?.url || "").trim()

    if (!camionId || Number.isNaN(camionId)) {
      return NextResponse.json({ error: "camionId es requerido" }, { status: 400 })
    }
    if (!url) {
      return NextResponse.json({ error: "url es requerida" }, { status: 400 })
    }

    const pool = await getPool()

    // Upsert: 1 foto por camion (camion_id UNIQUE)
    await pool
      .request()
      .input("camionId", sql.Int, camionId)
      .input("url", sql.VarChar(500), url)
      .query(`
        IF EXISTS (SELECT 1 FROM camion_fotos WHERE camion_id = @camionId)
        BEGIN
          UPDATE camion_fotos
          SET url = @url
          WHERE camion_id = @camionId
        END
        ELSE
        BEGIN
          INSERT INTO camion_fotos (camion_id, url)
          VALUES (@camionId, @url)
        END
      `)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[truck-photo][POST] error:", e)
    return NextResponse.json({ error: "Error al guardar foto" }, { status: 500 })
  }
}

// (Opcional) Obtener URL por camionId
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const camionId = Number(searchParams.get("camionId"))

    if (!camionId || Number.isNaN(camionId)) {
      return NextResponse.json({ error: "camionId es requerido" }, { status: 400 })
    }

    const pool = await getPool()
    const result = await pool
      .request()
      .input("camionId", sql.Int, camionId)
      .query(`
        SELECT TOP 1 url, created_at
        FROM camion_fotos
        WHERE camion_id = @camionId
        ORDER BY created_at DESC
      `)

    return NextResponse.json({
      success: true,
      photo: result.recordset?.[0] ?? null,
    })
  } catch (e) {
    console.error("[truck-photo][GET] error:", e)
    return NextResponse.json({ error: "Error al obtener foto" }, { status: 500 })
  }
}
