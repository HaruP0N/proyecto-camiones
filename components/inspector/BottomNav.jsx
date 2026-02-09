"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, History } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const base = "/inspector";

  const tabs = [
    { path: `${base}`, label: "Inicio", Icon: Home },
    { path: `${base}/historial`, label: "Historial", Icon: History },
  ];

  const isActive = (path) => {
    const current = pathname || "";

    if (path === `${base}`) return current === `${base}`;

    return current === path;
  };

  const isLogin = pathname?.includes("/login");

  // Modo flujo (validación -> inspección -> resumen)
  const isFlow =
    pathname?.startsWith(`${base}/validacion-identidad`) ||
    pathname?.startsWith(`${base}/inspeccion`) ||
    pathname?.startsWith(`${base}/resumen-firma`);

  if (isLogin) return null;

  const stepIndex = (() => {
    if (pathname?.startsWith(`${base}/resumen-firma`)) return 2;
    if (pathname?.startsWith(`${base}/inspeccion`)) return 1;
    if (pathname?.startsWith(`${base}/validacion-identidad`)) return 0;
    return -1;
  })();

  const steps = [
    { label: "Validar", path: `${base}/validacion-identidad` },
    { label: "Inspección", path: `${base}/inspeccion/criticos` },
    { label: "Resumen", path: `${base}/resumen-firma` },
  ];

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-50
        bg-white/95 backdrop-blur-xl
        border-t border-gray-200
        pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3
        shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]
      "
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {!isFlow ? (
        <div className="max-w-lg mx-auto px-6">
          <div className="grid grid-cols-2 gap-1">
            {tabs.map((tab) => {
              const active = isActive(tab.path);
              const Icon = tab.Icon;

              return (
                <button
                  key={tab.path}
                  onClick={() => router.push(tab.path)}
                  className={`
                    relative h-14 rounded-2xl flex flex-col items-center justify-center gap-1.5
                    transition-all duration-300 ease-out group
                    ${active ? 'text-[#7f1d1d]' : 'text-gray-400 hover:text-gray-600'}
                  `}
                >
                  {active && (
                    <span className="absolute inset-0 bg-[#7f1d1d]/8 rounded-2xl -z-10 animate-in fade-in zoom-in-95 duration-200" />
                  )}

                  <Icon 
                    className={`w-6 h-6 transition-transform duration-300 ${active ? 'scale-110 stroke-[2.5px]' : 'scale-100 stroke-2'}`} 
                  />
                  <span className={`text-[10px] font-bold leading-none tracking-wide ${active ? 'opacity-100' : 'opacity-80'}`}>
                    {tab.label}
                  </span>
                  {active && (
                    <span className="absolute -top-1 w-1.5 h-1.5 bg-[#7f1d1d] rounded-full shadow-sm" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="max-w-xl mx-auto px-6 py-1">
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => {
              const done = stepIndex > idx;
              const current = stepIndex === idx;
              return (
                <div key={s.label} className="flex-1 flex flex-col items-center">
                  <div
                    className={`
                      w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold
                      transition-all duration-300
                      ${done ? 'bg-[#7f1d1d] text-white' : current ? 'border-2 border-[#7f1d1d] text-[#7f1d1d]' : 'border border-gray-300 text-gray-400'}
                    `}
                  >
                    {done ? '✓' : idx + 1}
                  </div>
                  <span className={`mt-1 text-[10px] font-semibold ${current ? 'text-[#7f1d1d]' : 'text-gray-500'}`}>
                    {s.label}
                  </span>
                  {idx < steps.length - 1 && (
                    <div className="h-1 w-full bg-gray-200 rounded-full mt-2">
                      <div
                        className="h-1 bg-[#7f1d1d] rounded-full transition-all duration-300"
                        style={{ width: done ? '100%' : current ? '50%' : '0%' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
