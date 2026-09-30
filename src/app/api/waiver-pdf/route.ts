import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  WAIVER_CLOSING,
  WAIVER_DISCLAIMER,
  WAIVER_SECTIONS,
  WAIVER_TITLE,
  WAIVER_VERSION,
} from "@/lib/waiver";
import { storeWaiverPdf } from "@/lib/waiver-store";

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** "prestige-waiver-jane-q-doe-2026-09-29.pdf" — filesystem and Drive friendly. */
function waiverFilename(name: string, agreedAt: string) {
  const person =
    name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 48) || "customer";
  const signedMs = Date.parse(agreedAt);
  const day = new Date(Number.isNaN(signedMs) ? Date.now() : signedMs)
    .toISOString()
    .slice(0, 10);
  return `prestige-waiver-${person}-${day}.pdf`;
}

async function buildPdf(input: {
  name: string;
  agreedAt: string;
  packageName?: string;
}) {
  const doc = await PDFDocument.create();

  // Metadata so the file is identifiable on its own, without the email around it.
  const signedMs = Date.parse(input.agreedAt);
  const signedAt = new Date(Number.isNaN(signedMs) ? Date.now() : signedMs);
  doc.setTitle(
    `Prestige Car Wash liability waiver — ${input.name} — ${signedAt
      .toISOString()
      .slice(0, 10)}`,
  );
  doc.setAuthor(input.name);
  doc.setSubject(
    `Signed ${WAIVER_TITLE} (version ${WAIVER_VERSION}) for ${
      input.packageName || "a Prestige Car Wash detail"
    }`,
  );
  doc.setKeywords([
    "Prestige Car Wash",
    "liability waiver",
    input.name,
    signedAt.toISOString().slice(0, 10),
    WAIVER_VERSION,
  ]);
  doc.setCreationDate(signedAt);
  doc.setModificationDate(signedAt);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([612, 792]);
  let y = 750;
  const left = 48;
  const maxWidthChars = 88;

  const ensureSpace = (needed: number) => {
    if (y - needed < 48) {
      page = doc.addPage([612, 792]);
      y = 750;
    }
  };

  const write = (
    text: string,
    opts?: { bold?: boolean; size?: number; gap?: number },
  ) => {
    const size = opts?.size ?? 10;
    const useBold = opts?.bold ?? false;
    const lines = wrapText(text, maxWidthChars);
    for (const line of lines) {
      ensureSpace(size + 4);
      page.drawText(line, {
        x: left,
        y,
        size,
        font: useBold ? bold : font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= size + 4;
    }
    y -= opts?.gap ?? 6;
  };

  write(WAIVER_TITLE, { bold: true, size: 14, gap: 10 });
  write(WAIVER_DISCLAIMER, { size: 9, gap: 10 });
  write(`Signed by: ${input.name}`);
  write(`Signed at: ${input.agreedAt}`);
  write(`Package: ${input.packageName || "Signed before package selection"}`);
  write(`Waiver version: ${WAIVER_VERSION}`, { gap: 12 });
  write(
    "By booking and/or paying for services, I (the “Customer”) agree as follows:",
    { gap: 10 },
  );

  for (const section of WAIVER_SECTIONS) {
    write(section.heading, { bold: true, size: 11, gap: 4 });
    write(section.body, { gap: 10 });
  }
  write(WAIVER_CLOSING, { bold: true, gap: 8 });

  return doc.save();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const agreedAt = String(body.agreedAt || new Date().toISOString());
    if (name.length < 2) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    const bytes = await buildPdf({
      name,
      agreedAt,
      packageName: String(body.packageName || ""),
    });
    const stored = await storeWaiverPdf(bytes, waiverFilename(name, agreedAt));

    // Prefer absolute path-style PDF URLs so FormSubmit / mail clients keep the link
    const origin =
      request.headers.get("x-forwarded-host")
        ? `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("x-forwarded-host")}`
        : new URL(request.url).origin;
    const absoluteUrl = `${origin}/api/waiver-pdf/${stored.id}`;

    return NextResponse.json({
      url: absoluteUrl,
      filename: stored.filename,
      id: stored.id,
    });
  } catch (err) {
    console.error("waiver-pdf failed", err);
    return NextResponse.json(
      { error: "Could not create waiver PDF" },
      { status: 500 },
    );
  }
}
