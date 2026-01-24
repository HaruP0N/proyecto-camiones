import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export type StaffRole = "admin" | "inspector";

export type StaffSession = {
  userId: number;
  rol: StaffRole;
};

function normalizeRole(r: unknown): StaffRole | null {
  const x = String(r ?? "").trim().toLowerCase();
  if (x === "admin" || x === "inspector") return x;
  return null;
}

export function getStaffSession(req: NextRequest): StaffSession | null {
  const token = req.cookies.get("petran_staff")?.value;
  if (!token) return null;

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret) as any;

    const rol = normalizeRole(decoded?.rol);
    if (!rol) return null;

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
  return s.rol === "admin" ? s : null;
}

export function requireInspector(req: NextRequest): StaffSession | null {
  const s = getStaffSession(req);
  if (!s) return null;
  return s.rol === "inspector" ? s : null;
}
