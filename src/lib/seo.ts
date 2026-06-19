// JSON-LD structured-data builders. These power Google rich results
// (ratings, trip/offer info, FAQ, breadcrumbs) for the tour.

import { SITE } from "@/data/site";

const abs = (path = "") => `${SITE.url}${path}`;
const INSTAGRAM = "https://instagram.com/thebikersmafia";

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    logo: abs("/logo.svg"),
    image: abs("/og.png"),
    description: SITE.description,
    email: SITE.email,
    telephone: SITE.phone,
    priceRange: "₹₹₹",
    areaServed: { "@type": "Place", name: "Sikkim, India" },
    address: { "@type": "PostalAddress", addressRegion: "Sikkim", addressCountry: "IN" },
    sameAs: [INSTAGRAM],
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    name: SITE.name,
    url: SITE.url,
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
  };
}

export function touristTripLd(opts?: {
  rating?: { value: string; count: number };
  stops?: readonly string[];
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: "Untouched West Sikkim Expedition",
    description:
      "A premium 7-day guided Royal Enfield motorcycle expedition through West and North Sikkim — Pelling, Yuksom, Lachen and Gurudongmar Lake (4,441 m). Limited Sunday departures, September–May.",
    url: abs("/itinerary"),
    image: abs("/og.png"),
    touristType: ["Motorcycle touring", "Adventure travel"],
    provider: {
      "@type": "TravelAgency",
      name: SITE.name,
      url: SITE.url,
      telephone: SITE.phone,
      email: SITE.email,
    },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: "37000",
      highPrice: "55000",
      offerCount: "6",
      availability: "https://schema.org/InStock",
      url: abs("/booking"),
    },
  };
  if (opts?.stops?.length) {
    data.itinerary = {
      "@type": "ItemList",
      numberOfItems: opts.stops.length,
      itemListElement: opts.stops.map((name, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name,
      })),
    };
  }
  if (opts?.rating) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: opts.rating.value,
      reviewCount: String(opts.rating.count),
      bestRating: "5",
      worstRating: "1",
    };
  }
  return data;
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}
