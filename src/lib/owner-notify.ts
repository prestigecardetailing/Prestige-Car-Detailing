import type { BookingRecord } from "@/lib/booking-store";
import { formatMoney } from "@/lib/catalog";
import { normalizePhone } from "@/lib/contact";
import { sendSms, type SmsResult } from "@/lib/sms";
import { site } from "@/lib/site";
import { availabilityConfig } from "@/lib/slots";

/**
 * Where a new booking has to land (Derek, 2026-09-29).
 *
 * SERVER-SIDE ONLY. The two mobile numbers below are private and must never be
 * rendered on a public page, so this module is imported exclusively from route
 * handlers and server helpers — never from a "use client" component. Keep it that
 * way: importing it into client code would ship the numbers in the browser
 * bundle. The only phone number the public site shows is site.phone
 * (864-619-4911).
 */

/** Inbox the booking email has to reach. */
export const OWNER_EMAIL = "mcelreath.intelligence@gmail.com";

/** Private SMS destinations. Overridable with PRESTIGE_OWNER_SMS_TO (comma-separated). */
const OWNER_SMS_DEFAULTS = [
  { label: "Emery", phone: "864-723-5599" },
  { label: "Derek", phone: "864-723-2989" },
] as const;

type EnvLike = Record<string, string | undefined>;

export function ownerSmsRecipients(env: EnvLike = process.env) {
  const override = (env.PRESTIGE_OWNER_SMS_TO || "").trim();
  const entries = override
    ? override
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((phone, index) => ({ label: `Owner ${index + 1}`, phone }))
    : [...OWNER_SMS_DEFAULTS];

  return entries.flatMap((entry) => {
    const normalized = normalizePhone(entry.phone);
    if (!normalized) {
      console.warn(`Owner SMS recipient is not a usable number: ${entry.label}`);
      return [];
    }
    return [{ label: entry.label, e164: normalized.e164 }];
  });
}

/** Short enough for one segment: who, when, where, what, and how much. */
export function ownerBookingSmsText(
  record: BookingRecord,
  env: EnvLike = process.env,
) {
  const config = availabilityConfig(env);
  return [
    "Prestige PAID booking",
    record.slot ? record.slot.label : "No window — call to schedule",
    record.customer.name || "Customer name missing",
    record.customer.phone || "No phone",
    record.customer.location || "No address",
    `${record.packageName}${
      record.addonNames.length ? ` + ${record.addonNames.join(", ")}` : ""
    } — ${formatMoney(record.totalCents)}`,
    `Ref ${record.id} · cancel fee ${formatMoney(config.lateCancelFeeCents)} inside ${config.cancelCutoffHours}h`,
    `${site.url}/reschedule?ref=${record.id}`,
  ].join("\n");
}

export type OwnerSmsOutcome = {
  label: string;
  result: SmsResult;
};

/**
 * Text every owner number about a paid booking. Failures are logged and returned
 * so the owner email can say which text did not go out; they never throw and
 * never block the booking.
 */
export async function sendOwnerBookingSms(
  record: BookingRecord,
  env: EnvLike = process.env,
): Promise<OwnerSmsOutcome[]> {
  const body = ownerBookingSmsText(record, env);
  const recipients = ownerSmsRecipients(env);
  const outcomes: OwnerSmsOutcome[] = [];
  for (const recipient of recipients) {
    const result = await sendSms(
      { to: recipient.e164, body, kind: "owner-booking-alert", reference: record.id },
      env,
    ).catch((err): SmsResult => {
      console.warn(`Owner SMS to ${recipient.label} threw`, err);
      return { status: "failed", detail: "exception" };
    });
    outcomes.push({ label: recipient.label, result });
  }
  return outcomes;
}

/** One line per recipient for the shop email. Masked numbers only. */
export function describeOwnerSms(outcomes: OwnerSmsOutcome[]) {
  if (outcomes.length === 0) return "Owner SMS: no usable owner numbers configured.";
  return outcomes
    .map(({ label, result }) => {
      if (result.status === "sent") return `Owner SMS to ${label}: sent.`;
      if (result.status === "stubbed") {
        return `Owner SMS to ${label}: no SMS rail wired yet — nothing sent.`;
      }
      return `Owner SMS to ${label}: ${result.status.toUpperCase()}${
        result.detail ? ` (${result.detail})` : ""
      }.`;
    })
    .join("\n");
}
