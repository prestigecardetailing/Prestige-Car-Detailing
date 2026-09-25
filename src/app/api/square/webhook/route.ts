import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { confirmBooking } from "@/lib/bookings";
import { squareOrderBookingId } from "@/lib/square";

export const dynamic = "force-dynamic";

/**
 * POST /api/square/webhook
 *
 * Belt-and-braces hold-after-pay: the success page can be closed before it runs,
 * but Square still tells us the payment completed. Point a Square webhook
 * subscription (payment.created / payment.updated) at this URL and set
 * SQUARE_WEBHOOK_SIGNATURE_KEY. Without that key the route rejects everything.
 */
function verifySignature(request: NextRequest, rawBody: string) {
  const key = (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "").trim();
  if (!key) return false;
  const signature = request.headers.get("x-square-hmacsha256-signature") || "";
  if (!signature) return false;

  const url =
    (process.env.SQUARE_WEBHOOK_URL || "").trim() ||
    `${request.nextUrl.origin}/api/square/webhook`;
  const expected = createHmac("sha256", key).update(url + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySignature(request, rawBody)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const type = String(event.type || "");
  const payment = (
    event.data as { object?: { payment?: Record<string, unknown> } } | undefined
  )?.object?.payment;

  if (!type.startsWith("payment.") || !payment) {
    return NextResponse.json({ ok: true, ignored: type || "unknown" });
  }

  const status = String(payment.status || "").toUpperCase();
  if (status !== "COMPLETED") {
    return NextResponse.json({ ok: true, ignored: `payment ${status}` });
  }

  const orderId = payment.order_id ? String(payment.order_id) : undefined;
  const bookingId =
    (payment.reference_id ? String(payment.reference_id) : "") ||
    (orderId ? (await squareOrderBookingId(orderId)) || "" : "");

  if (!bookingId) {
    return NextResponse.json({ ok: true, ignored: "no booking reference" });
  }

  const result = await confirmBooking(bookingId, {
    verification: "square-webhook",
    square: { orderId, paymentId: payment.id ? String(payment.id) : undefined },
  });

  return NextResponse.json({ ok: result.ok, status: result.status });
}
