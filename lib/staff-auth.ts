import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export type StaffRole = "admin" | "operador";

export type StaffSession = {
  userId: number;
  rol: StaffRole;
};

export function getStaffSession(req: NextRequest): StaffSession | null {
  const token = req.cookies.get("petran_staff")?.value;
  if (!token) return null;

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret) as any;

    const rol = decoded?.rol as StaffRole;
    if (rol !== "admin" && rol !== "operador") return null;

    const userId = Number(decoded?.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    return { userId, rol };
  } catch {
    return null;
  }
}

export function requireAdmin(req: NextRequest): StaffSession | null {
  const s = getStaffSession(req);
  if (!s) return null;
  if (s.rol !== "admin") return null;
  return s;
}

export function requireOperador(req: NextRequest): StaffSession | null {
  const s = getStaffSession(req);
  if (!s) return null;
  if (s.rol !== "operador") return null;
  return s;
}
