import { NextRequest, NextResponse } from "next/server";
import type { BookingRecord } from "@/lib/booking-store";
import { getBooking } from "@/lib/booking-store";
import {
  confirmBooking,
  flagBookingForReview,
  reschedulePolicy,
} from "@/lib/bookings";
import { hasSquareApi, verifySquarePayment } from "@/lib/square";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings/confirm
 *
 * Called by /pay/success with whatever Square appended to the redirect
 * (checkoutId / orderId / transactionId / referenceId) plus our own booking id.
 * The hold is written only when Square says the money cleared, so reloading this
 * page — or hitting it without paying — never takes a window off the board.
 *
 * Body: { bookingId?, referenceId?, orderId?, transactionId?, checkoutId?, adminToken? }
 * Reply: {
 *   status: "held" | "unpaid" | "review" | "unknown",
 *   slot?, conflict?,
 *   reference?,   // booking reference the customer uses on /reschedule
 *   reschedule?   // { allowed, cutoffHours, deadline, deadlineLabel }
 * }
 */
function heldReply(record: BookingRecord | undefined, conflict: boolean) {
  return NextResponse.json({
    status: "held",
    slot: record?.slot || null,
    reference: record?.id,
    reschedule: record ? reschedulePolicy(record) : null,
    conflict,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, 128) : undefined;

  const bookingId = str(body.bookingId) || str(body.referenceId);
  if (!bookingId) {
    return NextResponse.json({ status: "unknown" }, { status: 400 });
  }

  const booking = await getBooking(bookingId);
  if (!booking) {
    return NextResponse.json({ status: "unknown" }, { status: 404 });
  }

  const orderId = str(body.orderId);
  const paymentId = str(body.transactionId) || str(body.paymentId);
  const checkoutId = str(body.checkoutId);

  const adminToken = (process.env.PRESTIGE_ADMIN_TOKEN || "").trim();
  const presented = str(body.adminToken) || "";
  if (adminToken && presented && presented === adminToken) {
    const result = await confirmBooking(bookingId, {
      verification: "manual",
      square: { orderId, paymentId, checkoutId },
    });
    return heldReply(result.booking, result.reason === "slot-conflict");
  }

  if (booking.status === "paid" && booking.hold) {
    return heldReply(booking, false);
  }

  const check = await verifySquarePayment({ orderId, paymentId });
  if (check.paid) {
    const result = await confirmBooking(bookingId, {
      verification: "square-api",
      square: {
        orderId: check.orderId || orderId,
        paymentId: check.paymentId || paymentId,
        checkoutId,
      },
    });
    return heldReply(result.booking, result.reason === "slot-conflict");
  }

  if (check.checked) {
    // Square answered and the charge is not complete — leave the window open.
    return NextResponse.json({ status: "unpaid", slot: booking.slot });
  }

  const flagged = await flagBookingForReview(booking);
  return NextResponse.json({
    status: "review",
    slot: flagged.slot,
    squareApi: hasSquareApi(),
  });
}
