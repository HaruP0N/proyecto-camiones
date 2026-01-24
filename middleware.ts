import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

function redirect(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

async function verifyJWT(token: string, secret: string) {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, secretKey);
  return payload as any;
}

function isPublicClientePath(pathname: string) {
  return (
    pathname === "/cliente" ||
    pathname === "/cliente/nuevo" ||
    pathname === "/cliente/ingresar"
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // =========================
  // STAFF (admin / inspector)
  // =========================
  if (pathname.startsWith("/admin") || pathname.startsWith("/inspector")) {
    const token = req.cookies.get("petran_staff")?.value;
    if (!token) return redirect(req, "/");

    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) return redirect(req, "/");

    try {
      const payload = await verifyJWT(token, secret);
      const rol = payload?.rol;

      if (pathname.startsWith("/admin")) {
        if (rol !== "admin") return redirect(req, "/");
      }

      if (pathname.startsWith("/inspector")) {
        if (rol !== "inspector") return redirect(req, "/");
      }

      return NextResponse.next();
    } catch {
      return redirect(req, "/");
    }
  }

  // =========================
  // CLIENTE (protege todo /cliente/* excepto público)
  // =========================
  if (pathname.startsWith("/cliente")) {
    // públicas
    if (isPublicClientePath(pathname)) return NextResponse.next();

    const token = req.cookies.get("petran_cliente")?.value;
    if (!token) return redirect(req, "/cliente/ingresar");

    const secret = process.env.CLIENTE_JWT_SECRET;
    if (!secret) return redirect(req, "/cliente/ingresar");

    try {
      const payload = await verifyJWT(token, secret);
      const empresaId = Number(payload?.empresaId);

      if (!Number.isInteger(empresaId) || empresaId <= 0) {
        return redirect(req, "/cliente/ingresar");
      }

      return NextResponse.next();
    } catch {
      return redirect(req, "/cliente/ingresar");
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/inspector/:path*", "/cliente/:path*"],
};
