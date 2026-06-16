// 7-day "Untouched West Sikkim Expedition" — day-by-day route content.
// Distances/times are approximate (winding mountain roads vary with weather
// and permit checkpoints).

export type ItineraryDay = {
  day: number;
  title: string;
  route: string;
  distanceKm: string;
  driveTime: string;
  stay: string;
  highlights: string[];
};

export const ITINERARY: ItineraryDay[] = [
  {
    day: 1,
    title: "NJP to Pelling",
    route: "NJP (Siliguri) → Shuttle → Jorethang → Pelling",
    distanceKm: "94 (shuttle) + 41 (ride)",
    driveTime: "~3-4h shuttle · ~3hr ide",
    stay: "Pelling",
    highlights: [
      "Scenic drive along the Rangeet River",
      "Kirateshwar Mahadev Temple at Legship (riverbank)",
      "Afternoon arrival in Pelling; Skywalk viewpoint",
      "Sunset at Pemayangtse Monastery and Rabdentse ruins",
      "Sanga Choeling Monastery vantage above Pelling",
    ],
  },
  {
    day: 2,
    title: "Pelling to Dentam / Bermiok",
    route: "Pelling → Rinchenpong → Dentam / Bermiok",
    distanceKm: "~60 (via Rinchenpong)",
    driveTime: "~5h",
    stay: "Dentam / Bermiok",
    highlights: [
      "Rinchenpong village — Bikh Pokhari (poison lake) and monastery",
      "Hee and Bermiok village ride into the Dentam valley",
      "Singshore Suspension Bridge near Dentam",
      "Barsey Rhododendron Sanctuary (seasonal blooms)",
    ],
  },
  {
    day: 3,
    title: "Dentam to Yuksom",
    route: "Dentam / Bermiok → Uttarey valley → Yuksom",
    distanceKm: "~60 (via Uttarey)",
    driveTime: "~5h",
    stay: "Yuksom",
    highlights: [
      "Scenic ascent into Uttarey valley, Kanchenjunga range views",
      "Norbugang Park — Coronation Throne and Chorten",
      "Dubdi Monastery (oldest in Sikkim) and Kathok Lake",
      "Rimbi Waterfall, Rimbi orange garden and Kanchenjunga Falls",
      "Sacred Khecheopalri Lake en route",
    ],
  },
  {
    day: 4,
    title: "Yuksom to Gangtok via Ravangla",
    route: "Yuksom → Ravangla → Gangtok",
    distanceKm: "54 + 65",
    driveTime: "~3h + ~4h",
    stay: "Gangtok",
    highlights: [
      "Buddha Park (Tathagata Tsal) — 130-ft statue with Kanchenjunga backdrop",
      "Temi Tea Garden — Sikkim's only organic tea estate",
      "Temperate hills into Gangtok by evening",
    ],
  },
  {
    day: 5,
    title: "Gangtok to Lachen",
    route: "Gangtok → Mangan → Lachen (North Sikkim)",
    distanceKm: "128",
    driveTime: "~6–8h",
    stay: "Lachen (~2,700 m)",
    highlights: [
      "Tashi Viewpoint panoramic Himalayan vista",
      "Seven Sisters Waterfall",
      "Singhik and Naga waterfalls through steep gorge roads",
      "Overnight in alpine lodges",
    ],
  },
  {
    day: 6,
    title: "Lachen to Lachung via Gurudongmar",
    route: "Lachen → Thangu → Gurudongmar Lake → Lachung",
    distanceKm: "~136",
    driveTime: "~8–9h",
    stay: "Lachung (~2,700 m)",
    highlights: [
      "Gurudongmar Lake (4,441 m) in morning light",
      "Snowfields and the high Thangu valley meadows",
      "Descend to the mountain village of Lachung",
    ],
  },
  {
    day: 7,
    title: "Lachung to Jorethang",
    route: "Lachung → Gangtok → Jorethang",
    distanceKm: "~220 (via Gangtok)",
    driveTime: "~8–9h ride",
    stay: "Jorethang",
    highlights: [
      "Optional early Yumthang Valley / Zero Point detour (extra)",
      "Ride out through the deep North Sikkim gorge",
      "Continue via Gangtok towards South Sikkim",
      "Night rest in Jorethang",
    ],
  },
];

// Ordered stops for the animated route map.
export const ROUTE_STOPS = [
  "NJP",
  "Pelling",
  "Dentam",
  "Yuksom",
  "Ravangla",
  "Gangtok",
  "Lachen",
  "Lachung",
] as const;
