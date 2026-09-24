import { NextRequest, NextResponse } from "next/server";
import { getBooking } from "@/lib/booking-store";
import { publicBooking } from "@/lib/bookings";
import { availabilityConfig, listOpenSlots } from "@/lib/slots";

export const dynamic = "force-dynamic";

/**
 * GET /api/bookings/lookup?ref=<booking reference>
 *
 * What the customer sees on /reschedule. The reference is the random booking id
 * shown on the payment confirmation, so it acts as the bearer token for this one
 * booking; nothing else about the customer is returned.
 *
 * Reply 200:
 * {
 *   "booking": {
 *     "reference": "902b40aaf8514fcb",
 *     "status": "paid",
 *     "slot": { "id": "2026-10-03T0800", "start": …, "end": …, "label": …, "durationMinutes": 240 },
 *     "packageName": "Interior Clean",
 *     "addonNames": [],
 *     "totalLabel": "$54.99",
 *     "reschedule": {
 *       "allowed": true,           // false once inside the cutoff
 *       "cutoffHours": 24,
 *       "deadline": "2026-10-02T12:00:00.000Z",
 *       "deadlineLabel": "Fri, Oct 2, 8:00 AM EDT",
 *       "reason": "too-late"       // only when allowed is false
 *     }
 *   },
 *   "slots": [ …same shape as /api/open-slots… ],   // empty unless a move is allowed
 *   "timeZone": "America/New_York",
 *   "slotMinutes": 240
 * }
 */
export async function GET(request: NextRequest) {
  const ref = (request.nextUrl.searchParams.get("ref") || "").trim();
  if (!ref) {
    return NextResponse.json({ error: "ref required" }, { status: 400 });
  }

  const record = await getBooking(ref);
  if (!record || record.status === "cancelled") {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const config = availabilityConfig();
  const booking = publicBooking(record);
  const slots = booking.reschedule.allowed ? await listOpenSlots() : [];

  return NextResponse.json(
    {
      booking,
      slots,
      timeZone: config.timeZone,
      slotMinutes: config.slotMinutes,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
