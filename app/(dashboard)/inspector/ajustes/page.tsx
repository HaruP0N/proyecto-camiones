"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import {
  User,
  Mail,
  Phone,
  Lock,
  Bell,
  Moon,
  Globe,
  HelpCircle,
  LogOut,
  ChevronRight,
  Shield,
  Smartphone,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils-cn";

interface Inspector {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
}

export default function AjustesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [inspector, setInspector] = useState<Inspector | null>(null);
  const [notificaciones, setNotificaciones] = useState(true);
  const [modoOscuro, setModoOscuro] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/inspector/me");
        if (res.ok) {
          const data = await res.json();
          setInspector(data.data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/staff/logout", {
        method: "POST",
        credentials: "include",
      });
      router.replace("/");
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "No se pudo cerrar sesión",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner className="h-10 w-10 text-red-600" />
      </div>
    );
  }

  const menuSections = [
    {
      title: "Cuenta",
      items: [
        {
          icon: User,
          label: "Perfil",
          description: "Editar información personal",
          href: "#",
        },
        {
          icon: Lock,
          label: "Cambiar Contraseña",
          description: "Actualizar tu contraseña",
          href: "#",
        },
        {
          icon: Shield,
          label: "Seguridad",
          description: "Configuración de seguridad",
          href: "#",
        },
      ],
    },
    {
      title: "Preferencias",
      items: [
        {
          icon: Bell,
          label: "Notificaciones",
          description: notificaciones ? "Activadas" : "Desactivadas",
          toggle: true,
          value: notificaciones,
          onChange: () => setNotificaciones(!notificaciones),
        },
        {
          icon: Moon,
          label: "Modo Oscuro",
          description: modoOscuro ? "Activado" : "Desactivado",
          toggle: true,
          value: modoOscuro,
          onChange: () => setModoOscuro(!modoOscuro),
        },
        {
          icon: Globe,
          label: "Idioma",
          description: "Español",
          href: "#",
        },
      ],
    },
    {
      title: "Soporte",
      items: [
        {
          icon: HelpCircle,
          label: "Centro de Ayuda",
          description: "Preguntas frecuentes",
          href: "#",
        },
        {
          icon: Smartphone,
          label: "Acerca de",
          description: "Versión 1.0.0",
          href: "#",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header Corregido para top-16 */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-16 z-40">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-white">Ajustes</h1>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-white">
                {inspector?.nombre?.charAt(0) || "I"}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-neutral-900 truncate">
                {inspector?.nombre || "Inspector"}
              </h2>
              <p className="text-sm text-neutral-500 truncate">
                {inspector?.email || "inspector@petran.cl"}
              </p>
              <p className="text-xs text-red-600 font-medium">
                ID: {inspector?.id || "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Menu Sections */}
        {menuSections.map((section, sectionIdx) => (
          <div key={sectionIdx}>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3 px-1">
              {section.title}
            </h3>

            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              {section.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  onClick={() => {
                    if (item.toggle && item.onChange) {
                      item.onChange();
                    } else if (item.href) {
                      // Navigate
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50 transition-colors",
                    itemIdx !== section.items.length - 1 &&
                      "border-b border-neutral-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-neutral-600" />
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">{item.label}</p>
                      <p className="text-xs text-neutral-500">{item.description}</p>
                    </div>
                  </div>

                  {item.toggle ? (
                    <button
                      className={cn(
                        "w-12 h-7 rounded-full transition-colors relative",
                        item.value ? "bg-red-500" : "bg-neutral-200"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all",
                          item.value ? "right-1" : "left-1"
                        )}
                      />
                    </button>
                  ) : (
                    <ChevronRight className="h-5 w-5 text-neutral-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-white rounded-2xl border border-red-200 p-4 flex items-center justify-center gap-3 text-red-600 font-semibold hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </button>

        {/* Version */}
        <p className="text-center text-xs text-neutral-400 py-4">
          PETRAN Inspector v1.0.0
        </p>
      </div>
    </div>
  );
}