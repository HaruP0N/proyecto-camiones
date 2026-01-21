import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export type AdminSession = {
  adminId: number;
  rol: "admin";
};

export function getAdminSession(req: NextRequest): AdminSession | null {
  const token = req.cookies.get("petran_admin")?.value;
  if (!token) return null;

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret) as any;
    if (decoded?.rol !== "admin") return null;

    const adminId = Number(decoded?.sub);
    if (!Number.isInteger(adminId) || adminId <= 0) return null;

    return { adminId, rol: "admin" };
  } catch {
    return null;
  }
}
