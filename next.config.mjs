/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ["@heroui/react", "@heroui/system", "@heroui/theme"],
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.100.83:3000",
    "http://192.168.100.83",
  ],

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: true,
  },
};

export default nextConfig;
