// app/api/admin/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      server: process.env.AZURE_SQL_SERVER!,
      database: process.env.AZURE_SQL_DATABASE!,
      options: { encrypt: true, trustServerCertificate: false },
    }).connect();
  }
  return poolPromise;
}

function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    }

    const emailRaw = body.email;
    const passwordRaw = body.password;

    if (typeof emailRaw !== "string" || typeof passwordRaw !== "string") {
      return NextResponse.json({ ok: false, error: "Email y password son obligatorios" }, { status: 400 });
    }

    const email = normalizeEmail(emailRaw);
    const password = passwordRaw;

    const pool = await getPool();
    const r = await pool.request()
      .input("email", sql.VarChar(255), email)
      .query(`
        SELECT TOP 1 id, nombre, email, password_hash, rol, activo
        FROM dbo.usuarios
        WHERE email = @email
      `);

    if (r.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Email o contraseña incorrectos" }, { status: 401 });
    }

    const u = r.recordset[0] as any;

    if (!u.activo) return NextResponse.json({ ok: false, error: "Usuario inactivo" }, { status: 403 });
    if (u.rol !== "admin") return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });

    const ok = bcrypt.compareSync(password, u.password_hash);
    if (!ok) return NextResponse.json({ ok: false, error: "Email o contraseña incorrectos" }, { status: 401 });

    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Falta configurar ADMIN_JWT_SECRET" }, { status: 500 });
    }

    const token = jwt.sign({ sub: u.id, rol: "admin" }, secret, { expiresIn: "7d" });

    const res = NextResponse.json({
      ok: true,
      user: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol },
    });

    res.cookies.set("petran_admin", token, {
      httpOnly: true,
      secure: true,
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

