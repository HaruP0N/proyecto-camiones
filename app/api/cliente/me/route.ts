// app/api/cliente/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("petran_cliente")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const secret = process.env.CLIENTE_JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Falta CLIENTE_JWT_SECRET" }, { status: 500 });
    }

    const decoded = jwt.verify(token, secret) as any;
    const empresaId = Number(decoded?.empresaId);

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, empresaId }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 401 });
  }
}
