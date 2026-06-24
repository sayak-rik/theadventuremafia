import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";
import { TREKS } from "@/data/treks";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/adventures",
    "/itinerary",
    "/pricing",
    "/booking",
    "/testimonials",
    "/rewards",
    "/contact",
    "/terms",
    "/privacy",
    ...TREKS.map((t) => `/adventures/${t.slug}`),
  ];
  const now = new Date();
  return routes.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
