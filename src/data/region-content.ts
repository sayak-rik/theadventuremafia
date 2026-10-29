// Short, locally-flavored lines per Sikkim region — mixed into category/region
// browse-page copy (BrowseView.tsx) so pages read as genuinely local rather
// than a single category blurb with the place-name swapped in. Keep each
// entry factual-but-general (no invented specifics) and short: this is meant
// to sit alongside the category intro, not replace it.
export const REGION_CONTENT: Record<string, { tagline: string; blurb: string }> = {
  gangtok: {
    tagline: "Sikkim's capital, around MG Marg",
    blurb: "Gangtok is Sikkim's capital and biggest town, built up the ridge above the Ranipool valley — the usual starting point for trips further into the state.",
  },
  pelling: {
    tagline: "West Sikkim's viewpoint town",
    blurb: "Pelling sits on a ridge in West Sikkim with some of the most reliable Kanchenjunga views in the state, and is the usual base for Khecheopalri, Yuksom and the Pelling Skywalk.",
  },
  yuksom: {
    tagline: "Sikkim's first capital",
    blurb: "Yuksom was the first capital of the Kingdom of Sikkim and is the trailhead for the Dzongri–Goecha La trek, with the historic Norbugang coronation throne nearby.",
  },
  lachung: {
    tagline: "Gateway to the Yumthang valley",
    blurb: "Lachung is a North Sikkim village on the way to the Yumthang valley and Zero Point, and the usual overnight stop for that route.",
  },
  lachen: {
    tagline: "Gateway to Gurudongmar Lake",
    blurb: "Lachen is the last village before Gurudongmar Lake and the Chopta valley in North Sikkim, used mainly as an overnight stop for permit-restricted routes.",
  },
  dzongu: {
    tagline: "The Lepcha reserve",
    blurb: "Dzongu is a protected reserve for the indigenous Lepcha community in North Sikkim, known for its biodiversity and limited, permit-based access.",
  },
  ravangla: {
    tagline: "South Sikkim's monastery town",
    blurb: "Ravangla sits between Namchi and Pelling in South Sikkim, known for the Buddha Park and wide Himalayan views, including Kanchenjunga on a clear day.",
  },
  namchi: {
    tagline: "South Sikkim's hill town",
    blurb: "Namchi is South Sikkim's district headquarters, known for the Char Dham and Samdruptse Buddha statue complexes above the town.",
  },
  "west-sikkim": { tagline: "Pelling, Yuksom and the Kanchenjunga side", blurb: "West Sikkim covers Pelling, Yuksom, Khecheopalri and the trekking routes toward the Kanchenjunga Biosphere Reserve." },
  "north-sikkim": { tagline: "Lachung, Lachen and the high valleys", blurb: "North Sikkim covers Lachung, Lachen, Yumthang and Gurudongmar — permit-restricted, high-altitude routes out of Gangtok." },
  "south-sikkim": { tagline: "Namchi, Ravangla and the southern hills", blurb: "South Sikkim covers Namchi, Ravangla and Sikkim's southern approach from Siliguri and the plains." },
  jorethang: { tagline: "A Rangit-river junction town", blurb: "Jorethang is a South/West Sikkim junction town on the Rangit river, often used as a river-access point." },
  legship: { tagline: "A Rangit-river crossing", blurb: "Legship sits on the Rangit river between Pelling and Jorethang, a common access point for the river." },
  melli: { tagline: "The West Bengal–Sikkim border crossing", blurb: "Melli is the main road checkpoint on the West Bengal–Sikkim border, on the Teesta, and the usual entry point from Siliguri." },
  rangpo: { tagline: "The eastern Sikkim border town", blurb: "Rangpo is Sikkim's main eastern entry checkpoint on the Teesta, on the route in from Siliguri toward Gangtok." },
  singtam: { tagline: "A Teesta-valley junction town", blurb: "Singtam is a Teesta-valley junction town between Rangpo and Gangtok." },
  siliguri: { tagline: "The gateway from the plains", blurb: "Siliguri, in West Bengal, is the usual road and rail gateway into Sikkim and the Darjeeling hills." },
};

export const DEFAULT_REGION_CONTENT = { tagline: "Sikkim", blurb: "Sikkim's Himalayan towns and valleys." };
