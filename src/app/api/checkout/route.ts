import { NextRequest, NextResponse } from "next/server";
import { currentAccount } from "@/lib/account-session";
import { attachBookingToAccount, findAccountByPhone } from "@/lib/accounts";
import { updateBooking } from "@/lib/booking-store";
import { BookingError, createPendingBooking } from "@/lib/bookings";
import { CatalogError } from "@/lib/catalog";
import { validateContact } from "@/lib/contact";
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
    // Caller info is required before any booking is confirmed, and the form is
    // not the only way in — enforce it here too.
    const contact = validateContact({
      firstName: body.firstName,
      lastName: body.lastName,
      name: body.name,
      phone: body.phone,
      address: body.address ?? body.location,
      city: body.city,
      state: body.state,
      zip: body.zip,
      email: body.email,
    });
    if (!contact.ok) {
      return NextResponse.json(
        {
          error:
            "First and last name, a callback phone, and the full service address — street, city, state, and ZIP — are required before payment.",
          code: "contact-required",
          fields: contact.errors,
        },
        { status: 400 },
      );
    }

    const origin =
      request.headers.get("origin") ||
      request.nextUrl.origin ||
      site.url;
    const slotId = str(body.slotId, 24) || null;

    // Link the booking to an account when there is one: the signed-in session
    // first, otherwise an existing account on this phone number. Booking never
    // requires an account, so a miss here is not an error.
    const session = await currentAccount().catch(() => null);
    const account =
      session || (await findAccountByPhone(contact.value.phone).catch(() => null));

    // The booking is recorded as `pending` only. It holds nothing: if the
    // customer walks away from Square, the window stays on /book.
    const booking = await createPendingBooking({
      packageId,
      addonIds,
      slotId,
      source: "square-api",
      accountId: account?.id,
      customer: {
        name: contact.value.name,
        firstName: contact.value.firstName,
        lastName: contact.value.lastName,
        phone: contact.value.phoneDisplay,
        email: contact.value.email || undefined,
        vehicle: str(body.vehicle),
        location: contact.value.fullAddress,
        address: contact.value.address,
        city: contact.value.city,
        state: contact.value.state,
        zip: contact.value.zip,
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

    if (account) {
      await attachBookingToAccount(account.id, booking.id).catch(() => null);
    }

    const result = await createCheckout(packageId, addonIds, origin, process.env, {
      bookingId: booking.id,
      slot: booking.slot
        ? {
            id: booking.slot.id,
            label: booking.slot.label,
            start: booking.slot.start,
          }
        : null,
      buyer: {
        name: contact.value.name,
        phone: contact.value.phone,
        email: contact.value.email || undefined,
      },
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
