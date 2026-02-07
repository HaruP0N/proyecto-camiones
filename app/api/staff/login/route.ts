import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPool } from "@/lib/azure-sql";

export const runtime = "nodejs";

function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

function normalizeRole(r: unknown) {
  return String(r ?? "").trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    }

    const emailRaw = (body as any).email;
    const passwordRaw = (body as any).password;

    if (typeof emailRaw !== "string" || typeof passwordRaw !== "string") {
      return NextResponse.json(
        { ok: false, error: "Email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(emailRaw);
    const password = passwordRaw;

    const pool = await getPool();

    const r = await pool
      .request()
      .input("email", email)
      .query(`
        SELECT TOP 1
          id,
          nombre,
          email,
          password_hash,
          rol,
          activo
        FROM dbo.usuarios
        WHERE LOWER(LTRIM(RTRIM(email))) = @email
      `);

    if (r.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Credenciales incorrectas" }, { status: 401 });
    }

    const u = r.recordset[0] as any;

    if (Number(u.activo) !== 1) {
      return NextResponse.json({ ok: false, error: "Usuario inactivo" }, { status: 403 });
    }

    const rol = normalizeRole(u.rol);

    // SOLO admin / inspector
    if (rol !== "admin" && rol !== "inspector") {
      return NextResponse.json({ ok: false, error: "Rol no permitido" }, { status: 403 });
    }

    const match = bcrypt.compareSync(password, u.password_hash);
    if (!match) {
      return NextResponse.json({ ok: false, error: "Credenciales incorrectas" }, { status: 401 });
    }

    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "Falta configurar ADMIN_JWT_SECRET" },
        { status: 500 }
      );
    }

    const token = jwt.sign({ sub: u.id, rol }, secret, { expiresIn: "7d" });

    const res = NextResponse.json({
      ok: true,
      user: { id: u.id, nombre: u.nombre, email: u.email, rol },
    });

    res.cookies.set("petran_staff", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    // limpiar cookie vieja si existía
    res.cookies.set("petran_admin", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (err) {
    console.error("POST /api/staff/login error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
