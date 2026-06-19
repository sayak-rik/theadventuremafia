import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/itinerary", "/pricing", "/booking", "/testimonials", "/rewards", "/contact", "/terms", "/privacy"];
  const now = new Date();
  return routes.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
