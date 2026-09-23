import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HungryTales",
    short_name: "HungryTales",
    description: "Our food story. Every meal becomes a memory.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f2ea",
    theme_color: "#f7f2ea",
    icons: [
      { src: "/icon.jpg", sizes: "any", type: "image/jpeg" },
      { src: "/icon.jpg", sizes: "any", type: "image/jpeg", purpose: "maskable" },
    ],
  };
}
