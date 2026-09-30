import { NextResponse } from "next/server";
import { availabilityConfig, listOpenSlots, listSlotGrid } from "@/lib/slots";

export const dynamic = "force-dynamic";

/**
 * GET /api/open-slots
 *
 * Positive list only: every window Prestige currently has open and bookable.
 * A window disappears from this list the moment a payment is confirmed for it.
 * There is no "unavailable" list and no reason codes — if it is not here, do not
 * offer it. Built for the site's slot picker and for the phone/voice agent.
 *
 * Response 200:
 * {
 *   "timeZone": "America/New_York",   // all local times below are in this zone
 *   "slotMinutes": 240,               // appointment length (4 hours)
 *   "generatedAt": "2026-09-24T21:00:00.000Z",
 *   "count": 2,
 *   "slots": [
 *     {
 *       "id": "2026-10-03T0800",              // stable key; pass as /pay?slot=<id>
 *       "start": "2026-10-03T12:00:00.000Z",  // UTC instant the window starts
 *       "end": "2026-10-03T16:00:00.000Z",    // UTC instant the window ends
 *       "date": "2026-10-03",                 // local date
 *       "startTime": "08:00",                 // local 24h start
 *       "endTime": "12:00",                   // local 24h end
 *       "durationMinutes": 240,
 *       "label": "Fri, Oct 3 · 8:00 AM – 12:00 PM EDT",
 *       "bookUrl": "/book/details?slot=2026-10-03T0800"
 *     }
 *   ]
 * }
 *
 * Slots are sorted earliest first and are always in the future by at least the
 * configured lead time. Availability is whatever the owner set for that exact
 * date — on his Google Calendar, or in `src/data/availability.json`. No weekday
 * pattern is ever generated, so an empty list means nothing is open.
 *
 * `days` carries the same answer as a drawable grid for the /book page: one entry
 * per day, each cell tagged `open`, `booked`, or `closed`. Cells that are not
 * `open` exist so the page can gray them out; they are not bookable.
 *
 * `source` is "google-calendar" when the live calendar was read, "config" when the
 * checked-in availability file was used, or "google-calendar-unreachable" when the
 * calendar could not be read — in which case nothing is offered.
 *
 * `bookUrl` is the customer-information step. The full sequence is /book/service
 * (pick the car wash type) and /book (pick a window) in either order, then
 * /book/details?slot=<id>&package=<id> (name, phone, and service address
 * required; email optional) → /pay?slot=<id>&package=<id> (waiver + Square). The
 * slot is held only after Square confirms the payment, so a caller who drops out
 * at any point leaves the window in this list.
 */
export async function GET() {
  const config = availabilityConfig();
  const [slots, grid] = await Promise.all([listOpenSlots(), listSlotGrid()]);
  return NextResponse.json(
    {
      timeZone: config.timeZone,
      slotMinutes: config.slotMinutes,
      generatedAt: new Date().toISOString(),
      source: grid.source,
      count: slots.length,
      slots: slots.map((slot) => ({
        ...slot,
        bookUrl: `/book/details?slot=${encodeURIComponent(slot.id)}`,
      })),
      days: grid.days,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
