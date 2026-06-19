// Central site/brand constants — single source of truth for nav, contact, SEO.

export const SITE = {
  name: "The Adventure Mafia",
  tagline: "Untouched West Sikkim Expedition",
  product: "7-Day Guided Motorcycle Tour · West & North Sikkim",
  description:
    "A premium 7-day guided motorcycle expedition through the untouched trails of West and North Sikkim — Pelling, Yuksom, Lachen and Gurudongmar Lake. Limited Sunday departures, Sep–May.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "contact@theadventuremafia.com",
  phone: "+91 7003405268",
  whatsapp: "+91 7003405268",
  keywords: [
    "West Sikkim bike tour",
    "Pelling to Lachen expedition",
    "Himalayan motorcycle tour",
    "Kanchenjunga view Sikkim",
    "Gurudongmar Lake adventure",
    "Sikkim Sunday tours",
    "luxury adventure Sikkim",
  ],
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/itinerary", label: "Itinerary" },
  { href: "/pricing", label: "Pricing" },
  { href: "/testimonials", label: "Testimonials" },
  { href: "/rewards", label: "Refer & Earn" },
  { href: "/contact", label: "Contact" },
  { href: "/booking", label: "Book Now" },
] as const;

export const FOOTER_LINKS = [
  { href: "/itinerary", label: "Itinerary" },
  { href: "/pricing", label: "Pricing" },
  { href: "/booking", label: "Booking" },
  { href: "/testimonials", label: "Testimonials" },
  { href: "/rewards", label: "Refer & Earn" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
] as const;
