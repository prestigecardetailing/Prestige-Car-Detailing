import { NextResponse } from "next/server";
import { VOICE_ONLY_NUMBER, smsRail } from "@/lib/sms";
import { normalizePhone } from "@/lib/contact";

export const dynamic = "force-dynamic";

/**
 * GET /api/sms-status
 *
 * Read-only readiness check for the post-payment confirmation text, so Systems
 * can confirm the env wiring on a deploy without sending anything. Reports which
 * variables are present — never their values.
 *
 * {
 *   "rail": "twilio" | "systems-endpoint" | "stub",
 *   "wouldSend": false,            // true once a rail is fully configured
 *   "twilio": { "accountSid": false, "credentials": false, "fromNumber": false,
 *               "messagingServiceSid": false },
 *   "systemsEndpoint": { "url": false, "secret": false },
 *   "senderIsVoiceOnlyNumber": false   // true means sends are refused on purpose
 * }
 */
export async function GET() {
  const env = process.env;
  const has = (key: string) => !!(env[key] || "").trim();
  const sender = (env.PRESTIGE_SMS_FROM || env.TWILIO_FROM_NUMBER || "").trim();
  const senderIsVoiceOnlyNumber =
    !!sender && normalizePhone(sender)?.e164 === VOICE_ONLY_NUMBER;
  const rail = smsRail(env);

  return NextResponse.json(
    {
      rail,
      wouldSend: rail !== "stub" && !senderIsVoiceOnlyNumber,
      twilio: {
        accountSid: has("TWILIO_ACCOUNT_SID"),
        credentials:
          has("TWILIO_AUTH_TOKEN") ||
          (has("TWILIO_API_KEY_SID") && has("TWILIO_API_KEY_SECRET")),
        fromNumber: has("TWILIO_FROM_NUMBER"),
        messagingServiceSid: has("TWILIO_MESSAGING_SERVICE_SID"),
      },
      systemsEndpoint: {
        url: has("PRESTIGE_SMS_API_URL"),
        secret: has("PRESTIGE_SMS_API_SECRET"),
      },
      senderIsVoiceOnlyNumber,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
