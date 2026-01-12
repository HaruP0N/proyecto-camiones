/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  // Esto ayuda a Vercel a forzar la salida correcta
  output: 'standalone', 
}

export default nextConfig
