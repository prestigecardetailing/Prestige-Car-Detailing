import { formatMoney } from "@/lib/catalog";
import type { BookingRecord } from "@/lib/booking-store";
import { normalizePhone } from "@/lib/contact";
import { site } from "@/lib/site";
import { availabilityConfig } from "@/lib/slots";

/**
 * Post-payment confirmation text.
 *
 * The rail is a Systems-owned endpoint, not Twilio directly — this app never
 * holds Twilio credentials and never spends Twilio balance on its own:
 *
 *   PRESTIGE_SMS_API_URL     https endpoint Systems exposes (Twilio behind it)
 *   PRESTIGE_SMS_API_SECRET  bearer token for that endpoint
 *   PRESTIGE_SMS_FROM        optional sender hint passed through to Systems
 *
 * With the URL unset the hook is a documented stub: it builds the exact payload,
 * logs it (phone masked), records it on the booking, and returns `stubbed` so
 * Systems can wire the rail against a known shape. Payment, the hold, the
 * calendar event, and the owner email never depend on the text going out.
 *
 * Payload POSTed to PRESTIGE_SMS_API_URL:
 *   headers: { Authorization: "Bearer <PRESTIGE_SMS_API_SECRET>",
 *              "Content-Type": "application/json",
 *              "X-Prestige-Booking": "<booking reference>" }
 *   body: {
 *     kind: "booking-confirmation",
 *     to: "+18645550134",          // E.164, the phone captured at booking
 *     from: "+18645550100",        // only when PRESTIGE_SMS_FROM is set
 *     body: "<message text>",
 *     bookingRef: "ed52f0847b05407e",
 *     source: "prestigecarwashsc.com"
 *   }
 * A 2xx reply is treated as accepted; `{ "sid": "..." }` is recorded if present.
 */

type EnvLike = Record<string, string | undefined>;

/** Voice only. Prestige never sends texts from the public line. */
export const VOICE_ONLY_NUMBER = "+18646194911";

export type SmsResult = {
  status: "sent" | "stubbed" | "failed" | "blocked" | "skipped";
  to?: string;
  provider?: string;
  detail?: string;
  body?: string;
  sentAt?: string;
};

export function maskPhone(e164: string) {
  const digits = e164.replace(/\D+/g, "").slice(-10);
  if (digits.length < 4) return "(masked)";
  return `+1 (***) ***-${digits.slice(-4)}`;
}

/**
 * The confirmation text. Everything Derek asked for: who, when, where, what,
 * the change rules, and the real site URL.
 */
export function bookingConfirmationText(
  record: BookingRecord,
  env: EnvLike = process.env,
) {
  const config = availabilityConfig(env);
  const lines = [
    "Prestige Car Wash — payment received, you're booked.",
    record.customer.name || "Prestige customer",
    record.slot ? record.slot.label : "Window: we will call to schedule",
    record.customer.location || "Address on file",
    `${record.packageName}${
      record.addonNames.length ? ` + ${record.addonNames.join(", ")}` : ""
    } — ${formatMoney(record.totalCents)} paid`,
    "",
    `Reschedule yourself up to ${config.rescheduleCutoffHours}h before the start; inside that, call ${site.phone}.`,
    `Cancel ${config.cancelCutoffHours}h+ ahead = full refund. Inside ${config.cancelCutoffHours}h we keep ${formatMoney(
      config.lateCancelFeeCents,
    )} and refund the rest.`,
    `Manage: ${site.url}/reschedule?ref=${record.id}`,
    site.url,
  ];
  return lines.join("\n");
}

export async function sendBookingConfirmationSms(
  record: BookingRecord,
  env: EnvLike = process.env,
): Promise<SmsResult> {
  const phone = normalizePhone(record.customer.phone);
  if (!phone) {
    return { status: "skipped", detail: "No usable phone on the booking" };
  }

  const from = (env.PRESTIGE_SMS_FROM || "").trim();
  const fromNormalized = from ? normalizePhone(from) : null;
  if (fromNormalized?.e164 === VOICE_ONLY_NUMBER) {
    console.error(
      "SMS blocked: PRESTIGE_SMS_FROM is the voice-only line. Use a separate messaging number.",
    );
    return {
      status: "blocked",
      to: maskPhone(phone.e164),
      detail: "Sender is the voice-only number",
    };
  }

  const body = bookingConfirmationText(record, env);
  const payload = {
    kind: "booking-confirmation" as const,
    to: phone.e164,
    ...(from ? { from } : {}),
    body,
    bookingRef: record.id,
    source: site.domain,
  };

  const url = (env.PRESTIGE_SMS_API_URL || "").trim();
  const secret = (env.PRESTIGE_SMS_API_SECRET || "").trim();

  if (!url) {
    // No rail yet: log the exact payload (phone masked) so Systems can wire it.
    console.info(
      "[sms:stub] booking-confirmation",
      JSON.stringify({ ...payload, to: maskPhone(phone.e164) }, null, 2),
    );
    return {
      status: "stubbed",
      to: maskPhone(phone.e164),
      body,
      detail: "PRESTIGE_SMS_API_URL not set — payload logged, nothing sent",
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Prestige-Booking": record.id,
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      error?: string;
    };
    if (!res.ok) {
      console.error("[sms:failed]", res.status, data?.error || "", maskPhone(phone.e164));
      return {
        status: "failed",
        to: maskPhone(phone.e164),
        body,
        detail: `HTTP ${res.status}${data?.error ? ` ${data.error}` : ""}`,
      };
    }
    console.info(
      "[sms:sent] booking-confirmation",
      JSON.stringify({
        to: maskPhone(phone.e164),
        bookingRef: record.id,
        provider: data.sid || "systems-endpoint",
        chars: body.length,
      }),
    );
    return {
      status: "sent",
      to: maskPhone(phone.e164),
      body,
      provider: data.sid || "systems-endpoint",
      sentAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[sms:failed] request threw", err);
    return {
      status: "failed",
      to: maskPhone(phone.e164),
      body,
      detail: "exception",
    };
  }
}
