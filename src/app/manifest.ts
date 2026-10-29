import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";

// Lets customers (and operators) add the site to their phone's home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: "Adventure Mafia",
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#0e1a24",
    theme_color: "#0e1a24",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
