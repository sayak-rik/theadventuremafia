// Central site/brand constants — single source of truth for nav, contact, SEO.

export const SITE = {
  name: "The Adventure Mafia",
  tagline: "Himalayan Adventures in West & North Sikkim",
  product: "Motorcycle Expeditions · Treks · Day Hikes",
  description:
    "Himalayan adventures across West and North Sikkim — a 7-day guided Royal Enfield expedition to Gurudongmar Lake, plus day treks and hikes around Pelling and Yuksom. Guided, with full local support.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "contact@theadventuremafia.com",
  phone: "+91 7003405268",
  whatsapp: "+91 7003405268",
  keywords: [
    "Sikkim adventure tours",
    "West Sikkim bike tour",
    "Sikkim treks and day hikes",
    "Rani Dhunga day trek Pelling",
    "Yuksom day hike",
    "Himalayan motorcycle expedition",
    "Gurudongmar Lake adventure",
    "Kanchenjunga view Sikkim",
  ],
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/adventures", label: "Adventures" },
  { href: "/pricing", label: "Pricing" },
  { href: "/testimonials", label: "Testimonials" },
  { href: "/rewards", label: "Refer & Earn" },
  { href: "/contact", label: "Contact" },
  { href: "/booking", label: "Book Now" },
] as const;

export const FOOTER_LINKS = [
  { href: "/adventures", label: "All Adventures" },
  { href: "/itinerary", label: "Motorcycle Expedition" },
  { href: "/adventures/rani-dhunga-day-trek", label: "Rani Dhunga Day Trek" },
  { href: "/adventures/yuksom-day-hike", label: "Yuksom Day Hike" },
  { href: "/pricing", label: "Pricing" },
  { href: "/testimonials", label: "Testimonials" },
  { href: "/rewards", label: "Refer & Earn" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
] as const;
