import { NextResponse } from "next/server";
import { createFeeCheckout } from "@/lib/square";

export const dynamic = "force-dynamic";

/**
 * POST /api/other-fee
 *
 * One-off charge for something that is not a package — a trip fee, an on-site
 * extra, a balance. It is a separate Square payment from any car wash booking: no
 * booking record, no slot hold, no waiver. When the Square API is configured the
 * link is created for the exact amount; otherwise the open-amount payment link
 * comes back and the customer types the amount on Square's screen.
 *
 * Body: { description: string, amountCents: number }
 * 200:  { url, amountCents, source }
 */
export async function POST(request: Request) {
  let body: { description?: unknown; amountCents?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }

  const description = String(body.description || "").trim();
  const amountCents = Math.round(Number(body.amountCents));

  if (!description) {
    return NextResponse.json(
      { error: "Say what the charge is for." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(amountCents) || amountCents < 1) {
    return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
  }
  if (amountCents > 2_000_000) {
    return NextResponse.json(
      { error: "That amount is too large for this form — call the shop." },
      { status: 400 },
    );
  }

  const result = await createFeeCheckout(description, amountCents);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
