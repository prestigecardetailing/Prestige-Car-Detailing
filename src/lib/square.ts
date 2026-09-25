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

export function squareApiBase(env: EnvLike = process.env) {
  const e = squareEnv(env);
  // Escape hatch for local end-to-end runs against a stub Square. Never set in production.
  const override = e.SQUARE_API_BASE_URL;
  if (override && /^https?:\/\//i.test(override)) {
    return override.replace(/\/$/, "");
  }
  const isProd = (e.SQUARE_ENVIRONMENT || "").toLowerCase() === "production";
  return isProd
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

const SQUARE_VERSION = "2026-08-19";

export type CheckoutContext = {
  /** Our pending-booking id. Rides along as the Square order reference_id. */
  bookingId?: string;
  /** Slot the customer picked, for the Square order metadata and the redirect. */
  slot?: { id: string; label: string; start: string } | null;
};

async function createSquarePaymentLink(
  selection: ReturnType<typeof resolveSelection>,
  origin: string,
  context: CheckoutContext,
  env: EnvLike = process.env,
) {
  const e = squareEnv(env);
  const token = e.SQUARE_ACCESS_TOKEN;
  const locationId = e.SQUARE_LOCATION_ID;
  if (!token || !locationId) return null;

  // Slot metadata has to survive the trip through Square. Three carriers, because
  // Square only appends its own params (checkoutId/orderId/transactionId/
  // referenceId) on production links:
  //   1. reference_id -> comes back as ?referenceId=<bookingId>
  //   2. our own ?booking=<bookingId> on the redirect URL
  //   3. sessionStorage on the client (see pay-form.tsx)
  const redirect = new URL(`${origin.replace(/\/$/, "")}/pay/success`);
  if (context.bookingId) redirect.searchParams.set("booking", context.bookingId);
  if (context.slot?.id) redirect.searchParams.set("slot", context.slot.id);

  const res = await fetch(`${squareApiBase(env)}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      description: context.slot
        ? `Prestige Car Wash prepaid detail — ${context.slot.label}`
        : "Prestige Car Wash prepaid detail",
      order: {
        location_id: locationId,
        ...(context.bookingId ? { reference_id: context.bookingId } : {}),
        line_items: selection.lines.map((line) => ({
          name: line.name,
          quantity: "1",
          base_price_money: { amount: line.priceCents, currency: "USD" },
        })),
        metadata: {
          ...(context.bookingId ? { booking_id: context.bookingId } : {}),
          ...(context.slot
            ? { slot_id: context.slot.id, slot_start: context.slot.start }
            : {}),
        },
      },
      checkout_options: {
        allow_tipping: false,
        ask_for_shipping_address: false,
        enable_coupon: false,
        enable_loyalty: false,
        redirect_url: redirect.toString(),
      },
      payment_note: context.slot
        ? `Prestige Car Wash — ${selection.pkg.name} — ${context.slot.label}`
        : `Prestige Car Wash — ${selection.pkg.name}`,
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
  context: CheckoutContext = {},
) {
  const selection = resolveSelection(packageId, addonIds);
  if (hasSquareApi(env)) {
    const url = await createSquarePaymentLink(selection, origin, context, env);
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

export type SquarePaymentCheck = {
  paid: boolean;
  checked: boolean;
  orderId?: string;
  paymentId?: string;
  amountCents?: number;
  detail?: string;
};

async function squareGet(pathname: string, env: EnvLike) {
  const token = squareEnv(env).SQUARE_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(`${squareApiBase(env)}${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
  });
  if (!res.ok) {
    console.warn("Square GET failed", pathname, res.status);
    return null;
  }
  return res.json();
}

export type RefundResult = {
  status: "issued" | "failed" | "skipped" | "not-needed";
  refundId?: string;
  amountCents: number;
  detail?: string;
};

/**
 * Refund part or all of a Square payment (Refunds API).
 *
 * Needs the same SQUARE_ACCESS_TOKEN the checkout already uses plus the payment
 * id we recorded at confirmation time. When either is missing — the open-amount
 * `square.link` fallback never gives us a payment id — this returns `skipped`
 * and the caller tells the owner exactly what to refund by hand in Square.
 */
export async function refundSquarePayment(
  paymentId: string | undefined,
  amountCents: number,
  reason: string,
  env: EnvLike = process.env,
): Promise<RefundResult> {
  if (amountCents <= 0) {
    return { status: "not-needed", amountCents, detail: "Nothing to refund" };
  }
  if (!hasSquareApi(env)) {
    return {
      status: "skipped",
      amountCents,
      detail: "Square API not configured on this deploy",
    };
  }
  if (!paymentId) {
    return {
      status: "skipped",
      amountCents,
      detail: "No Square payment id on this booking",
    };
  }

  try {
    const res = await fetch(`${squareApiBase(env)}/v2/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${squareEnv(env).SQUARE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "Square-Version": SQUARE_VERSION,
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        payment_id: paymentId,
        amount_money: { amount: amountCents, currency: "USD" },
        reason: reason.slice(0, 192),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail =
        data?.errors?.[0]?.detail || data?.errors?.[0]?.code || `HTTP ${res.status}`;
      console.error("Square refund failed", detail);
      return { status: "failed", amountCents, detail: String(detail) };
    }
    const refund = data.refund || {};
    return {
      status: "issued",
      refundId: refund.id,
      amountCents,
      detail: `refund ${String(refund.status || "PENDING")}`,
    };
  } catch (err) {
    console.error("Square refund threw", err);
    return { status: "failed", amountCents, detail: "exception" };
  }
}

/** Our booking id rides on the order as `reference_id` (and in `metadata`). */
export async function squareOrderBookingId(
  orderId: string,
  env: EnvLike = process.env,
): Promise<string | null> {
  const data = await squareGet(`/v2/orders/${encodeURIComponent(orderId)}`, env);
  const order = data?.order;
  if (!order) return null;
  return (
    (order.reference_id as string | undefined) ||
    (order.metadata?.booking_id as string | undefined) ||
    null
  );
}

/**
 * Ask Square whether the money actually landed. `checked: false` means we could
 * not reach the API (no token, or nothing to look up) — callers must treat that
 * as "not verified", never as paid.
 */
export async function verifySquarePayment(
  ids: { orderId?: string; paymentId?: string },
  env: EnvLike = process.env,
): Promise<SquarePaymentCheck> {
  if (!hasSquareApi(env)) {
    return { checked: false, paid: false, detail: "Square API not configured" };
  }

  if (ids.paymentId) {
    const data = await squareGet(`/v2/payments/${encodeURIComponent(ids.paymentId)}`, env);
    const payment = data?.payment;
    if (payment) {
      const status = String(payment.status || "").toUpperCase();
      return {
        checked: true,
        paid: status === "COMPLETED" || status === "APPROVED",
        paymentId: payment.id,
        orderId: payment.order_id || ids.orderId,
        amountCents: payment.amount_money?.amount,
        detail: `payment ${status}`,
      };
    }
  }

  if (ids.orderId) {
    const data = await squareGet(`/v2/orders/${encodeURIComponent(ids.orderId)}`, env);
    const order = data?.order;
    if (order) {
      const state = String(order.state || "").toUpperCase();
      const tenders: Array<Record<string, unknown>> = order.tenders || [];
      const settled = tenders.some((tender) => {
        const cardStatus = String(
          (tender.card_details as { status?: string } | undefined)?.status || "",
        ).toUpperCase();
        return !cardStatus || cardStatus === "CAPTURED" || cardStatus === "AUTHORIZED";
      });
      return {
        checked: true,
        paid: state === "COMPLETED" || (state === "OPEN" && settled),
        orderId: order.id,
        paymentId: (tenders[0]?.payment_id as string | undefined) || ids.paymentId,
        amountCents: order.total_money?.amount,
        detail: `order ${state}`,
      };
    }
  }

  return { checked: false, paid: false, detail: "Nothing to verify" };
}
