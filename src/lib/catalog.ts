export type ServicePackage = {
  id: string;
  name: string;
  priceCents: number;
  priceNote?: string;
  summary: string;
  includes: string[];
  combo?: boolean;
  featured?: boolean;
  /** Any interior work at all — drives the required interior questions. */
  interior?: boolean;
  scopeNote?: string;
};

export type Addon = {
  id: string;
  name: string;
  priceCents: number;
  description: string;
  /** Priced through a required interior question, not the optional add-on list. */
  interiorQuestion?: boolean;
};

export const INTERIOR_SCOPE_NOTE =
  "This service includes a full interior cleaning — vacuuming, surface cleaning, and touch-ups throughout the cabin. It is not a deep restoration. If the interior is excessively filthy beyond what a typical cleaning includes, we may re-quote the price on-site or cancel the interior service. If the interior is canceled but the exterior is still performed, there is no additional charge. If the entire appointment is canceled on-site, a cancellation fee of 25% of the original quoted cost applies.";

export const packages: ServicePackage[] = [
  {
    id: "interior",
    name: "Interior Clean",
    priceCents: 6999,
    priceNote: "Heavy soil may need an add-on",
    interior: true,
    scopeNote: INTERIOR_SCOPE_NOTE,
    summary:
      "A full cabin reset — not a quick wipe. Carpets and mats get vacuumed; dash, console, doors, and plastics get a detailed wipe; interior glass is cleaned; trash is removed. Light stain attention as condition allows.",
    includes: [
      "Vacuum carpets, mats, seats, and seams",
      "Detailed wipe of dash, console, doors, and plastics",
      "Interior glass",
      "Trash removal",
      "Light stain attention as condition allows",
    ],
  },
  {
    id: "exterior",
    name: "Exterior Clean",
    priceCents: 5499,
    summary:
      "A careful hand wash at your location — pre-rinse, snow foam, hand wash, and a hand dry so the finish is clean, not rushed.",
    includes: ["Pre-rinse", "Snow foam", "Hand-wash", "Hand dry"],
  },
  {
    id: "bronze",
    name: "Interior + Exterior",
    priceCents: 11499,
    summary:
      "The complete everyday reset: the full Interior Clean plus the Exterior Clean, done together at your location.",
    combo: true,
    interior: true,
    includes: [
      "Everything in Interior Clean",
      "Pre-rinse, snow foam, hand-wash, and hand dry",
    ],
  },
  {
    id: "prestige",
    name: "Prestige Detail",
    priceCents: 14999,
    summary:
      "Interior and exterior, finished with a hand-applied protective glaze for multi-week gloss and shine.",
    combo: true,
    interior: true,
    featured: true,
    includes: [
      "Everything in Interior Clean",
      "Pre-rinse, snow foam, hand-wash, and hand dry",
      "Hand-applied protective glaze / shine sealant (multi-week gloss protection)",
    ],
  },
  {
    id: "diamond",
    name: "Diamond Detail",
    priceCents: 29999,
    summary:
      "The fullest exterior finish we offer: decontamination, machine polish, and protection, with the same Interior Clean as the cabin package.",
    combo: true,
    interior: true,
    includes: [
      "Everything in Interior Clean",
      "Pre-rinse, snow foam, hand-wash, and hand dry",
      "Clay-bar decontamination",
      "Machine polish",
      "Hand-applied protective glaze / shine sealant",
    ],
  },
];

export const addons: Addon[] = [
  {
    id: "heavily-soiled",
    name: "Heavily soiled interior",
    priceCents: 3999,
    description:
      "Extra time for packed dirt, heavy stains, or a cabin that needs more than a standard Interior Clean.",
  },
  {
    id: "oversized",
    name: "Large vehicle / oversized",
    priceCents: 1999,
    description: "Truck, van, or large SUV — extra time and product.",
  },
  {
    id: "pet-hair",
    name: "Pet hair",
    priceCents: 4000,
    description: "Extra time on pet hair in carpet, seats, and seams.",
    interiorQuestion: true,
  },
  {
    id: "stain-removal",
    name: "Stain removal",
    priceCents: 3000,
    description: "Targeted extraction on spots we can lift.",
    interiorQuestion: true,
  },
];

export type InteriorQuestion = {
  id: string;
  addonId: string;
  legend: string;
  yesLabel: string;
  noLabel: string;
};

/**
 * Asked as required radios — never checkboxes — on any package with interior
 * work. Prices stay off the labels; the running total carries them.
 */
export const interiorQuestions: InteriorQuestion[] = [
  {
    id: "pet-hair",
    addonId: "pet-hair",
    legend: "Pet hair",
    yesLabel: "Pet hair",
    noLabel: "No pet hair",
  },
  {
    id: "stains",
    addonId: "stain-removal",
    legend: "Stains",
    yesLabel: "Stains to be removed",
    noLabel: "No stains",
  },
];

export const optionalAddons = addons.filter((a) => !a.interiorQuestion);

const packageMap = new Map(packages.map((p) => [p.id, p]));
const addonMap = new Map(addons.map((a) => [a.id, a]));

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

export function resolveSelection(packageId: string, addonIds: string[] = []) {
  const pkg = packageMap.get(packageId);
  if (!pkg) throw new CatalogError("Choose a valid package.");
  const unique = [...new Set(addonIds)];
  const selectedAddons: Addon[] = [];
  for (const id of unique) {
    const addon = addonMap.get(id);
    if (!addon) throw new CatalogError("Choose valid add-ons.");
    selectedAddons.push(addon);
  }
  const lines = [
    { id: pkg.id, name: pkg.name, priceCents: pkg.priceCents },
    ...selectedAddons.map((a) => ({
      id: a.id,
      name: a.name,
      priceCents: a.priceCents,
    })),
  ];
  const totalCents = lines.reduce((sum, line) => sum + line.priceCents, 0);
  return { pkg, selectedAddons, lines, totalCents };
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function getPackage(id: string) {
  return packageMap.get(id);
}

export function packageIncludesInterior(id: string) {
  return !!packageMap.get(id)?.interior;
}
