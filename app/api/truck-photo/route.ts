import { NextRequest, NextResponse } from "next/server";
import { getPool, sql } from "@/lib/azure-sql";
import { requireCliente } from "@/lib/shared/security/cliente-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const cliente = requireCliente(req);
    if (!cliente) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const camionId = Number(body?.camionId);
    const url = String(body?.url ?? "").trim();

    if (!camionId || Number.isNaN(camionId)) {
      return NextResponse.json({ error: "camionId es requerido" }, { status: 400 });
    }
    if (!url) return NextResponse.json({ error: "url es requerida" }, { status: 400 });
    if (url.length > 500) return NextResponse.json({ error: "url demasiado larga (máx 500)" }, { status: 400 });

    const pool = await getPool();

    // ✅ validar que el camión pertenezca a la empresa del cliente
    const owns = await pool
      .request()
      .input("camionId", sql.Int, camionId)
      .input("empresaId", sql.Int, cliente.empresaId)
      .query(`
        SELECT TOP 1 c.id
        FROM camiones c
        INNER JOIN proveedores p ON p.id = c.proveedor_id
        WHERE c.id = @camionId
          AND p.empresa_id = @empresaId
      `);

    if (owns.recordset.length === 0) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // UPSERT (camion_id UNIQUE)
    await pool
      .request()
      .input("camion_id", sql.Int, camionId)
      .input("url", sql.VarChar(500), url)
      .query(`
        IF EXISTS (SELECT 1 FROM camion_fotos WHERE camion_id = @camion_id)
        BEGIN
          UPDATE camion_fotos SET url = @url WHERE camion_id = @camion_id
        END
        ELSE
        BEGIN
          INSERT INTO camion_fotos (camion_id, url) VALUES (@camion_id, @url)
        END
      `);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[truck-photo][POST] error:", e);
    return NextResponse.json({ error: "Error guardando foto" }, { status: 500 });
  }
}
