import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView, browseMetadata, type BrowseParams } from "@/components/marketplace/BrowseView";

export const dynamic = "force-dynamic";
type Params = { slug: string; region: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, region } = await params;
  const m = await browseMetadata(slug, region);
  if (!m) return { title: "Not found", robots: { index: false } };
  return { title: m.title, description: m.description, alternates: { canonical: m.canonical }, robots: m.hasListings ? undefined : { index: false, follow: true } };
}

export default async function CategoryRegionPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<BrowseParams> }) {
  const { slug, region } = await params;
  if (!(await browseMetadata(slug, region))) notFound();
  return <BrowseView categorySlug={slug} regionSlug={region} search={await searchParams} />;
}
