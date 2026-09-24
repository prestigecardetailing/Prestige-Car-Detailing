import { NextRequest, NextResponse } from "next/server";
import { updateBooking } from "@/lib/booking-store";
import { BookingError, createPendingBooking } from "@/lib/bookings";
import { CatalogError } from "@/lib/catalog";
import { createCheckout } from "@/lib/square";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

function str(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const packageId = String(body.packageId || "");
    const addonIds = Array.isArray(body.addonIds)
      ? body.addonIds.map(String)
      : [];
    if (!packageId) {
      return NextResponse.json({ error: "packageId required" }, { status: 400 });
    }
    const origin =
      request.headers.get("origin") ||
      request.nextUrl.origin ||
      site.url;
    const slotId = str(body.slotId, 24) || null;

    // The booking is recorded as `pending` only. It holds nothing: if the
    // customer walks away from Square, the window stays on /book.
    const booking = await createPendingBooking({
      packageId,
      addonIds,
      slotId,
      source: "square-api",
      customer: {
        name: str(body.name, 80),
        phone: str(body.phone, 40),
        email: str(body.email, 120),
        vehicle: str(body.vehicle),
        location: str(body.location, 240),
      },
      waiver: body.waiver
        ? {
            name: str(body.waiver.name, 80),
            agreedAt: str(body.waiver.agreedAt, 40),
            pdfUrl: str(body.waiver.pdfUrl, 400),
            pdfId: str(body.waiver.pdfId, 64),
          }
        : null,
    });

    const result = await createCheckout(packageId, addonIds, origin, process.env, {
      bookingId: booking.id,
      slot: booking.slot
        ? {
            id: booking.slot.id,
            label: booking.slot.label,
            start: booking.slot.start,
          }
        : null,
    });

    // On the open-amount fallback link Square cannot carry our ids back, so the
    // browser keeps the booking id and the success page replays it.
    await updateBooking(booking.id, {
      square: { source: result.source, paymentLinkUrl: result.url },
    });

    return NextResponse.json({
      ...result,
      bookingId: booking.id,
      slot: booking.slot,
    });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409 },
      );
    }
    if (err instanceof CatalogError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("checkout failed", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
