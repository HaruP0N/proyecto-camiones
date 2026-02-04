"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    background: "#F3F4F6",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  } as React.CSSProperties,

  sidebar: {
    width: 260,
    background: "#1F2937",
    color: "white",
    padding: 20,
    boxSizing: "border-box",
    borderRight: "1px solid #374151",
  } as React.CSSProperties,

  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
    paddingBottom: 20,
    borderBottom: "1px solid #374151",
  } as React.CSSProperties,

  brand: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: -0.5,
    color: "white",
  } as React.CSSProperties,

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  } as React.CSSProperties,

  main: {
    flex: 1,
    padding: 24,
    boxSizing: "border-box",
    maxWidth: 1600,
    margin: "0 auto",
  } as React.CSSProperties,

  topBar: {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  } as React.CSSProperties,

  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#111827",
    letterSpacing: -0.5,
  } as React.CSSProperties,

  subt: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  } as React.CSSProperties,

  content: {
    minHeight: 400,
  } as React.CSSProperties,

  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "2px solid #E5E7EB",
    background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    color: "white",
    cursor: "pointer",
    userSelect: "none",
    transition: "all 0.2s",
  } as React.CSSProperties,

  menu: {
    position: "absolute",
    top: 54,
    right: 0,
    width: 260,
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
    overflow: "hidden",
    zIndex: 50,
  } as React.CSSProperties,

  menuHeader: {
    padding: 16,
    background: "#F9FAFB",
    borderBottom: "1px solid #E5E7EB",
  } as React.CSSProperties,

  menuName: {
    fontWeight: 700,
    color: "#111827",
    fontSize: 14,
  } as React.CSSProperties,

  menuSub: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  } as React.CSSProperties,

  menuItem: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "12px 16px",
    background: "white",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    color: "#374151",
    textDecoration: "none",
    transition: "background 0.15s",
  } as React.CSSProperties,

  menuDanger: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "12px 16px",
    background: "white",
    border: "none",
    borderTop: "1px solid #E5E7EB",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    color: "#DC2626",
    transition: "background 0.15s",
  } as React.CSSProperties,
};

function navItem(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 8,
    textDecoration: "none",
    color: active ? "white" : "#D1D5DB",
    background: active ? "#3B82F6" : "transparent",
    fontWeight: 600,
    fontSize: 14,
    transition: "all 0.2s",
  };
}

type MePayload = { nombre?: string | null; email?: string | null; role?: string | null };

function initialsFrom(name?: string | null, email?: string | null) {
  const src = (name && name.trim()) || (email && email.trim()) || "U";
  const parts = src.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

async function safeJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export default function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const items = useMemo(
    () => [
      { href: "/admin", label: "📊 Dashboard" },
      { href: "/admin/inspectores", label: "👥 Inspectores" },
      { href: "/admin/empresas", label: "🏢 Empresas" },
      { href: "/admin/camiones", label: "🚛 Inspecciones" },
    ],
    []
  );

  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<MePayload | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const tries = ["/api/staff/me", "/api/admin/me", "/api/me"];
      for (const url of tries) {
        try {
          const r = await fetch(url, { cache: "no-store", credentials: "include" });
          const j = await safeJson(r);
          if (!r.ok) continue;

          const payload = j && typeof j === "object" && "data" in j ? (j as any).data : j;
          if (payload && typeof payload === "object") {
            setMe({
              nombre: (payload as any).nombre ?? (payload as any).name ?? null,
              email: (payload as any).email ?? null,
              role: (payload as any).role ?? null,
            });
            return;
          }
        } catch {}
      }
      setMe(null);
    })();
  }, []);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!open) return;
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const logout = async () => {
    if (loggingOut) return;
    
    setLoggingOut(true);
    setOpen(false);

    try {
      // Intentar con el endpoint de staff
      await fetch("/api/staff/logout", { 
        method: "POST", 
        credentials: "include" 
      }).catch(() => {});

      // Intentar con endpoint de admin
      await fetch("/api/admin/logout", { 
        method: "POST", 
        credentials: "include" 
      }).catch(() => {});

      // Limpiar datos locales
      if (typeof window !== 'undefined') {
        try { localStorage.clear(); } catch {}
        try { sessionStorage.clear(); } catch {}
      }

      // Redirigir
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error durante logout:", error);
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = initialsFrom(me?.nombre ?? null, me?.email ?? null);

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.brandRow}>
          <div style={styles.brand}>Petran Admin</div>
        </div>

        <nav style={styles.nav}>
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              style={navItem(pathname === it.href)}
              onMouseOver={(e) => {
                if (pathname !== it.href) {
                  e.currentTarget.style.background = "#374151";
                  e.currentTarget.style.color = "white";
                }
              }}
              onMouseOut={(e) => {
                if (pathname !== it.href) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#D1D5DB";
                }
              }}
            >
              {it.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main style={styles.main}>
        <div style={styles.topBar}>
          <div>
            <div style={styles.title}>{title}</div>
            {subtitle ? <div style={styles.subt}>{subtitle}</div> : null}
          </div>

          <div style={{ position: "relative" }} ref={wrapRef}>
            <button
              type="button"
              style={styles.avatarBtn}
              onClick={() => setOpen((v) => !v)}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.4)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "none";
              }}
              aria-haspopup="menu"
              aria-expanded={open}
              title="Perfil"
            >
              {initials}
            </button>

            {open ? (
              <div style={styles.menu} role="menu">
                <div style={styles.menuHeader}>
                  <div style={styles.menuName}>{me?.nombre?.trim() || "Administrador"}</div>
                  <div style={styles.menuSub}>{me?.email?.trim() || "admin@petran.cl"}</div>
                </div>

                <Link
                  href="/admin/perfil"
                  style={styles.menuItem}
                  onClick={() => setOpen(false)}
                  onMouseOver={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "white")}
                >
                  Mi Perfil
                </Link>

                <button
                  type="button"
                  style={styles.menuDanger}
                  onClick={logout}
                  disabled={loggingOut}
                  onMouseOver={(e) => !loggingOut && (e.currentTarget.style.background = "#FEF2F2")}
                  onMouseOut={(e) => !loggingOut && (e.currentTarget.style.background = "white")}
                >
                  {loggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div style={styles.content}>{children}</div>
      </main>
    </div>
  );
}