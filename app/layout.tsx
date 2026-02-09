import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

// 1. Configuración correcta de las fuentes con variables CSS
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Registro de Empresas - Azure SQL",
  description: "Sistema de registro de empresas clientes con Azure SQL Database",
  generator: "v0.app",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#7f1d1d",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // 2. suppressHydrationWarning evita errores por extensiones del navegador
    <html lang="es" suppressHydrationWarning>
      <body
        // 3. Se aplican las variables de fuente aquí
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
