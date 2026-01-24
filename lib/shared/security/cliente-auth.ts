import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export type ClienteSession = {
  empresaId: number;
};

export function getClienteSession(req: NextRequest): ClienteSession | null {
  const token = req.cookies.get("petran_cliente")?.value;
  if (!token) return null;

  const secret = process.env.CLIENTE_JWT_SECRET;
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret) as any;

    const empresaId = Number(decoded?.empresaId);
    if (!Number.isInteger(empresaId) || empresaId <= 0) return null;

    return { empresaId };
  } catch {
    return null;
  }
}

export function requireCliente(req: NextRequest): ClienteSession | null {
  return getClienteSession(req);
}
