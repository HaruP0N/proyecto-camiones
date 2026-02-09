"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Building2,
  ClipboardList,
  Users,
  ChevronDown,
  Inbox,
  Pencil,
  LogOut,
  HelpCircle,
} from "lucide-react";

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

  const INSPECCIONES_HREF = "/admin/inspecciones";

  const items = [
    { href: "/admin", label: "Inicio", icon: Home },
    { href: "/admin/inspectores", label: "Inspectores", icon: Users },
    { href: "/admin/empresas", label: "Empresas", icon: Building2 },
    { href: INSPECCIONES_HREF, label: "Inspecciones", icon: ClipboardList },
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
    { label: "Mi perfil", icon: Users, onClick: () => go("/admin/perfil") },
    { label: "Editar perfil", icon: Pencil, onClick: () => go("/admin/perfil/editar") },
    { label: "Imbox", icon: Inbox, onClick: () => go("/admin/imbox") },
    { label: "Help", icon: HelpCircle, onClick: () => go("/admin/help") },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <div className="grid grid-cols-[280px_minmax(0,1fr)]">
        {/* SIDEBAR */}
        <aside className="min-h-screen border-r border-white/10 bg-gradient-to-b from-[#0b0f1a] via-[#111827] to-[#0b0f1a] px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7f1d1d] text-white shadow-lg shadow-red-900/40">
              <span className="text-lg font-black">P</span>
            </div>
            <div>
              <div className="text-xl font-black tracking-tight">Petran</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60">
                Admin Console
              </div>
            </div>
          </div>

          <div className="mt-10 text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
            Navegación
          </div>

          <nav className="mt-4 grid gap-3">
            {items.map((it) => {
              const active =
                pathname === it.href || (it.href !== "/admin" && pathname?.startsWith(it.href));
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                    active
                      ? "border-white/20 bg-[#7f1d1d] text-white shadow-lg shadow-red-900/30"
                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                      active
                        ? "border-white/20 bg-white/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {it.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">
              Estado
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-white/80">Plataforma</div>
              <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                Online
              </span>
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="min-h-screen bg-[#f5f6f8] text-gray-900">
          <div className="px-10 py-8">
            <div className="relative rounded-[28px] bg-gradient-to-br from-gray-900 via-red-950 to-black p-8 text-white shadow-2xl shadow-black/30">
              <div className="absolute inset-0 overflow-hidden rounded-[28px]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_45%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(220,38,38,0.25),transparent_50%)]" />
              </div>

              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
                    Panel Ejecutivo
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-tight">{title}</div>
                  {subtitle ? (
                    <div className="mt-2 text-sm text-white/70">{subtitle}</div>
                  ) : null}
                </div>

                <div ref={userRef} className="relative z-20">
                  <button
                    type="button"
                    onClick={() => setOpenUser((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={openUser}
                    className="flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-white/90 backdrop-blur transition hover:bg-white/15"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-900 font-black">
                      U
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                        Admin
                      </div>
                      <div className="text-sm font-semibold">Usuario</div>
                    </div>
                    <ChevronDown className="h-5 w-5 text-white/70" />
                  </button>

                  {openUser ? (
                    <div
                      role="menu"
                      className="absolute right-0 top-14 z-50 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-2xl"
                    >
                      <div className="border-b border-gray-200 px-4 py-3">
                        <div className="text-sm font-bold">Usuario</div>
                        <div className="text-xs font-semibold text-gray-500">Admin</div>
                      </div>

                      {userMenu.map((m) => {
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.label}
                            type="button"
                            onClick={m.onClick}
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            <Icon className="h-4 w-4" />
                            {m.label}
                          </button>
                        );
                      })}

                      <div className="h-px bg-gray-200" />

                      <button
                        type="button"
                        onClick={logout}
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Cerrar sesión
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
