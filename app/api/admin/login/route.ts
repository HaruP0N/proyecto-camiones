import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

function getSecret() {
  // ✅ ideal: STAFF_JWT_SECRET
  return process.env.STAFF_JWT_SECRET || process.env.ADMIN_JWT_SECRET || "";
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
        { ok: false, error: "Email y password son obligatorios" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(emailRaw);
    const password = passwordRaw;

    const secret = getSecret();
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "Falta configurar STAFF_JWT_SECRET (o ADMIN_JWT_SECRET)" },
        { status: 500 }
      );
    }

    const pool = await getPool();

    const r = await pool
      .request()
      .input("email", email)
      .query(`
        SELECT TOP 1 id, nombre, email, password_hash, rol, activo
        FROM dbo.usuarios
        WHERE LOWER(LTRIM(RTRIM(email))) = @email
      `);

    if (r.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Email o contraseña incorrectos" }, { status: 401 });
    }

    const u = r.recordset[0] as any;

    const activo = u?.activo === true || u?.activo === 1;
    if (!activo) {
      return NextResponse.json({ ok: false, error: "Usuario inactivo" }, { status: 403 });
    }

    // ✅ admin login: SOLO admins
    if (String(u?.rol).trim().toLowerCase() !== "admin") {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const hash = String(u?.password_hash ?? "");
    const passOk = await bcrypt.compare(password, hash);
    if (!passOk) {
      return NextResponse.json({ ok: false, error: "Email o contraseña incorrectos" }, { status: 401 });
    }

    // ✅ Token staff (cookie petran_staff)
    const token = jwt.sign({ sub: u.id, rol: "admin" }, secret, { expiresIn: "7d" });

    const res = NextResponse.json(
      { ok: true, user: { id: u.id, nombre: u.nombre, email: u.email, rol: "admin" } },
      { status: 200 }
    );

    // ✅ IMPORTANTE: secure depende del entorno (para localhost)
    res.cookies.set("petran_staff", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    console.error("POST /api/admin/login error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
