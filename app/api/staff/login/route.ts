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
      connectionTimeout: 30000,
      requestTimeout: 30000,
    }).connect();
  }
  return poolPromise;
}

function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    // 🔍 Logs de diagnóstico (correctos)
    console.log("ENV server:", process.env.AZURE_SQL_SERVER);
    console.log("ENV db:", process.env.AZURE_SQL_DATABASE);
    console.log("ENV user:", process.env.AZURE_SQL_USER);
    console.log("ENV has password:", !!process.env.AZURE_SQL_PASSWORD);
    console.log("ENV node_env:", process.env.NODE_ENV);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Body inválido" },
        { status: 400 }
      );
    }

    const emailRaw = body.email;
    const passwordRaw = body.password;

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
      .input("email", sql.VarChar(255), email)
      .query(`
        SELECT TOP 1
          id,
          nombre,
          email,
          password_hash,
          rol,
          activo
        FROM dbo.usuarios
        WHERE email = @email
      `);

    if (r.recordset.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    const u = r.recordset[0] as any;

    // 🔒 Activo (Azure SQL suele devolver 0/1)
    if (Number(u.activo) !== 1) {
      return NextResponse.json(
        { ok: false, error: "Usuario inactivo" },
        { status: 403 }
      );
    }

    if (u.rol !== "admin" && u.rol !== "operador") {
      return NextResponse.json(
        { ok: false, error: "Rol no permitido" },
        { status: 403 }
      );
    }

    const match = bcrypt.compareSync(password, u.password_hash);
    if (!match) {
      return NextResponse.json(
        { ok: false, error: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "Falta configurar ADMIN_JWT_SECRET" },
        { status: 500 }
      );
    }

    const token = jwt.sign(
      { sub: u.id, rol: u.rol },
      secret,
      { expiresIn: "7d" }
    );

    const res = NextResponse.json({
      ok: true,
      user: {
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol,
      },
    });

    // 🍪 Cookie staff (local + prod)
    res.cookies.set("petran_staff", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    // (opcional) limpiar cookie antigua de admin si existiera
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
    return NextResponse.json(
      { ok: false, error: "Error interno" },
      { status: 500 }
    );
  }
}
