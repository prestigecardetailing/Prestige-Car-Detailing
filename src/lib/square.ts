import {
  SQUARE_LINK_OPEN_AMOUNT_DEFAULT,
  site,
} from "@/lib/site";
import { resolveSelection } from "@/lib/catalog";

type EnvLike = Record<string, string | undefined>;

const defaults = {
  SQUARE_LINK_OPEN_AMOUNT: SQUARE_LINK_OPEN_AMOUNT_DEFAULT,
};

export function squareEnv(env: EnvLike = process.env) {
  const out: Record<string, string> = { ...defaults };
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

export function hasSquareApi(env: EnvLike = process.env) {
  const e = squareEnv(env);
  return !!(e.SQUARE_ACCESS_TOKEN && e.SQUARE_LOCATION_ID);
}

function firstHttpsLink(env: EnvLike, ...keys: string[]) {
  const e = squareEnv(env);
  for (const key of keys) {
    const value = e[key]?.trim();
    if (
      value &&
      /^https:\/\//i.test(value) &&
      value !== "https://square.link/u/yIU7p3jx"
    ) {
      return value;
    }
  }
  return null;
}

export function openAmountLink(env: EnvLike = process.env) {
  return (
    firstHttpsLink(
      env,
      "SQUARE_LINK_OPEN_AMOUNT",
      "SQUARE_LINK_CUSTOM",
      "NEXT_PUBLIC_SQUARE_LINK_OPEN_AMOUNT",
      "NEXT_PUBLIC_SQUARE_LINK_CUSTOM",
    ) || SQUARE_LINK_OPEN_AMOUNT_DEFAULT
  );
}

export function paymentMode(env: EnvLike = process.env) {
  if (hasSquareApi(env)) return "square-api" as const;
  if (openAmountLink(env)) return "payment-links" as const;
  return "disconnected" as const;
}

export function payConfigForSelection(
  packageId: string,
  addonIds: string[] = [],
  env: EnvLike = process.env,
) {
  const mode = paymentMode(env);
  if (mode === "disconnected") {
    return { mode, canChargeSelection: false };
  }
  try {
    resolveSelection(packageId, addonIds);
    return {
      mode: mode === "square-api" ? "square-api" : "payment-links",
      canChargeSelection: true,
    };
  } catch {
    return { mode, canChargeSelection: false };
  }
}

async function createSquarePaymentLink(
  selection: ReturnType<typeof resolveSelection>,
  origin: string,
  env: EnvLike = process.env,
) {
  const e = squareEnv(env);
  const token = e.SQUARE_ACCESS_TOKEN;
  const locationId = e.SQUARE_LOCATION_ID;
  if (!token || !locationId) return null;

  const isProd =
    (e.SQUARE_ENVIRONMENT || "").toLowerCase() === "production";
  const base = isProd
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

  const res = await fetch(`${base}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": "2026-08-19",
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      description: "Prestige Car Wash prepaid detail",
      order: {
        location_id: locationId,
        line_items: selection.lines.map((line) => ({
          name: line.name,
          quantity: "1",
          base_price_money: { amount: line.priceCents, currency: "USD" },
        })),
      },
      checkout_options: {
        allow_tipping: false,
        ask_for_shipping_address: false,
        enable_coupon: false,
        enable_loyalty: false,
        redirect_url: `${origin.replace(/\/$/, "")}/pay/success`,
      },
      payment_note: `Prestige Car Wash — ${selection.pkg.name}`,
    }),
  });

  if (!res.ok) {
    console.error("Square checkout failed", { status: res.status });
    return null;
  }
  const data = await res.json();
  return (data.payment_link?.url as string | undefined) || null;
}

export async function createCheckout(
  packageId: string,
  addonIds: string[],
  origin: string = site.url,
  env: EnvLike = process.env,
) {
  const selection = resolveSelection(packageId, addonIds);
  if (hasSquareApi(env)) {
    const url = await createSquarePaymentLink(selection, origin, env);
    if (url) {
      return {
        url,
        totalCents: selection.totalCents,
        source: "square-api" as const,
      };
    }
  }
  return {
    url: openAmountLink(env),
    totalCents: selection.totalCents,
    source: "open-amount" as const,
  };
}
