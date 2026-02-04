// app/admin/_components/AdminShell.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React from "react";

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    background: "#f6f7f9",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  } as React.CSSProperties,

  sidebar: {
    width: 260,
    background: "#111827",
    color: "white",
    padding: 16,
    boxSizing: "border-box",
  } as React.CSSProperties,

  brand: {
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 12,
    letterSpacing: 0.3,
  } as React.CSSProperties,

  hint: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 16,
    lineHeight: 1.4,
  } as React.CSSProperties,

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } as React.CSSProperties,

  main: {
    flex: 1,
    padding: 18,
    boxSizing: "border-box",
  } as React.CSSProperties,

  topBar: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "12px 14px",
    marginBottom: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  } as React.CSSProperties,

  title: { fontSize: 18, fontWeight: 900, color: "#111827" } as React.CSSProperties,
  subt: { fontSize: 12, color: "#6b7280", marginTop: 2 } as React.CSSProperties,

  content: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
  } as React.CSSProperties,

  // ✅ botón logout
  btnLogout: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    fontWeight: 800,
    cursor: "pointer",
    background: "white",
    color: "#111827",
    whiteSpace: "nowrap",
  } as React.CSSProperties,
};

function navItem(active: boolean): React.CSSProperties {
  return {
    display: "block",
    padding: "10px 12px",
    borderRadius: 10,
    textDecoration: "none",
    color: "white",
    background: active ? "#2563eb" : "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontWeight: 700,
  };
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

  const items = [
    { href: "/admin", label: "Inicio" },
    { href: "/admin/inspectores", label: "Inspectores" },
    { href: "/admin/empresas", label: "Empresas" },
    { href: "/admin/camiones", label: "Agenda (actual)" },
  ];

  const logout = async () => {
    try {
      await fetch("/api/staff/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/");
      router.refresh();
    }
  };

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>Petran · Admin</div>
        <div style={styles.hint}>
          Panel simple y guiado.
          <br />
          Ideal para operación diaria.
        </div>

        <nav style={styles.nav}>
          {items.map((it) => (
            <Link key={it.href} href={it.href} style={navItem(pathname === it.href)}>
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

          {/* ✅ Botón cerrar sesión */}
          <button type="button" style={styles.btnLogout} onClick={logout}>
            Cerrar sesión
          </button>
        </div>

        <div style={styles.content}>{children}</div>
      </main>
    </div>
  );
}
