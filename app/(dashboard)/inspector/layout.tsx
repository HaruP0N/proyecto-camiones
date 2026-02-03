"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Home, ClipboardList, History, Truck, LogOut, User, LogOut as LogOutIcon } from "lucide-react";
import { cn } from "@/lib/utils-cn";
import { useState } from "react";

interface InspectorLayoutProps {
  children: React.ReactNode;
}

export default function InspectorLayout({ children }: InspectorLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

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

  const handleLogout = async () => {
    await fetch("/api/inspector/logout", { method: "POST" });
    router.push("/inspector/login");
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Top Header con Perfil Dropdown */}
      {/* CORRECCIÓN: z-50 para asegurar que siempre esté encima de los sub-headers */}
      <header className="fixed top-0 left-0 right-0 bg-neutral-900 border-b border-neutral-800 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-red-600" />
            <h1 className="text-lg font-bold text-white">Truck Checks</h1>
          </div>
          
          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center text-white font-bold hover:from-red-700 hover:to-red-800 transition-all"
            >
              J
            </button>
            
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg z-50">
                <Link
                  href="/inspector/ajustes"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 border-b border-neutral-200"
                >
                  <User className="h-4 w-4 text-neutral-600" />
                  <span className="text-sm font-medium text-neutral-700">Mi Perfil</span>
                </Link>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 text-red-600 font-medium text-sm"
                >
                  <LogOutIcon className="h-4 w-4" />
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-screen pt-16">
        {children}
      </main>

      {/* Bottom Navigation - Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 px-2 py-2 z-50 md:hidden">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-all",
                item.active
                  ? "text-red-500"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "h-6 w-6 mb-1",
                  item.active && "stroke-[2.5px]"
                )}
              />
              <span className={cn(
                "text-xs font-medium",
                item.active && "font-semibold"
              )}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}