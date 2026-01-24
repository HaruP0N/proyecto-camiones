import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getPool, sql } from "@/lib/azure-sql";
import { isValidPin, verifyPin } from "@/lib/shared/utils/pin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const rut = String(body?.rut ?? "").trim();
    const pin = String(body?.pin ?? "").trim();

    if (!rut) return NextResponse.json({ error: "RUT es requerido" }, { status: 400 });
    if (!isValidPin(pin)) return NextResponse.json({ error: "PIN inválido (4 dígitos)" }, { status: 400 });


console.log("AZURE_SQL_SERVER:", process.env.AZURE_SQL_SERVER);
console.log("AZURE_SQL_DATABASE:", process.env.AZURE_SQL_DATABASE);
console.log("AZURE_SQL_USER:", process.env.AZURE_SQL_USER);
console.log("Has AZURE_SQL_PASSWORD:", !!process.env.AZURE_SQL_PASSWORD);
console.log("NODE_ENV:", process.env.NODE_ENV);

    const pool = await getPool();

    const result = await pool
      .request()
      .input("rut", sql.VarChar(20), rut)
      .query(`
        SELECT TOP 1 id, pin_hash
        FROM empresas
        WHERE rut = @rut
        ORDER BY created_at DESC
      `);

    const row = result.recordset?.[0];
    if (!row) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    if (!row.pin_hash) return NextResponse.json({ error: "Esta empresa no tiene PIN configurado" }, { status: 400 });

    const ok = await verifyPin(pin, row.pin_hash);
    if (!ok) return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });

    const secret = process.env.CLIENTE_JWT_SECRET;
    if (!secret) return NextResponse.json({ error: "Falta configurar CLIENTE_JWT_SECRET" }, { status: 500 });

    const token = jwt.sign({ empresaId: Number(row.id) }, secret, { expiresIn: "7d" });

    const res = NextResponse.json({ success: true }); // ✅ ya no devolvemos empresaId

    res.cookies.set("petran_cliente", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (e) {
    console.error("[cliente/login] error:", e);
    return NextResponse.json({ error: "Error al validar acceso" }, { status: 500 });
  }
}
