// Day-trek experiences. Editorial content lives here (mirrors itinerary.ts);
// bookable price/availability is also mirrored into the `treks` DB table and
// the SEED_TREKS fallback in src/lib/data.ts, both keyed by `slug`.

export type TrekStep = { label: string; detail: string };

export type TrekContent = {
  slug: string;
  name: string;
  tagline: string;
  pricePerPerson: number; // INR, per person
  taxiFareExtra: boolean; // true => "+ taxi fare" billed on the day
  priceNote?: string; // shown beside the price
  duration: string;
  difficulty: string;
  location: string;
  elevationOrDistance: string;
  availability: string;
  heroImage: string;
  gallery: string[];
  overview: string;
  highlights: string[];
  inclusions: string[];
  itinerary: TrekStep[];
};

export const TREKS: TrekContent[] = [
  {
    slug: "rani-dhunga-day-trek",
    name: "Rani Dhunga Day Trek",
    tagline: "A forest climb to a sacred stone above Pelling",
    pricePerPerson: 1200,
    taxiFareExtra: false,
    priceNote: "All-inclusive · per person",
    duration: "Full day (~4–5 hrs walking)",
    difficulty: "Moderate — steady uphill",
    location: "Pelling, West Sikkim",
    elevationOrDistance: "~3 hr ascent · 45 min descent",
    availability: "Available every day",
    heroImage:
      "https://images.unsplash.com/photo-1571401835393-8c5f35328320?auto=format&fit=crop&w=2000&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    ],
    overview:
      "Starting from Pelling, this day trek climbs steadily through dense, ancient forest to Rani Dhunga — a sacred rock that doubles as a historic boundary marker and a Buddhist pilgrimage site. From the top you get panoramic views of the Kanchenjunga range, the Dentam valley, the Indo-Nepal border peaks and the Barsey Rhododendron Sanctuary. After a picnic lunch at the summit you descend to the centuries-old Sangacholing Monastery before walking back into Pelling. A short ride on the Pelling Gondola is included.",
    highlights: [
      "Rani Dhunga — a sacred stone, historic boundary marker and pilgrimage site",
      "Panoramic Kanchenjunga range and Dentam valley vistas",
      "Views toward the Indo-Nepal border peaks and Barsey Rhododendron Sanctuary",
      "Sangacholing Monastery, one of the oldest in Sikkim",
      "A ride on the Pelling Gondola, included",
      "Native Himalayan birdlife along the forest trail",
    ],
    inclusions: [
      "Experienced local trek guide",
      "Pelling Gondola ride",
      "Trekking snacks and a picnic lunch at the summit",
      "Trekking bag (on loan)",
      "Water bottle (on loan)",
      "Gloves (on loan)",
    ],
    itinerary: [
      { label: "Morning · Pelling", detail: "Meet your guide in Pelling and set off on foot into the forest trail." },
      { label: "~3 hrs · The ascent", detail: "A steady uphill climb through dense ancient forest, with birdlife and opening mountain views." },
      { label: "Summit · Rani Dhunga", detail: "Reach the sacred rock for panoramic Kanchenjunga and Dentam valley views, then a picnic lunch." },
      { label: "Descent · Sangacholing", detail: "A 45-minute descent to Sangacholing Monastery, one of Sikkim's oldest." },
      { label: "Afternoon · Pelling", detail: "Walk back into Pelling, with a ride on the Pelling Gondola to round off the day." },
    ],
  },
  {
    slug: "yuksom-day-hike",
    name: "Yuksom Day Hike",
    tagline: "A guided day on the trails of Sikkim's first capital",
    pricePerPerson: 600,
    taxiFareExtra: true,
    priceNote: "+ taxi fare (shared, paid on the day)",
    duration: "Full day",
    difficulty: "Easy to moderate",
    location: "Yuksom, West Sikkim",
    elevationOrDistance: "Day hike · forest & village trails",
    availability: "Available every day",
    heroImage:
      "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=2000&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
    ],
    overview:
      "A relaxed guided day hike out of Yuksom — the first capital of Sikkim and the gateway to the Kanchenjunga trails. Wander forest and village paths past coronation sites, old monasteries and sacred lakes with your local guide, at an easy pace that suits most fitness levels. A great way to feel the quiet, historic heart of West Sikkim in a single day.",
    highlights: [
      "Yuksom — the historic first capital of Sikkim",
      "Forest and village trails at an easy pace",
      "Coronation throne, chortens and ancient monasteries nearby",
      "A flexible day hike, guided by a local",
    ],
    inclusions: [
      "Experienced local guide",
      "Small trekking bag (on loan)",
      "Water bottle (on loan)",
      "Trekking snacks",
    ],
    itinerary: [
      { label: "Morning · Yuksom", detail: "Meet your guide in Yuksom; transfer to the trailhead by shared taxi." },
      { label: "Daytime · The hike", detail: "A guided walk along forest and village trails, past historic and sacred sites, at an easy pace." },
      { label: "Lunch · On the trail", detail: "A break for trekking snacks with mountain and valley views." },
      { label: "Afternoon · Return", detail: "Return to Yuksom by shared taxi to wrap up the day." },
    ],
  },
];

export function getTrekContent(slug: string): TrekContent | undefined {
  return TREKS.find((t) => t.slug === slug);
}
