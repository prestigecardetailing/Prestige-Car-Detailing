export type ServicePackage = {
  id: string;
  name: string;
  priceCents: number;
  priceNote?: string;
  summary: string;
  includes: string[];
  combo?: boolean;
  featured?: boolean;
};

export type Addon = {
  id: string;
  name: string;
  priceCents: number;
  description: string;
};

export const packages: ServicePackage[] = [
  {
    id: "interior",
    name: "Interior Clean",
    priceCents: 5499,
    priceNote: "Heavy soil may need an add-on",
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
    priceCents: 9999,
    summary:
      "The complete everyday reset: the full Interior Clean plus the Exterior Clean, done together at your location.",
    combo: true,
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
    id: "dog-hair",
    name: "Dog hair",
    priceCents: 2999,
    description: "Extra time on pet hair in carpet, seats, and seams.",
  },
  {
    id: "stain-extraction",
    name: "Stain extraction",
    priceCents: 4999,
    description: "Targeted extraction on spots we can lift.",
  },
];

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
