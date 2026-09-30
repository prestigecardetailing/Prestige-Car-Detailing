import { NextRequest, NextResponse } from "next/server";
import { postToHub } from "@/lib/hub-ingest";
import { notifyOwnerFromServer } from "@/lib/notify-owner";

type WaiverBody = {
  name?: string;
  agreedAt?: string;
  packageId?: string;
  addonIds?: string[];
  pdfUrl?: string;
  pdfFilename?: string;
  userAgent?: string;
};

/**
 * Server-side copy of the signed waiver. The browser already emails the shop, but
 * this is the path that does not depend on the customer's tab staying open — the
 * PDF link has to reach the owner inbox so the waiver can be filed later.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as WaiverBody;
  const name = String(body.name || "").trim();
  if (name.length < 2) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const agreedAt = String(body.agreedAt || new Date().toISOString());
  const message = [
    "Signed liability waiver — Prestige Car Wash",
    `Legal name (signature): ${name}`,
    `Signed at: ${agreedAt}`,
    `Package id: ${body.packageId || "(before selection)"}`,
    `Add-ons: ${(body.addonIds || []).join(", ") || "None"}`,
    body.pdfUrl ? `PDF: ${body.pdfUrl}` : "",
    body.pdfFilename ? `PDF filename: ${body.pdfFilename}` : "",
    body.userAgent ? `User-Agent: ${body.userAgent}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const notify = await notifyOwnerFromServer({
    subject: `Prestige Car Wash waiver — ${name}`,
    name,
    message,
    pdf: body.pdfUrl || "",
  }).catch(() => ({ status: "failed" as const }));

  await postToHub("waiver", body.pdfFilename || name, {
    signerName: name,
    agreedAt,
    packageId: body.packageId || null,
    addonIds: body.addonIds || [],
    pdfUrl: body.pdfUrl || null,
    pdfFilename: body.pdfFilename || null,
  }).catch(() => null);

  return NextResponse.json({ ok: true, delivered: notify.status === "sent" });
}
