"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home,
  ClipboardList,
  History,
  Truck,
  User,
  LogOut as LogOutIcon,
} from "lucide-react";
import { cn } from "@/lib/utils-cn";
import { useState, useEffect, useRef } from "react";

interface InspectorLayoutProps {
  children: React.ReactNode;
}

export default function InspectorLayout({ children }: InspectorLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const navItems = [
    {
      href: "/inspector",
      icon: Home,
      label: "Inicio",
      active: pathname === "/inspector",
    },
    {
      href: "/inspector/monitoreo",
      icon: ClipboardList,
      label: "Monitoreo",
      active: pathname === "/inspector/monitoreo",
    },
    {
      href: "/inspector/historial",
      icon: History,
      label: "Historial",
      active: pathname === "/inspector/historial",
    },
  ];

  

  // Cerrar menú de perfil al tocar fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/staff/logout", { method: "POST" });
    } catch {
      // Continuar con redirección aunque falle la petición
    }
    // Forzar recarga completa para limpiar cache del cliente
    // Redirigir al landing page, no al login
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 bg-neutral-900 border-b border-neutral-800 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Truck className="h-6 w-6 text-red-600" />
            <h1 className="text-lg font-bold text-white tracking-tight">Petran</h1>
          </div>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center text-white font-bold hover:from-red-700 hover:to-red-800 transition-all active:scale-95 min-w-[44px] min-h-[44px]"
            >
              J
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-neutral-200 rounded-2xl shadow-lg z-[60] overflow-hidden">
                <Link
                  href="/inspector/ajustes"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 active:bg-neutral-100 border-b border-neutral-200 min-h-[48px]"
                >
                  <User className="h-4 w-4 text-neutral-600" />
                  <span className="text-sm font-medium text-neutral-700">
                    Mi Perfil
                  </span>
                </Link>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 active:bg-red-50 text-red-600 font-medium text-sm min-h-[48px]"
                >
                  <LogOutIcon className="h-4 w-4" />
                  Cerrar Sesion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content — pb-24 para que el BottomNav no tape contenido */}
      <main className="min-h-screen pt-16 pb-24">{children}</main>

      {/* Bottom Navigation - Mobile
          safe-area-inset para iOS Safari (zona inferior del notch)
          z-50 igual que header para mantener consistencia */}
      <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 px-2 pb-[env(safe-area-inset-bottom)] z-50 md:hidden">
        <div className="flex items-center justify-around py-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-all min-w-[64px] min-h-[48px]",
                item.active
                  ? "text-red-500"
                  : "text-neutral-400 hover:text-white active:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "h-6 w-6 mb-1",
                  item.active && "stroke-[2.5px]"
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  item.active && "font-semibold"
                )}
              >
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
