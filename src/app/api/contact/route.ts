import { NextRequest, NextResponse } from "next/server";
import { FORMSUBMIT_AJAX_HASH } from "@/lib/site";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const company = String(body.company || "").trim();

  if (company) {
    return NextResponse.json({ delivered: true, spam: true });
  }
  if (!name || phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json(
      { error: "Name and phone required", delivered: false },
      { status: 400 },
    );
  }

  const message = [
    `Intent: ${body.intent || "intake"}`,
    `Phone: ${phone}`,
    `Location: ${body.location || ""}`,
    `Vehicle: ${body.vehicle || ""}`,
    "",
    String(body.message || ""),
  ].join("\n");

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
          _subject: `Prestige Car Wash contact from ${name}`,
          _template: "box",
          _captcha: "false",
          name,
          phone,
          vehicle: body.vehicle || "",
          location: body.location || "",
          message,
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    const delivered =
      res.ok && data.success !== false && data.success !== "false";
    if (!delivered) {
      return NextResponse.json({ delivered: false }, { status: 503 });
    }
    return NextResponse.json({ delivered: true });
  } catch (err) {
    console.warn("contact notify failed", err);
    return NextResponse.json({ delivered: false }, { status: 503 });
  }
}
