import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Petran Inspect",
    short_name: "Petran",
    start_url: "/inspector",
    scope: "/inspector",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#7f1d1d",
    icons: [
      {
        src: "/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
