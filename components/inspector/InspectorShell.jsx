"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { HeroUIProvider } from "@heroui/react";
import { iniciarSyncBackground } from "@/lib/inspector/sync";

const BottomNav = dynamic(() => import("@/components/inspector/BottomNav"), { ssr: false });

export default function InspectorShell({ children }) {
  useEffect(() => {
    iniciarSyncBackground();
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/inspector-sw.js", { scope: "/inspector" }).catch(() => {
        // silent: PWA opcional si falla
      });
    }
  }, []);

  return (
    <HeroUIProvider>
      <div
        className="min-h-screen bg-gray-50 pb-[calc(env(safe-area-inset-bottom)+96px)]"
        suppressHydrationWarning
      >
        {children}
        <BottomNav />
      </div>
    </HeroUIProvider>
  );
}
