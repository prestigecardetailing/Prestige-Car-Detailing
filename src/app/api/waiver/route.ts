import { NextRequest, NextResponse } from "next/server";
import { FORMSUBMIT_AJAX_HASH } from "@/lib/site";

type WaiverBody = {
  name?: string;
  agreedAt?: string;
  packageId?: string;
  addonIds?: string[];
  pdfUrl?: string;
  pdfFilename?: string;
  userAgent?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as WaiverBody;
  const name = String(body.name || "").trim();
  if (name.length < 2) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const agreedAt = String(body.agreedAt || new Date().toISOString());
  const message = [
    "Signed liability waiver — Prestige Car Wash",
    `Legal name: ${name}`,
    `Signed at: ${agreedAt}`,
    `Package id: ${body.packageId || "(before selection)"}`,
    `Add-ons: ${(body.addonIds || []).join(", ") || "None"}`,
    body.pdfUrl ? `PDF: ${body.pdfUrl}` : "",
    body.pdfFilename ? `PDF filename: ${body.pdfFilename}` : "",
    body.userAgent ? `User-Agent: ${body.userAgent}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let delivered = false;
  try {
    const res = await fetch(
      `https://formsubmit.co/ajax/${FORMSUBMIT_AJAX_HASH}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          _subject: `Prestige Car Wash waiver — ${name}`,
          _template: "box",
          _captcha: "false",
          name,
          message,
          pdf: body.pdfUrl || "",
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    delivered =
      res.ok && data.success !== false && data.success !== "false";
  } catch (err) {
    console.warn("waiver notify failed", err);
  }

  return NextResponse.json({ ok: true, delivered });
}
