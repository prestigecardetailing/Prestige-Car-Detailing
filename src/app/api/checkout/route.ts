import { NextRequest, NextResponse } from "next/server";
import { CatalogError } from "@/lib/catalog";
import { createCheckout } from "@/lib/square";
import { site } from "@/lib/site";

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
    const result = await createCheckout(packageId, addonIds, origin);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CatalogError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("checkout failed", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
