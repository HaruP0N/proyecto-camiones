"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Icon components (replace with your own SVG or icon library as needed)
function HomeIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path d="M3 12l9-9 9 9" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 21V13h6v8" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="7" width="18" height="13" stroke="#111827" strokeWidth="2" rx="2"/>
      <path d="M9 21V13h6v8" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="7" y="10" width="3" height="3" stroke="#111827" strokeWidth="1.5" rx="0.5"/>
      <rect x="14" y="10" width="3" height="3" stroke="#111827" strokeWidth="1.5" rx="0.5"/>
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <rect x="5" y="4" width="14" height="18" rx="2" stroke="#111827" strokeWidth="2"/>
      <path d="M9 2h6v4H9V2z" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Add UserIcon definition
function UserIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" stroke="#111827" strokeWidth="2" />
      <path d="M4 20c0-4 4-7 8-7s8 3 8 7" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Corrige la definición del componente para aceptar subtitle
export default function AdminShell({
  title,
  subtitle, // <-- Agregado
  children,
}: {
  title: string;
  subtitle?: string; // <-- Agregado
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const INSPECCIONES_HREF = "/admin/inspecciones";

  const items = [
    { href: "/admin", label: "Inicio", icon: <HomeIcon /> },
    { href: "/admin/inspectores", label: "Inspectores", icon: <UserIcon /> },
    { href: "/admin/empresas", label: "Empresas", icon: <BuildingIcon /> },
    { href: INSPECCIONES_HREF, label: "Inspecciones", icon: <ClipboardIcon /> },
  ];

  const [openUser, setOpenUser] = useState(false);
  const userRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!openUser) return;
      const el = userRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpenUser(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenUser(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openUser]);

  function go(href: string) {
    setOpenUser(false);
    router.push(href);
  }

  async function logout() {
    setOpenUser(false);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // Continuar con la redireccion aunque falle
    }
    window.location.href = "/";
  }

  const userMenu = [
    { label: "Mi perfil", icon: <UserIcon />, onClick: () => go("/admin/perfil") },
    { label: "Editar perfil", icon: <EditIcon />, onClick: () => go("/admin/perfil/editar") },
    { label: "Imbox", icon: <InboxIcon />, onClick: () => go("/admin/imbox") },
    { label: "Help", icon: <HelpIcon />, onClick: () => go("/admin/help") },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: "100vh" }}>
      {/* SIDEBAR */}
      <aside
        style={{
          background: "linear-gradient(180deg, #0b1220 0%, #0b1220 20%, #0a1020 100%)",
          padding: 22,
        }}
      >
        <div style={{ color: "white", fontWeight: 900, fontSize: 28, marginBottom: 18 }}>
          Petran · Admin
        </div>

        <nav style={{ display: "grid", gap: 14, marginTop: 10 }}>
          {items.map((it) => {
            const active = pathname === it.href || (it.href !== "/admin" && pathname?.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                style={{
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 18px",
                  borderRadius: 14,
                  fontWeight: 900,
                  fontSize: 18,
                  color: "white",
                  background: active ? "#DC2626" : "rgba(255,255,255,0.06)",
                  border: active ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: active ? "0 10px 24px rgba(220,38,38,0.22)" : "none",
                }}
              >
                <span style={{ width: 22, height: 22, display: "inline-flex" }}>{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* CONTENT */}
      <main style={{ background: "#f3f4f6" }}>
        <div style={{ padding: 24 }}>
          <div
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: "18px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
              position: "relative",
            }}
          >
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#111827" }}>{title}</div>
              {subtitle && (
                <div style={{ fontSize: 16, color: "#6b7280", marginTop: 4 }}>{subtitle}</div>
              )}
            </div>
            <div ref={userRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setOpenUser((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={openUser}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid #e5e7eb",
                  background: "#f3f4f6",
                  borderRadius: 999,
                  padding: "6px 10px 6px 6px",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    color: "#111827",
                  }}
                >
                  U
                </div>
                <ChevronDownIcon />
              </button>

              {openUser ? (
                <div
                  role="menu"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 58,
                    width: 240,
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    boxShadow: "0 14px 30px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                    zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid #e5e7eb",
                      fontWeight: 900,
                      color: "#111827",
                    }}
                  >
                    Usuario
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>Admin</div>
                  </div>

                  {userMenu.map((m) => (
                    <button key={m.label} type="button" onClick={m.onClick} style={menuBtn}>
                      <span style={{ width: 18, height: 18, display: "inline-flex" }}>{m.icon}</span>
                      {m.label}
                    </button>
                  ))}

                  <div style={{ height: 1, background: "#e5e7eb" }} />

                  <button
                    type="button"
                    onClick={logout}
                    style={{ ...menuBtn, color: "#DC2626", fontWeight: 900 }}
                  >
                    <span style={{ width: 18, height: 18, display: "inline-flex" }}>
                      <LogoutIcon />
                    </span>
                    Cerrar sesión
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

const menuBtn = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "12px 16px",
  background: "none",
  border: "none",
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
  cursor: "pointer",
  outline: "none",
  textAlign: "left" as const,
};

function ChevronDownIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path d="M6 9l6 6 6-6" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Add InboxIcon definition
function InboxIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="#111827" strokeWidth="2"/>
      <path d="M3 7l9 6 9-6" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Add EditIcon definition
function EditIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path d="M15.232 5.232a3 3 0 014.242 4.242l-9.192 9.192a3 3 0 01-1.414.828l-4.242 1.414 1.414-4.242a3 3 0 01.828-1.414l9.192-9.192z" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 7l1 1" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Add LogoutIcon definition
function LogoutIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path d="M16 17l5-5-5-5" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 12H9" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 19a7 7 0 1 1 0-14" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Add HelpIcon definition
function HelpIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="#111827" strokeWidth="2" />
      <path d="M12 16v-2a4 4 0 1 0-4-4" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="18" r="1" fill="#111827" />
    </svg>
  );
}