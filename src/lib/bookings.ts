import { formatMoney, resolveSelection } from "@/lib/catalog";
import {
  BookingRecord,
  BookingVerification,
  getBooking,
  holdSlot,
  newBookingId,
  saveBooking,
  updateBooking,
} from "@/lib/booking-store";
import type { CalendarResult } from "@/lib/google-calendar";
import { createCalendarHold, googleCalendarConfigured } from "@/lib/google-calendar";
import { notifyOwnerFromServer } from "@/lib/notify-owner";
import { site } from "@/lib/site";
import { availabilityConfig, describeSlot, isSlotOpen } from "@/lib/slots";

export type CreateBookingInput = {
  packageId: string;
  addonIds: string[];
  slotId?: string | null;
  customer?: BookingRecord["customer"];
  waiver?: BookingRecord["waiver"];
  source: BookingRecord["square"]["source"];
};

export class BookingError extends Error {
  code: "slot-taken" | "slot-unknown";
  constructor(code: "slot-taken" | "slot-unknown", message: string) {
    super(message);
    this.code = code;
    this.name = "BookingError";
  }
}

/**
 * Record the intent to book. This deliberately does NOT touch availability —
 * the window stays listed on /book until money clears.
 */
export async function createPendingBooking(
  input: CreateBookingInput,
): Promise<BookingRecord> {
  const selection = resolveSelection(input.packageId, input.addonIds);

  let slot: BookingRecord["slot"] = null;
  if (input.slotId) {
    const described = describeSlot(input.slotId);
    if (!described) {
      throw new BookingError("slot-unknown", "That time is not a Prestige window.");
    }
    if (!(await isSlotOpen(input.slotId))) {
      throw new BookingError(
        "slot-taken",
        "That window was just taken. Pick another open time.",
      );
    }
    slot = {
      id: described.id,
      start: described.start,
      end: described.end,
      label: described.label,
      durationMinutes: described.durationMinutes,
    };
  }

  const now = new Date().toISOString();
  const record: BookingRecord = {
    id: newBookingId(),
    createdAt: now,
    updatedAt: now,
    status: "pending",
    verification: "unverified",
    slot,
    packageId: selection.pkg.id,
    packageName: selection.pkg.name,
    addonIds: selection.selectedAddons.map((a) => a.id),
    addonNames: selection.selectedAddons.map((a) => a.name),
    totalCents: selection.totalCents,
    customer: input.customer || {},
    waiver: input.waiver || null,
    square: { source: input.source },
    hold: null,
  };
  await saveBooking(record);
  return record;
}

function bookingSummary(record: BookingRecord) {
  return [
    `Booking id: ${record.id}`,
    `Window: ${record.slot ? record.slot.label : "No slot selected (pay-only)"}`,
    record.slot ? `Window start (ISO): ${record.slot.start}` : "",
    record.slot ? `Window end (ISO): ${record.slot.end}` : "",
    `Package: ${record.packageName}`,
    `Add-ons: ${record.addonNames.join(", ") || "None"}`,
    `Total: ${formatMoney(record.totalCents)}`,
    record.customer.name ? `Customer: ${record.customer.name}` : "",
    record.customer.phone ? `Phone: ${record.customer.phone}` : "",
    record.customer.email ? `Email: ${record.customer.email}` : "",
    record.customer.vehicle ? `Vehicle: ${record.customer.vehicle}` : "",
    record.customer.location ? `Location: ${record.customer.location}` : "",
    record.waiver?.name ? `Waiver signed by: ${record.waiver.name}` : "",
    record.waiver?.agreedAt ? `Waiver signed at: ${record.waiver.agreedAt}` : "",
    record.waiver?.pdfUrl ? `Waiver PDF: ${record.waiver.pdfUrl}` : "",
    record.square.orderId ? `Square order: ${record.square.orderId}` : "",
    record.square.paymentId ? `Square payment: ${record.square.paymentId}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The customer came back from Square but we could not prove the charge (usually
 * the open-amount link, which carries no ids). Ask the owner to confirm; the slot
 * stays bookable until they do.
 */
export async function flagBookingForReview(record: BookingRecord) {
  if (record.reviewNotifiedAt) return record;
  await notifyOwnerFromServer({
    subject: `Prestige CONFIRM NEEDED — ${record.slot?.label || record.packageName}`,
    name: record.customer.name || "Prestige customer",
    phone: record.customer.phone,
    message: [
      "A customer finished the Square screen, but the site could not verify the charge automatically.",
      "The window is STILL BOOKABLE on the site until you confirm it.",
      "",
      bookingSummary(record),
      "",
      "Check Square for the payment. If it cleared, confirm the hold with:",
      `POST ${site.url}/api/bookings/confirm`,
      `{ "bookingId": "${record.id}", "adminToken": "<PRESTIGE_ADMIN_TOKEN>" }`,
    ].join("\n"),
  }).catch(() => null);
  return (
    (await updateBooking(record.id, {
      reviewNotifiedAt: new Date().toISOString(),
    })) || record
  );
}

export type ConfirmResult = {
  ok: boolean;
  status: BookingRecord["status"];
  booking?: BookingRecord;
  /** Why the hold was not written, when ok is false. */
  reason?: "not-found" | "not-verified" | "slot-conflict";
};

/**
 * Money cleared — now, and only now, take the window off the board: write the
 * hold, push a Google Calendar event when credentials exist, and email the owner.
 * Safe to call twice (Square redirect and the webhook both land here).
 */
export async function confirmBooking(
  bookingId: string,
  options: {
    verification: BookingVerification;
    square?: Partial<BookingRecord["square"]>;
  },
): Promise<ConfirmResult> {
  const existing = await getBooking(bookingId);
  if (!existing) return { ok: false, status: "pending", reason: "not-found" };

  if (existing.status === "paid" && existing.hold) {
    return { ok: true, status: "paid", booking: existing };
  }

  const record =
    (await updateBooking(bookingId, {
      status: "paid",
      verification: options.verification,
      square: { ...existing.square, ...(options.square || {}) },
    })) || existing;

  let heldOk = true;
  if (record.slot) {
    heldOk = await holdSlot({
      slotId: record.slot.id,
      bookingId: record.id,
      start: record.slot.start,
      end: record.slot.end,
      heldAt: new Date().toISOString(),
    });
  }

  const config = availabilityConfig();
  const calendar: CalendarResult = record.slot
    ? await createCalendarHold({
        summary: `Prestige detail — ${record.packageName}${
          record.customer.name ? ` (${record.customer.name})` : ""
        }`,
        description: bookingSummary(record),
        startIso: record.slot.start,
        endIso: record.slot.end,
        timeZone: config.timeZone,
        location: record.customer.location,
      })
    : { status: "skipped", detail: "No slot on this payment" };

  const notify = await notifyOwnerFromServer({
    subject: record.slot
      ? `Prestige PAID booking — ${record.slot.label}`
      : `Prestige PAID (no slot) — ${record.packageName}`,
    name: record.customer.name || "Prestige customer",
    phone: record.customer.phone,
    message: [
      "PAID — the slot is now held on the site.",
      `Payment verified via: ${options.verification}`,
      "",
      bookingSummary(record),
      "",
      record.slot
        ? calendar.status === "created"
          ? `Google Calendar: event created (${calendar.eventId}).`
          : googleCalendarConfigured()
            ? `Google Calendar: FAILED (${calendar.detail}). Add the event by hand.`
            : "Google Calendar: not connected on this deploy — add the event by hand on the Prestige calendar."
        : "",
      heldOk
        ? ""
        : "WARNING: another paid booking already holds this window. Call the customer.",
      "",
      `Slot list: ${site.url}/api/open-slots`,
    ]
      .filter(Boolean)
      .join("\n"),
  }).catch(() => ({ status: "failed" as const }));

  const final =
    (await updateBooking(bookingId, {
      hold: {
        heldAt: new Date().toISOString(),
        calendarEventId: calendar.eventId,
        calendarStatus: calendar.status,
        calendarDetail: calendar.detail,
        notified: notify.status === "sent",
      },
    })) || record;

  return {
    ok: true,
    status: "paid",
    booking: final,
    reason: heldOk ? undefined : "slot-conflict",
  };
}
