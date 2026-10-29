// Central site/brand constants — single source of truth for nav, contact, SEO.

export const SITE = {
  name: "The Adventure Mafia",
  tagline: "Tours, bikes & cars across Sikkim",
  product: "Tours · Bike & car rentals · Rafting · Paragliding",
  description:
    "Book guided tours, bike and scooty rentals, car hire, river rafting and paragliding with verified local operators and drivers across Sikkim — Gangtok, Pelling, Yuksom, Lachung and more. See live availability and pay a small advance straight to them by UPI.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "contact@theadventuremafia.com",
  phone: "+91 7003405268",
  whatsapp: "+91 7003405268",
  keywords: [
    "Sikkim tour packages",
    "car rental Sikkim",
    "Gangtok to Pelling cab",
    "Siliguri to Sikkim taxi",
    "bike rental in Pelling",
    "scooty on rent in Pelling",
    "Pelling bike hire",
    "river rafting Sikkim",
    "paragliding Sikkim",
    "things to do in Sikkim",
    "things to do in Pelling",
    "Sikkim adventure booking",
    "West Sikkim bike tour",
    "Himalayan motorcycle expedition",
    "Kanchenjunga view Sikkim",
    "Gangtok sightseeing tour",
  ],
} as const;

export const NAV_LINKS = [
  { href: "/adventures/guided-tours", label: "Tours", icon: "map" },
  { href: "/adventures/car-hire", label: "Cars", icon: "car" },
  { href: "/adventures/bike-rental", label: "Bikes", icon: "bike" },
  { href: "/adventures/scooty-rental", label: "Scooties", icon: "scooter" },
  { href: "/adventures/rafting", label: "Rafting", icon: "waves" },
  { href: "/adventures/paragliding", label: "Paragliding", icon: "wind" },
] as const;

export const FOOTER_GROUPS = [
  {
    title: "Book",
    links: [
      { href: "/adventures/guided-tours", label: "Guided tours" },
      { href: "/adventures/car-hire", label: "Car hire" },
      { href: "/adventures/bike-rental", label: "Bike rentals" },
      { href: "/adventures/scooty-rental", label: "Scooty rentals" },
      { href: "/adventures/rafting", label: "River rafting" },
      { href: "/adventures/paragliding", label: "Paragliding" },
      { href: "/itinerary", label: "7-day Sikkim motorcycle expedition" },
      { href: "/adventures", label: "Day treks" },
    ],
  },
  {
    title: "For operators & drivers",
    links: [
      { href: "/partner", label: "List your business" },
      { href: "/drive/signup", label: "Drive with us" },
      { href: "/dashboard/login", label: "Sign in" },
      { href: "/partner/terms", label: "Partner terms" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/book/find", label: "Find my booking" },
      { href: "/contact", label: "Contact us" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/rewards", label: "Refer & earn" },
    ],
  },
] as const;
