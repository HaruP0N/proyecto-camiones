import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
import { requireAdmin } from "@/lib/shared/security/staff-auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

function parseIdFromResetPath(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  // .../admin/inspectores/{id}/reset-password
  const raw = parts[parts.length - 2] || "";
  const onlyDigits = raw.replace(/[^\d]/g, "");
  const n = Number(onlyDigits);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

    const id = parseIdFromResetPath(req);
    if (!id) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });

    const body = await req.json().catch(() => null);
    const newPassword = body?.newPassword?.toString();

    if (!newPassword || !newPassword.trim()) {
      return NextResponse.json({ ok: false, error: "newPassword requerido" }, { status: 400 });
    }

    const pool = await getPool();

    const ok = await pool.request().input("id", id).query(`
      SELECT TOP 1 id
      FROM dbo.usuarios
      WHERE id=@id AND LOWER(LTRIM(RTRIM(rol)))='inspector'
    `);
    if (ok.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Inspector no encontrado" }, { status: 404 });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await pool
      .request()
      .input("id", id)
      .input("password_hash", hash)
      .query(`UPDATE dbo.usuarios SET password_hash=@password_hash WHERE id=@id`);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/admin/inspectores/[id]/reset-password error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
