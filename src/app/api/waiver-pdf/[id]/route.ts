import { NextRequest, NextResponse } from "next/server";
import { getWaiverPdf } from "@/lib/waiver-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const record = await getWaiverPdf(id);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(record.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${record.filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
