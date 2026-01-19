import { NextResponse } from "next/server"
import { getPool, sql } from "@/lib/azure-sql"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const camionId = Number(body?.camionId)
    const url = String(body?.url || "").trim()

    if (!camionId || Number.isNaN(camionId)) {
      return NextResponse.json({ error: "camionId es requerido y debe ser número" }, { status: 400 })
    }
    if (!url) {
      return NextResponse.json({ error: "url es requerida" }, { status: 400 })
    }

    const pool = await getPool()

    // UPSERT: 1 foto por camión (camion_id es UNIQUE)
    await pool
      .request()
      .input("camion_id", sql.Int, camionId)
      .input("url", sql.VarChar(500), url)
      .query(`
        IF EXISTS (SELECT 1 FROM camion_fotos WHERE camion_id = @camion_id)
        BEGIN
          UPDATE camion_fotos
          SET url = @url
          WHERE camion_id = @camion_id
        END
        ELSE
        BEGIN
          INSERT INTO camion_fotos (camion_id, url)
          VALUES (@camion_id, @url)
        END
      `)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[truck-photo] error:", e)
    return NextResponse.json({ error: "Error al guardar foto" }, { status: 500 })
  }
}
