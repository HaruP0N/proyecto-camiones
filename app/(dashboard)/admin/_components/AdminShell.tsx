"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const INSPECCIONES_HREF = "/admin/camiones";

  const items = [
    { href: "/admin", label: "Inicio", icon: <HomeIcon /> },
    { href: "/admin/inspectores", label: "Inspectores", icon: <UsersIcon /> },
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
    // Para prototipo: Limpiamos y redirigimos a la raíz
    router.push("/");
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
            <div style={{ fontSize: 26, fontWeight: 900, color: "#111827" }}>{title}</div>

            {/* USER DROPDOWN */}
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

const menuBtn: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  border: "none",
  background: "white",
  cursor: "pointer",
  textAlign: "left",
  fontWeight: 800,
  color: "#111827",
};

/* ===== Icons ===== */

function ChevronDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 10v11h14V10" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a3 3 0 0 1 0 5.74" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <path d="M8 12h8" />
      <path d="M8 16h8" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5 7l2-4h10l2 4" />
      <path d="M5 7v12h14V7" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.7 1.2-1.7 2.7" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M21 3v18" />
    </svg>
  );
}