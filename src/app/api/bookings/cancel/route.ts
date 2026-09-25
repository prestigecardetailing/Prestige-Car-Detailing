import { NextRequest, NextResponse } from "next/server";
import {
  BookingError,
  cancelPaidBooking,
  cancelPendingBooking,
  cancellationQuote,
  publicBooking,
} from "@/lib/bookings";
import { getBooking } from "@/lib/booking-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings/cancel  { ref | bookingId, confirm? }
 *
 * Two jobs, split by whether money has moved:
 *
 * - Unpaid booking (undo before payment): marks the record cancelled and drops
 *   any hold pointing at it. Reply { status: "cancelled" }.
 * - Paid booking: without `confirm: true` this only quotes the refund, so the UI
 *   can show the exact numbers before the customer commits — reply
 *   { status: "quote", quote }. With `confirm: true` it refunds through Square,
 *   releases the window, removes the calendar event, and emails the shop —
 *   reply { status: "cancelled", booking }.
 *
 * The quote follows the Prestige policy: full refund 24+ hours out, otherwise a
 * $25 late-cancellation fee is retained and the remainder refunded.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    ref?: string;
    bookingId?: string;
    confirm?: boolean;
  };
  const ref = (body.ref || body.bookingId || "").trim().slice(0, 128);
  if (!ref) return NextResponse.json({ status: "unknown" }, { status: 400 });

  const record = await getBooking(ref);
  if (!record) return NextResponse.json({ status: "unknown" }, { status: 404 });

  if (record.status !== "paid") {
    const cancelled = await cancelPendingBooking(ref);
    return NextResponse.json({
      status: "cancelled",
      slot: cancelled?.slot || null,
    });
  }

  const quote = cancellationQuote(record);
  if (!body.confirm) {
    return NextResponse.json({ status: "quote", quote });
  }

  try {
    const cancelled = await cancelPaidBooking(ref);
    return NextResponse.json({
      status: "cancelled",
      booking: publicBooking(cancelled),
    });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === "not-found" ? 404 : 409 },
      );
    }
    console.error("cancel failed", err);
    return NextResponse.json(
      { error: "Could not cancel that booking." },
      { status: 500 },
    );
  }
}
