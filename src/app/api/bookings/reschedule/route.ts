import { NextRequest, NextResponse } from "next/server";
import { BookingError, publicBooking, rescheduleBooking } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings/reschedule  { ref, slotId }
 *
 * Moves a paid booking to another open window, but only while the customer is
 * outside the cutoff (24 hours before the start by default — see
 * `rescheduleCutoffHours` in src/data/availability.json). Inside the cutoff this
 * answers 409 with `code: "too-late"` and the caller is told to phone the shop.
 *
 * Reply 200: { booking: <same shape as /api/bookings/lookup> }
 * Reply 409: { error: "<message for the customer>", code: BookingErrorCode }
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    ref?: string;
    bookingId?: string;
    slotId?: string;
  };
  const ref = (body.ref || body.bookingId || "").trim().slice(0, 128);
  const slotId = (body.slotId || "").trim().slice(0, 24);
  if (!ref || !slotId) {
    return NextResponse.json(
      { error: "ref and slotId required" },
      { status: 400 },
    );
  }

  try {
    const record = await rescheduleBooking(ref, slotId);
    return NextResponse.json({ booking: publicBooking(record) });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === "not-found" ? 404 : 409 },
      );
    }
    console.error("reschedule failed", err);
    return NextResponse.json({ error: "Could not move that booking." }, { status: 500 });
  }
}
