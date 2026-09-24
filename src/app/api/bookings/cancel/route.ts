import { NextRequest, NextResponse } from "next/server";
import { cancelPendingBooking } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings/cancel  { bookingId }
 *
 * Undo before payment. Marks an unpaid booking cancelled and drops any hold that
 * points at it, so the window is back on /book immediately. A paid booking is
 * left alone — that one goes through /reschedule or a phone call.
 *
 * Reply: { status: "cancelled" | "paid" | "unknown" }
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { bookingId?: string };
  const bookingId = (body.bookingId || "").trim().slice(0, 128);
  if (!bookingId) {
    return NextResponse.json({ status: "unknown" }, { status: 400 });
  }

  const record = await cancelPendingBooking(bookingId);
  if (!record) return NextResponse.json({ status: "unknown" }, { status: 404 });
  if (record.status === "paid") {
    return NextResponse.json({ status: "paid", slot: record.slot });
  }
  return NextResponse.json({ status: "cancelled", slot: record.slot });
}
