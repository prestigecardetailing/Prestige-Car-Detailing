import { formatMoney } from "@/lib/catalog";
import type { BookingRecord } from "@/lib/booking-store";
import { normalizePhone } from "@/lib/contact";
import { site } from "@/lib/site";
import { availabilityConfig } from "@/lib/slots";

/**
 * Post-payment confirmation text.
 *
 * Two rails, picked in this order, and a safe no-op when neither is configured.
 *
 * 1. Twilio direct (what Systems is provisioning). Sends to
 *    /2010-04-01/Accounts/{sid}/Messages.json when all of these are present:
 *      TWILIO_ACCOUNT_SID
 *      TWILIO_AUTH_TOKEN            (or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET)
 *      TWILIO_FROM_NUMBER           (or TWILIO_MESSAGING_SERVICE_SID)
 *    As of 2026-09-25 the From number is not live — IncomingPhoneNumbers=0,
 *    purchase blocked behind Trust Hub Primary compliance KYC — so in practice
 *    this path stays dormant until Systems delivers the number.
 *
 * 2. Systems-owned proxy endpoint, if Prestige would rather not put Twilio
 *    credentials on the site at all:
 *      PRESTIGE_SMS_API_URL / PRESTIGE_SMS_API_SECRET / PRESTIGE_SMS_FROM
 *    Set PRESTIGE_SMS_API_URL and it wins over the direct path.
 *
 * 3. Neither configured: build the payload, log it with the phone masked,
 *    record it on the booking, return `stubbed`. No send, no throw.
 *
 * Payment, the hold, the calendar event, and the owner email never depend on the
 * text going out; a failed or skipped text tells the owner to send one by hand.
 *
 * Square's own receipt SMS is not a substitute — it cannot carry the window, the
 * service address, or the cancellation terms this message is required to state.
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

export type SmsRail = "twilio" | "systems-endpoint" | "stub";

type TwilioConfig = {
  accountSid: string;
  authUser: string;
  authPass: string;
  from?: string;
  messagingServiceSid?: string;
  baseUrl: string;
};

function twilioConfig(env: EnvLike): TwilioConfig | null {
  const accountSid = (env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (env.TWILIO_AUTH_TOKEN || "").trim();
  const keySid = (env.TWILIO_API_KEY_SID || "").trim();
  const keySecret = (env.TWILIO_API_KEY_SECRET || "").trim();
  const from = (env.TWILIO_FROM_NUMBER || "").trim();
  const messagingServiceSid = (env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
  if (!accountSid) return null;
  if (!from && !messagingServiceSid) return null;

  // API key pair is preferred when both are available; auth token still works.
  const authUser = keySid && keySecret ? keySid : accountSid;
  const authPass = keySid && keySecret ? keySecret : authToken;
  if (!authPass) return null;

  return {
    accountSid,
    authUser,
    authPass,
    from: from || undefined,
    messagingServiceSid: messagingServiceSid || undefined,
    // Test-only override so the request shape can be proven without spending.
    baseUrl: (env.TWILIO_API_BASE_URL || "https://api.twilio.com").replace(/\/$/, ""),
  };
}

/** Which rail a deploy would use right now. Exposed by /api/sms-status. */
export function smsRail(env: EnvLike = process.env): SmsRail {
  if ((env.PRESTIGE_SMS_API_URL || "").trim()) return "systems-endpoint";
  if (twilioConfig(env)) return "twilio";
  return "stub";
}

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

/** POST /2010-04-01/Accounts/{sid}/Messages.json — the recipe Systems will hand us. */
async function sendViaTwilio(
  config: TwilioConfig,
  to: string,
  body: string,
  bookingRef: string,
): Promise<SmsResult> {
  const form = new URLSearchParams({ To: to, Body: body });
  if (config.messagingServiceSid) {
    form.set("MessagingServiceSid", config.messagingServiceSid);
  } else if (config.from) {
    form.set("From", config.from);
  }

  try {
    const res = await fetch(
      `${config.baseUrl}/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${config.authUser}:${config.authPass}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      status?: string;
      code?: number;
      message?: string;
    };
    if (!res.ok) {
      const detail = `Twilio ${res.status}${data.code ? ` [${data.code}]` : ""}${
        data.message ? ` ${data.message}` : ""
      }`;
      console.error("[sms:failed]", detail, maskPhone(to), bookingRef);
      return { status: "failed", to: maskPhone(to), body, detail };
    }
    console.info(
      "[sms:sent] booking-confirmation",
      JSON.stringify({
        rail: "twilio",
        to: maskPhone(to),
        bookingRef,
        sid: data.sid,
        twilioStatus: data.status,
        chars: body.length,
      }),
    );
    return {
      status: "sent",
      to: maskPhone(to),
      body,
      provider: data.sid || "twilio",
      detail: data.status ? `twilio ${data.status}` : undefined,
      sentAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[sms:failed] Twilio request threw", err);
    return { status: "failed", to: maskPhone(to), body, detail: "exception" };
  }
}

export async function sendBookingConfirmationSms(
  record: BookingRecord,
  env: EnvLike = process.env,
): Promise<SmsResult> {
  const phone = normalizePhone(record.customer.phone);
  if (!phone) {
    return { status: "skipped", detail: "No usable phone on the booking" };
  }

  const from = (env.PRESTIGE_SMS_FROM || env.TWILIO_FROM_NUMBER || "").trim();
  const fromNormalized = from ? normalizePhone(from) : null;
  if (fromNormalized?.e164 === VOICE_ONLY_NUMBER) {
    console.error(
      "SMS blocked: the configured sender is 864-619-4911, which is voice only. Use a separate messaging number.",
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
  const twilio = url ? null : twilioConfig(env);

  if (!url && !twilio) {
    // No rail yet: log the exact payload (phone masked) so Systems can wire it.
    console.info(
      "[sms:stub] booking-confirmation",
      JSON.stringify({ ...payload, to: maskPhone(phone.e164) }, null, 2),
    );
    return {
      status: "stubbed",
      to: maskPhone(phone.e164),
      body,
      detail:
        "No SMS rail configured (TWILIO_FROM_NUMBER + credentials, or PRESTIGE_SMS_API_URL) — payload logged, nothing sent",
    };
  }

  if (twilio) return sendViaTwilio(twilio, phone.e164, body, record.id);

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
