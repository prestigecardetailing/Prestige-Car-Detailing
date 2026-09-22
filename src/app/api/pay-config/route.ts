import { NextRequest, NextResponse } from "next/server";
import { payConfigForSelection } from "@/lib/square";

export async function GET(request: NextRequest) {
  const packageId = request.nextUrl.searchParams.get("packageId") || "";
  const addonIds = (request.nextUrl.searchParams.get("addonIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!packageId) {
    return NextResponse.json(
      { mode: "disconnected", canChargeSelection: false },
      { status: 400 },
    );
  }

  const config = payConfigForSelection(packageId, addonIds);
  return NextResponse.json(config);
}
