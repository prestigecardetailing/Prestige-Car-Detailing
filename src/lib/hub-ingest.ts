import { site } from "@/lib/site";

/**
 * Server-side ingest into the McElreath Intelligence hub.
 *
 * There was no existing hub client in this repo, so this is the one place that
 * knows how to talk to it. Everything the shop records — bookings, accounts,
 * payment metadata, signed waivers — posts through here.
 *
 * Configuration (both required before anything is sent):
 *   PRESTIGE_HUB_INGEST_URL     — the hub endpoint, e.g. https://…/api/ingest
 *   PRESTIGE_HUB_INGEST_SECRET  — bearer token the hub checks
 *
 * With either missing this is a logged no-op. It never throws and never blocks a
 * payment, a hold, a calendar event, or an owner notification.
 *
 * Nothing secret goes over this wire: no card data (Square never gives us any)
 * and no passwords (only the fact that an account has one).
 */

type EnvLike = Record<string, string | undefined>;

export type HubIngestKind = "booking" | "account" | "waiver" | "payment";

export type HubIngestResult = {
  status: "sent" | "failed" | "skipped";
  detail?: string;
};

export function hubIngestConfigured(env: EnvLike = process.env) {
  return !!(
    (env.PRESTIGE_HUB_INGEST_URL || "").trim() &&
    (env.PRESTIGE_HUB_INGEST_SECRET || "").trim()
  );
}

export async function postToHub(
  kind: HubIngestKind,
  reference: string,
  data: Record<string, unknown>,
  env: EnvLike = process.env,
): Promise<HubIngestResult> {
  const url = (env.PRESTIGE_HUB_INGEST_URL || "").trim();
  const secret = (env.PRESTIGE_HUB_INGEST_SECRET || "").trim();
  const payload = {
    kind,
    reference,
    source: site.domain,
    at: new Date().toISOString(),
    data,
  };

  if (!url || !secret) {
    console.info(
      `[hub:skipped] ${kind} ${reference} — set PRESTIGE_HUB_INGEST_URL and PRESTIGE_HUB_INGEST_SECRET to enable ingest`,
    );
    return { status: "skipped", detail: "Hub ingest not configured" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "X-Prestige-Kind": kind,
        "X-Prestige-Reference": reference,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = `HTTP ${res.status}`;
      console.error(`[hub:failed] ${kind} ${reference} ${detail}`);
      return { status: "failed", detail };
    }
    console.info(`[hub:sent] ${kind} ${reference}`);
    return { status: "sent" };
  } catch (err) {
    console.error(`[hub:failed] ${kind} ${reference} threw`, err);
    return { status: "failed", detail: "exception" };
  }
}
