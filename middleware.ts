import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

function redirectToHome(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/";
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get("petran_staff")?.value;
  if (!token) return redirectToHome(req);

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) return redirectToHome(req);

  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);

    const rol = payload?.rol;

    if (pathname.startsWith("/admin")) {
      if (rol !== "admin") return redirectToHome(req);
    }

    if (pathname.startsWith("/inspector")) {
      if (rol !== "operador") return redirectToHome(req);
    }

    return NextResponse.next();
  } catch {
    return redirectToHome(req);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/inspector/:path*"],
};
