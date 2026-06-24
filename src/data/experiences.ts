// Presentation-layer catalogue of every adventure we offer. Drives the
// homepage "Our Adventures" grid and the /adventures hub. The flagship
// motorcycle expedition links to its existing pages; treks link to their
// detail pages and pull live copy from src/data/treks.ts.

import { TREKS } from "./treks";

export type Experience = {
  kind: "expedition" | "trek";
  title: string;
  blurb: string;
  image: string;
  priceFrom: number; // INR
  priceUnit: string; // e.g. "per rider", "per person"
  priceSuffix?: string; // e.g. "+ taxi fare"
  href: string;
  duration: string;
  difficulty: string;
  badge?: string;
};

const EXPEDITION: Experience = {
  kind: "expedition",
  title: "Untouched West Sikkim Expedition",
  blurb:
    "Our flagship — seven days of guided Royal Enfield riding from the monasteries of Pelling to the icy shore of Gurudongmar Lake.",
  image:
    "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80",
  priceFrom: 37000,
  priceUnit: "per rider",
  href: "/itinerary",
  duration: "7 days",
  difficulty: "Guided · all levels",
  badge: "Flagship",
};

const TREK_EXPERIENCES: Experience[] = TREKS.map((t) => ({
  kind: "trek",
  title: t.name,
  blurb: t.tagline,
  image: t.heroImage,
  priceFrom: t.pricePerPerson,
  priceUnit: "per person",
  priceSuffix: t.taxiFareExtra ? "+ taxi fare" : undefined,
  href: `/adventures/${t.slug}`,
  duration: t.duration,
  difficulty: t.difficulty,
  badge: "Day trek",
}));

export const EXPERIENCES: Experience[] = [EXPEDITION, ...TREK_EXPERIENCES];
