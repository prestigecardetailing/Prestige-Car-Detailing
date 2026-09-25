import { formatMoney, resolveSelection } from "@/lib/catalog";
import {
  BookingRecord,
  BookingSlot,
  BookingVerification,
  getBooking,
  getHold,
  holdSlot,
  newBookingId,
  releaseSlot,
  saveBooking,
  updateBooking,
} from "@/lib/booking-store";
import type { CalendarResult } from "@/lib/google-calendar";
import {
  createCalendarHold,
  deleteCalendarHold,
  googleCalendarConfigured,
  updateCalendarHold,
} from "@/lib/google-calendar";
import { notifyOwnerFromServer } from "@/lib/notify-owner";
import { refundSquarePayment } from "@/lib/square";
import { site } from "@/lib/site";
import {
  availabilityConfig,
  describeSlot,
  formatMoment,
  isSlotOpen,
} from "@/lib/slots";

export type CreateBookingInput = {
  packageId: string;
  addonIds: string[];
  slotId?: string | null;
  customer?: BookingRecord["customer"];
  waiver?: BookingRecord["waiver"];
  source: BookingRecord["square"]["source"];
};

export type BookingErrorCode =
  | "slot-taken"
  | "slot-unknown"
  | "not-found"
  | "not-paid"
  | "no-slot"
  | "too-late";

export class BookingError extends Error {
  code: BookingErrorCode;
  constructor(code: BookingErrorCode, message: string) {
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
      record.slot
        ? `Customer can move or cancel this themselves at ${site.url}/reschedule?ref=${record.id} (move until ${
            reschedulePolicy(record).deadlineLabel
          }).`
        : "",
      record.slot
        ? `Cancellation policy: full refund ${
            cancellationQuote(record).cutoffHours
          }+ hours out; inside that we keep ${formatMoney(
            availabilityConfig().lateCancelFeeCents,
          )} and refund the rest.`
        : "",
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

/**
 * Undo before payment. Nothing is held in the pay-first model, so this is mostly
 * bookkeeping — but if a hold somehow points at this unpaid booking it is dropped
 * immediately so the window goes straight back on the board.
 */
export async function cancelPendingBooking(
  bookingId: string,
): Promise<BookingRecord | null> {
  const record = await getBooking(bookingId);
  if (!record) return null;
  if (record.status === "paid") return record;
  if (record.slot) {
    const hold = await getHold(record.slot.id);
    if (hold?.bookingId === record.id) await releaseSlot(record.slot.id);
  }
  return updateBooking(bookingId, { status: "cancelled" });
}

export type ReschedulePolicy = {
  allowed: boolean;
  cutoffHours: number;
  /** Last moment the customer can move the booking themselves. */
  deadline: string | null;
  deadlineLabel: string | null;
  reason?: "not-paid" | "no-slot" | "too-late" | "past";
};

/**
 * Self-service reschedule is open until `rescheduleCutoffHours` before the
 * window starts (default 24). Inside that, the customer has to call the shop.
 */
export function reschedulePolicy(
  record: BookingRecord,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): ReschedulePolicy {
  const config = availabilityConfig(env);
  const cutoffHours = config.rescheduleCutoffHours;
  if (!record.slot) {
    return {
      allowed: false,
      cutoffHours,
      deadline: null,
      deadlineLabel: null,
      reason: "no-slot",
    };
  }
  const deadlineMs = Date.parse(record.slot.start) - cutoffHours * 3_600_000;
  const deadline = new Date(deadlineMs).toISOString();
  const base = {
    cutoffHours,
    deadline,
    deadlineLabel: formatMoment(deadline, config.timeZone),
  };
  if (record.status !== "paid") {
    return { ...base, allowed: false, reason: "not-paid" };
  }
  if (Date.parse(record.slot.end) <= now.getTime()) {
    return { ...base, allowed: false, reason: "past" };
  }
  if (now.getTime() > deadlineMs) {
    return { ...base, allowed: false, reason: "too-late" };
  }
  return { ...base, allowed: true };
}

export type CancellationQuote = {
  /** Can the customer cancel themselves right now? */
  allowed: boolean;
  /** "full-refund" outside the cutoff, "late-fee" inside it. */
  policy: "full-refund" | "late-fee";
  cutoffHours: number;
  hoursBeforeStart: number;
  paidCents: number;
  paidLabel: string;
  /** The policy fee, whether or not it applies to this cancellation right now. */
  lateFeeCents: number;
  lateFeeLabel: string;
  /** What would actually be retained if the customer cancelled at this moment. */
  feeCents: number;
  feeLabel: string;
  refundCents: number;
  refundLabel: string;
  /** Last moment a cancellation is still a full refund. */
  fullRefundUntil: string | null;
  fullRefundUntilLabel: string | null;
  reason?: "not-paid" | "no-slot" | "started" | "already-cancelled";
};

/**
 * Prestige cancellation policy (2026-09-24):
 * - 24+ hours before the window starts → full refund.
 * - inside 24 hours → keep a $25 late-cancellation fee, refund the rest.
 * Both numbers live in src/data/availability.json (`cancelCutoffHours`,
 * `lateCancelFeeCents`). After the window has started it stops being a
 * self-service cancellation and becomes a phone call.
 */
export function cancellationQuote(
  record: BookingRecord,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): CancellationQuote {
  const config = availabilityConfig(env);
  const cutoffHours = config.cancelCutoffHours;
  const paidCents = record.totalCents;
  const startMs = record.slot ? Date.parse(record.slot.start) : NaN;
  const hoursBeforeStart = Number.isNaN(startMs)
    ? 0
    : Math.round(((startMs - now.getTime()) / 3_600_000) * 10) / 10;
  const late = !Number.isNaN(startMs) && hoursBeforeStart < cutoffHours;
  const feeCents = late ? Math.min(config.lateCancelFeeCents, paidCents) : 0;
  const refundCents = Math.max(0, paidCents - feeCents);
  const fullRefundUntil = Number.isNaN(startMs)
    ? null
    : new Date(startMs - cutoffHours * 3_600_000).toISOString();

  const base = {
    policy: (late ? "late-fee" : "full-refund") as "full-refund" | "late-fee",
    cutoffHours,
    hoursBeforeStart,
    paidCents,
    paidLabel: formatMoney(paidCents),
    lateFeeCents: config.lateCancelFeeCents,
    lateFeeLabel: formatMoney(config.lateCancelFeeCents),
    feeCents,
    feeLabel: formatMoney(feeCents),
    refundCents,
    refundLabel: formatMoney(refundCents),
    fullRefundUntil,
    fullRefundUntilLabel: fullRefundUntil
      ? formatMoment(fullRefundUntil, config.timeZone)
      : null,
  };

  if (record.status === "cancelled") {
    return { ...base, allowed: false, reason: "already-cancelled" };
  }
  if (record.status !== "paid") {
    return { ...base, allowed: false, reason: "not-paid" };
  }
  if (!record.slot) return { ...base, allowed: false, reason: "no-slot" };
  if (startMs <= now.getTime()) {
    return { ...base, allowed: false, reason: "started" };
  }
  return { ...base, allowed: true };
}

export type PublicBooking = {
  reference: string;
  status: BookingRecord["status"];
  slot: BookingSlot | null;
  packageName: string;
  addonNames: string[];
  totalLabel: string;
  reschedule: ReschedulePolicy;
  cancellation: CancellationQuote;
  /** Present once the booking has actually been cancelled. */
  cancelled?: BookingRecord["cancellation"];
};

/** Everything the customer is allowed to see about their own booking. */
export function publicBooking(
  record: BookingRecord,
  now: Date = new Date(),
): PublicBooking {
  return {
    reference: record.id,
    status: record.status,
    slot: record.slot,
    packageName: record.packageName,
    addonNames: record.addonNames,
    totalLabel: formatMoney(record.totalCents),
    reschedule: reschedulePolicy(record, now),
    cancellation: cancellationQuote(record, now),
    cancelled: record.cancellation,
  };
}

/**
 * Cancel a paid booking: refund per policy, put the window back on the board,
 * pull the Google Calendar event, and tell the shop which refund was executed.
 */
export async function cancelPaidBooking(
  bookingId: string,
  now: Date = new Date(),
): Promise<BookingRecord> {
  const record = await getBooking(bookingId);
  if (!record) throw new BookingError("not-found", "We could not find that booking.");
  if (record.status === "cancelled") return record;

  const quote = cancellationQuote(record, now);
  if (!quote.allowed) {
    if (quote.reason === "not-paid") {
      throw new BookingError(
        "not-paid",
        "That booking is not paid, so there is nothing to refund.",
      );
    }
    if (quote.reason === "no-slot") {
      throw new BookingError(
        "no-slot",
        `That payment has no scheduled window. Call ${site.phone} and we will sort the refund out.`,
      );
    }
    throw new BookingError(
      "too-late",
      `That window has already started, so it cannot be cancelled online. Call ${site.phone}.`,
    );
  }

  const refund = await refundSquarePayment(
    record.square.paymentId,
    quote.refundCents,
    quote.policy === "late-fee"
      ? `Prestige cancellation inside ${quote.cutoffHours}h — ${quote.feeLabel} late fee retained`
      : "Prestige cancellation — full refund",
  );

  let slotReleased = false;
  if (record.slot) {
    const hold = await getHold(record.slot.id);
    if (hold?.bookingId === record.id) {
      await releaseSlot(record.slot.id);
      slotReleased = true;
    }
  }

  const calendar: CalendarResult = record.hold?.calendarEventId
    ? await deleteCalendarHold(record.hold.calendarEventId)
    : { status: "skipped", detail: "No calendar event on this booking" };

  const cancelled =
    (await updateBooking(bookingId, {
      status: "cancelled",
      cancellation: {
        cancelledAt: new Date(now).toISOString(),
        hoursBeforeStart: quote.hoursBeforeStart,
        policy: quote.policy,
        feeCents: quote.feeCents,
        refundCents: quote.refundCents,
        refundStatus: refund.status,
        refundId: refund.refundId,
        refundDetail: refund.detail,
        slotReleased,
      },
    })) || record;

  const refundLine =
    refund.status === "issued"
      ? `Square refund issued: ${quote.refundLabel} (refund id ${refund.refundId}).`
      : refund.status === "not-needed"
        ? `No refund due — the ${quote.feeLabel} fee covers the full amount paid.`
        : `ACTION REQUIRED — refund ${quote.refundLabel} to this customer in Square by hand (${refund.detail}).`;

  await notifyOwnerFromServer({
    subject: `Prestige CANCELLED (${
      quote.policy === "late-fee" ? `late, keep ${quote.feeLabel}` : "full refund"
    }) — ${record.slot?.label || record.packageName}`,
    name: record.customer.name || "Prestige customer",
    phone: record.customer.phone,
    message: [
      quote.policy === "late-fee"
        ? `LATE CANCELLATION — inside ${quote.cutoffHours} hours (${quote.hoursBeforeStart}h before the window).`
        : `CANCELLED with ${quote.hoursBeforeStart}h notice — full refund per policy.`,
      "",
      `Paid: ${quote.paidLabel}`,
      `Late-cancellation fee retained: ${quote.feeLabel}`,
      `Refund owed to customer: ${quote.refundLabel}`,
      refundLine,
      "",
      bookingSummary(record),
      "",
      slotReleased
        ? "The window is back on the booking board."
        : "No hold was attached to this booking.",
      calendar.status === "deleted"
        ? "Google Calendar: event removed."
        : googleCalendarConfigured() && record.hold?.calendarEventId
          ? `Google Calendar: FAILED to remove (${calendar.detail}). Delete the event by hand.`
          : "Google Calendar: nothing to remove on this deploy — clear the window by hand if you blocked it.",
    ].join("\n"),
  }).catch(() => null);

  return cancelled;
}

/**
 * Move a paid booking to another open window: hold the new one, release the old
 * one, drag the Google Calendar event along, and tell the shop.
 */
export async function rescheduleBooking(
  bookingId: string,
  newSlotId: string,
  now: Date = new Date(),
): Promise<BookingRecord> {
  const record = await getBooking(bookingId);
  if (!record) throw new BookingError("not-found", "We could not find that booking.");

  const policy = reschedulePolicy(record, now);
  if (!policy.allowed) {
    if (policy.reason === "not-paid") {
      throw new BookingError(
        "not-paid",
        "That booking is not paid yet, so there is nothing to move.",
      );
    }
    if (policy.reason === "no-slot") {
      throw new BookingError(
        "no-slot",
        "That payment has no scheduled window on it.",
      );
    }
    throw new BookingError(
      "too-late",
      `Changes close ${policy.cutoffHours} hours before the window starts. Call ${site.phone} and we will move it for you.`,
    );
  }

  const previous = record.slot as BookingSlot;
  const target = describeSlot(newSlotId);
  if (!target) {
    throw new BookingError("slot-unknown", "That time is not a Prestige window.");
  }
  if (target.id === previous.id) return record;
  if (!(await isSlotOpen(newSlotId, now))) {
    throw new BookingError(
      "slot-taken",
      "That window is already taken. Pick another open time.",
    );
  }

  const held = await holdSlot({
    slotId: target.id,
    bookingId: record.id,
    start: target.start,
    end: target.end,
    heldAt: new Date().toISOString(),
  });
  if (!held) {
    throw new BookingError(
      "slot-taken",
      "That window is already taken. Pick another open time.",
    );
  }

  const oldHold = await getHold(previous.id);
  if (oldHold?.bookingId === record.id) await releaseSlot(previous.id);

  const slot: BookingSlot = {
    id: target.id,
    start: target.start,
    end: target.end,
    label: target.label,
    durationMinutes: target.durationMinutes,
  };
  const moved =
    (await updateBooking(bookingId, {
      slot,
      previousSlots: [...(record.previousSlots || []), previous],
    })) || record;

  const config = availabilityConfig();
  const eventInput = {
    summary: `Prestige detail — ${moved.packageName}${
      moved.customer.name ? ` (${moved.customer.name})` : ""
    }`,
    description: bookingSummary(moved),
    startIso: slot.start,
    endIso: slot.end,
    timeZone: config.timeZone,
    location: moved.customer.location,
  };
  const calendar: CalendarResult = moved.hold?.calendarEventId
    ? await updateCalendarHold(moved.hold.calendarEventId, eventInput)
    : await createCalendarHold(eventInput);

  await notifyOwnerFromServer({
    subject: `Prestige RESCHEDULED — ${slot.label}`,
    name: moved.customer.name || "Prestige customer",
    phone: moved.customer.phone,
    message: [
      "A paid customer moved their own booking.",
      `Was: ${previous.label}`,
      `Now: ${slot.label}`,
      "",
      bookingSummary(moved),
      "",
      calendar.status === "created"
        ? `Google Calendar: event moved (${calendar.eventId}).`
        : googleCalendarConfigured()
          ? `Google Calendar: FAILED (${calendar.detail}). Move the event by hand.`
          : "Google Calendar: not connected on this deploy — move the event by hand on the Prestige calendar.",
    ].join("\n"),
  }).catch(() => null);

  return (
    (await updateBooking(bookingId, {
      hold: {
        heldAt: moved.hold?.heldAt || new Date().toISOString(),
        calendarEventId: calendar.eventId || moved.hold?.calendarEventId,
        calendarStatus: calendar.status,
        calendarDetail: calendar.detail,
        notified: moved.hold?.notified ?? false,
      },
    })) || moved
  );
}
