import { addons, getPackage } from "@/lib/catalog";

/**
 * The booking flow, in the order Derek set on 2026-09-30:
 *
 *   car wash type → time slot → customer information → waiver → pay
 *
 * The first two steps are interchangeable — a customer may start from a package
 * price or from an open window — but the information step is not reachable until
 * both are done. Clicking a price never jumps to the information screen; it opens
 * the car wash type step with that package selected.
 *
 * The selection travels in the query string (`package`, `addons`, `slot`) so every
 * step can be linked, shared, and refreshed. Customer contact details never do —
 * those stay in session storage, see `booking-session.ts`.
 */
export const BOOKING_STEPS = [
  { key: "service", label: "Car wash type" },
  { key: "time", label: "Time slot" },
  { key: "details", label: "Your information" },
  { key: "waiver", label: "Waiver" },
  { key: "pay", label: "Payment" },
] as const;

export type BookingStepKey = (typeof BOOKING_STEPS)[number]["key"];

export type BookingSelection = {
  packageId: string | null;
  addonIds: string[];
  slotId: string;
};

export const emptySelection: BookingSelection = {
  packageId: null,
  addonIds: [],
  slotId: "",
};

type ParamValue = string | string[] | undefined | null;

function firstValue(raw: ParamValue) {
  if (Array.isArray(raw)) return raw[0] || "";
  return (raw || "").trim();
}

/** Only ids that exist in the catalog survive — a bad one is simply "not chosen". */
export function parsePackageId(raw: ParamValue): string | null {
  return getPackage(firstValue(raw))?.id || null;
}

export function parseAddonIds(raw: ParamValue): string[] {
  const wanted = firstValue(raw)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const known = new Set(addons.map((addon) => addon.id));
  return [...new Set(wanted)].filter((id) => known.has(id));
}

export function parseSlotParam(raw: ParamValue): string {
  return firstValue(raw);
}

export function readSelection(params: {
  package?: ParamValue;
  addons?: ParamValue;
  slot?: ParamValue;
}): BookingSelection {
  return {
    packageId: parsePackageId(params.package),
    addonIds: parseAddonIds(params.addons),
    slotId: parseSlotParam(params.slot),
  };
}

export function selectionFromQuery(
  get: (key: string) => string | null,
): BookingSelection {
  return {
    packageId: parsePackageId(get("package")),
    addonIds: parseAddonIds(get("addons")),
    slotId: parseSlotParam(get("slot")),
  };
}

function withSelection(path: string, selection: Partial<BookingSelection>) {
  const params = new URLSearchParams();
  if (selection.packageId) params.set("package", selection.packageId);
  if (selection.addonIds?.length) params.set("addons", selection.addonIds.join(","));
  if (selection.slotId) params.set("slot", selection.slotId);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function servicePath(selection: Partial<BookingSelection> = {}) {
  return withSelection("/book/service", selection);
}

export function timePath(selection: Partial<BookingSelection> = {}) {
  return withSelection("/book", selection);
}

export function detailsPath(selection: Partial<BookingSelection> = {}) {
  return withSelection("/book/details", selection);
}

export function payPath(selection: Partial<BookingSelection> = {}) {
  return withSelection("/pay", selection);
}

/** Both halves of the booking have to be chosen before we ask for contact details. */
export function readyForDetails(selection: BookingSelection) {
  return !!selection.packageId && !!selection.slotId;
}

/** Where the car wash type step hands off: to the time step, or straight on. */
export function afterServiceStep(selection: BookingSelection) {
  return selection.slotId ? detailsPath(selection) : timePath(selection);
}

/** Where a picked window hands off: to the car wash type step, or straight on. */
export function afterTimeStep(selection: BookingSelection) {
  return selection.packageId ? detailsPath(selection) : servicePath(selection);
}
