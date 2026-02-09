import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Definimos la estructura esperada del Token para tener autocompletado y seguridad
interface UserPayload {
  id: string | number;
  rol: "admin" | "inspector" | "cliente";
  empresaId?: string | number;
  [key: string]: any;
}

// Rutas que no requieren autenticación dentro de /cliente
const PUBLIC_CLIENTE_PATHS = [
  "/cliente",
  "/cliente/nuevo",
  "/cliente/ingresar"
];

async function verifyJWT(token: string, secret: string): Promise<UserPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as UserPayload;
  } catch (error) {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // -------------------------------------------------------------
  // 1. ZONA STAFF (Administradores e Inspectores)
  // -------------------------------------------------------------
  if (pathname.startsWith("/admin") || pathname.startsWith("/inspector")) {
    // Excluir login de la protección (si estuviera en estas rutas, aunque suelen estar fuera)
    if (pathname.includes("/login")) return NextResponse.next();

    const token = req.cookies.get("petran_staff")?.value;
    
    // Si no hay token, redirigir al home (login staff)
    if (!token) {
      const loginUrl = new URL(pathname.startsWith("/inspector") ? "/inspector/login" : "/", req.url);
      return NextResponse.redirect(loginUrl);
    }

    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      console.error("ERROR CRÍTICO: ADMIN_JWT_SECRET no definido en variables de entorno");
      return NextResponse.redirect(new URL(pathname.startsWith("/inspector") ? "/inspector/login" : "/", req.url));
    }

    const payload = await verifyJWT(token, secret);

    // Token inválido o expirado
    if (!payload) {
      return NextResponse.redirect(new URL(pathname.startsWith("/inspector") ? "/inspector/login" : "/", req.url));
    }

    // Control de Roles (RBAC)
    const rol = payload.rol;

    if (pathname.startsWith("/admin") && rol !== "admin") {
      // Un inspector intentando entrar a admin -> Lo mandamos a su dashboard
      return NextResponse.redirect(new URL("/inspector", req.url));
    }

    if (pathname.startsWith("/inspector") && rol !== "inspector" && rol !== "admin") {
       // Si un admin quiere ver inspector, a veces se permite. Si no, redirigir.
       // Aquí asumimos estricto: solo inspector entra a inspector.
       return NextResponse.redirect(new URL("/", req.url));
    }

    // Todo OK, permite el paso y adjunta headers si es necesario
    const res = NextResponse.next();
    // Opcional: Pasar datos al backend via headers
    res.headers.set("x-user-rol", rol);
    return res;
  }

  // -------------------------------------------------------------
  // 2. ZONA CLIENTES
  // -------------------------------------------------------------
  if (pathname.startsWith("/cliente")) {
    // Si es una ruta pública, dejar pasar
    if (PUBLIC_CLIENTE_PATHS.includes(pathname)) {
      return NextResponse.next();
    }

    const token = req.cookies.get("petran_cliente")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/cliente/ingresar", req.url));
    }

    const secret = process.env.CLIENTE_JWT_SECRET;
    if (!secret) {
      console.error("ERROR CRÍTICO: CLIENTE_JWT_SECRET no definido");
      return NextResponse.redirect(new URL("/cliente/ingresar", req.url));
    }

    const payload = await verifyJWT(token, secret);
    
    if (!payload) {
      return NextResponse.redirect(new URL("/cliente/ingresar", req.url));
    }

    // Validación extra para clientes: debe tener empresaId válido
    const empresaId = Number(payload.empresaId);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return NextResponse.redirect(new URL("/cliente/ingresar", req.url));
    }

    return NextResponse.next();
  }

  // Rutas no protegidas por este middleware
  return NextResponse.next();
}

// Configuración del Matcher optimizada
export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas que empiecen por:
     * - /admin
     * - /inspector
     * - /cliente
     */
    "/admin/:path*",
    "/inspector/:path*",
    "/cliente/:path*",
  ],
};
