import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Pending-booking + slot-hold storage.
 *
 * The important rule lives here: a booking record NEVER affects availability.
 * Only a hold does, and a hold is only written once a payment is confirmed
 * (`confirmBooking`). An abandoned or failed checkout leaves a `pending` record
 * behind and the slot stays bookable.
 *
 * Layered like `waiver-store`: Netlify Blobs in production, /tmp for local dev,
 * in-process memory as a last resort.
 */

export type BookingStatus = "pending" | "paid" | "cancelled";

export type BookingVerification =
  | "unverified"
  | "square-api"
  | "square-webhook"
  | "manual";

export type BookingSlot = {
  id: string;
  start: string;
  end: string;
  label: string;
  durationMinutes: number;
};

export type BookingRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: BookingStatus;
  verification: BookingVerification;
  slot: BookingSlot | null;
  packageId: string;
  packageName: string;
  addonIds: string[];
  addonNames: string[];
  totalCents: number;
  customer: {
    name?: string;
    phone?: string;
    email?: string;
    vehicle?: string;
    location?: string;
  };
  waiver: {
    name?: string;
    agreedAt?: string;
    pdfUrl?: string;
    pdfId?: string;
  } | null;
  square: {
    source: "square-api" | "open-amount";
    paymentLinkUrl?: string;
    orderId?: string;
    paymentId?: string;
    checkoutId?: string;
    transactionId?: string;
  };
  hold: {
    heldAt: string;
    calendarEventId?: string;
    calendarStatus: "created" | "deleted" | "skipped" | "failed";
    calendarDetail?: string;
    notified: boolean;
  } | null;
  /** Set when the owner has been asked to confirm a payment we could not verify. */
  reviewNotifiedAt?: string;
  /** Windows this booking used to sit on, oldest first, after self-service moves. */
  previousSlots?: BookingSlot[];
  /** Post-payment confirmation text. `to` is masked; the body is kept for support. */
  sms?: {
    status: "sent" | "stubbed" | "failed" | "blocked" | "skipped";
    to?: string;
    provider?: string;
    detail?: string;
    body?: string;
    at: string;
  };
  /** Written when a paid booking is cancelled, including how the refund was handled. */
  cancellation?: {
    cancelledAt: string;
    hoursBeforeStart: number;
    policy: "full-refund" | "late-fee";
    feeCents: number;
    refundCents: number;
    refundStatus: "issued" | "failed" | "skipped" | "not-needed";
    refundId?: string;
    refundDetail?: string;
    slotReleased: boolean;
  };
};

export type SlotHold = {
  slotId: string;
  bookingId: string;
  start: string;
  end: string;
  heldAt: string;
};

type HoldsDoc = { slots: Record<string, SlotHold> };

const HOLDS_KEY = "holds";
const STORE_NAME = "bookings";

declare global {
  var __pcwBookingStore: Map<string, unknown> | undefined;
}

function memory(): Map<string, unknown> {
  if (!globalThis.__pcwBookingStore) globalThis.__pcwBookingStore = new Map();
  return globalThis.__pcwBookingStore;
}

async function blobStore() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore(STORE_NAME);
  } catch {
    return null;
  }
}

function tmpPath(key: string) {
  return path.join("/tmp", "pcw-bookings", `${key.replace(/\//g, "_")}.json`);
}

async function readDoc<T>(key: string): Promise<T | null> {
  const store = await blobStore();
  if (store) {
    try {
      const raw = await store.get(key, { type: "json" });
      if (raw) return raw as T;
      return null;
    } catch {
      /* Blobs configured but unreachable — fall through to local copies */
    }
  }
  try {
    const raw = await readFile(tmpPath(key), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    /* no local copy */
  }
  return (memory().get(key) as T) ?? null;
}

async function writeDoc(key: string, value: unknown): Promise<void> {
  memory().set(key, value);
  const store = await blobStore();
  if (store) {
    try {
      await store.setJSON(key, value);
    } catch (err) {
      console.warn("Booking blob write failed", err);
    }
  }
  try {
    await mkdir(path.dirname(tmpPath(key)), { recursive: true });
    await writeFile(tmpPath(key), JSON.stringify(value));
  } catch {
    /* read-only fs — memory + blobs still hold the record */
  }
}

export function newBookingId() {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

function bookingKey(id: string) {
  return `booking/${id}`;
}

function safeId(id: string) {
  const cleaned = (id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned && cleaned === id ? cleaned : "";
}

export async function saveBooking(record: BookingRecord) {
  await writeDoc(bookingKey(record.id), record);
  return record;
}

export async function getBooking(id: string): Promise<BookingRecord | null> {
  const key = safeId(id);
  if (!key) return null;
  return readDoc<BookingRecord>(bookingKey(key));
}

export async function updateBooking(
  id: string,
  patch: Partial<BookingRecord>,
): Promise<BookingRecord | null> {
  const current = await getBooking(id);
  if (!current) return null;
  const next: BookingRecord = {
    ...current,
    ...patch,
    square: { ...current.square, ...(patch.square || {}) },
    updatedAt: new Date().toISOString(),
  };
  await saveBooking(next);
  return next;
}

async function readHolds(): Promise<HoldsDoc> {
  const doc = await readDoc<HoldsDoc>(HOLDS_KEY);
  if (!doc || typeof doc !== "object" || !doc.slots) return { slots: {} };
  return doc;
}

function prune(doc: HoldsDoc): HoldsDoc {
  const cutoff = Date.now() - 45 * 24 * 3_600_000;
  const slots: Record<string, SlotHold> = {};
  for (const [id, hold] of Object.entries(doc.slots)) {
    if (Date.parse(hold.end) >= cutoff) slots[id] = hold;
  }
  return { slots };
}

export async function listHolds(): Promise<SlotHold[]> {
  const doc = await readHolds();
  return Object.values(doc.slots).sort((a, b) => a.start.localeCompare(b.start));
}

export async function listHeldSlotIds(): Promise<string[]> {
  return (await listHolds()).map((hold) => hold.slotId);
}

export async function getHold(slotId: string): Promise<SlotHold | null> {
  const doc = await readHolds();
  return doc.slots[slotId] || null;
}

/**
 * Write the hold. Returns `false` when a *different* booking already holds the
 * slot, so a second payer never silently overwrites the first.
 */
export async function holdSlot(hold: SlotHold): Promise<boolean> {
  const doc = await readHolds();
  const existing = doc.slots[hold.slotId];
  if (existing && existing.bookingId !== hold.bookingId) return false;
  doc.slots[hold.slotId] = hold;
  await writeDoc(HOLDS_KEY, prune(doc));
  return true;
}

export async function releaseSlot(slotId: string): Promise<void> {
  const doc = await readHolds();
  if (!doc.slots[slotId]) return;
  delete doc.slots[slotId];
  await writeDoc(HOLDS_KEY, prune(doc));
}
