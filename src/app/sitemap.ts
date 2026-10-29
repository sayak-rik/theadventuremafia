import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";
import { TREKS } from "@/data/treks";
import { querySitemapEntries } from "@/lib/listings/public-queries";

// Reads the database, so it must not be prerendered at build time (the Docker build has no DB).
export const dynamic = "force-dynamic";

const STATIC_ROUTES = ["", "/adventures", "/partner", "/itinerary", "/pricing", "/booking", "/testimonials", "/rewards", "/contact", "/terms", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [
    ...STATIC_ROUTES.map((path) => ({ url: `${SITE.url}${path}`, lastModified: now, changeFrequency: "monthly" as const, priority: path === "" ? 1 : 0.6 })),
    ...TREKS.map((t) => ({ url: `${SITE.url}/adventures/${t.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];

  try {
    const entries = await querySitemapEntries();
    const latest = (pick: (e: (typeof entries)[number]) => string, key: string) =>
      entries.filter((e) => pick(e) === key).reduce((m, e) => (e.updatedAt > m ? e.updatedAt : m), new Date(0));
    const categories = [...new Set(entries.map((e) => e.categorySlug))];
    const categoryRegions = [...new Set(entries.map((e) => `${e.categorySlug}/${e.regionSlug}`))];
    const companies = [...new Set(entries.map((e) => e.companySlug))];

    for (const c of categories) out.push({ url: `${SITE.url}/adventures/${c}`, lastModified: latest((e) => e.categorySlug, c), changeFrequency: "daily", priority: 0.9 });
    for (const cr of categoryRegions) {
      const [cat, region] = cr.split("/");
      const lm = entries.filter((e) => e.categorySlug === cat && e.regionSlug === region).reduce((m, e) => (e.updatedAt > m ? e.updatedAt : m), new Date(0));
      out.push({ url: `${SITE.url}/adventures/${cr}`, lastModified: lm, changeFrequency: "daily", priority: 0.8 });
    }
    for (const c of companies) out.push({ url: `${SITE.url}/companies/${c}`, lastModified: latest((e) => e.companySlug, c), changeFrequency: "weekly", priority: 0.7 });
    for (const e of entries) out.push({ url: `${SITE.url}/companies/${e.companySlug}/${e.listingSlug}`, lastModified: e.updatedAt, changeFrequency: "weekly", priority: 0.8 });
  } catch (err) {
    // No database (or it's down): still serve the static pages rather than a 500 that Search Console would flag.
    console.warn("sitemap: marketplace entries unavailable:", (err as { code?: string }).code ?? "error");
  }
  return out;
}
