import { createSign } from "crypto";

/**
 * Optional Google Calendar write. No credentials are invented here: the hold is
 * only pushed to Google when all three env vars are present on the deploy.
 *
 *   GOOGLE_CALENDAR_ID            calendar to write to (e.g. the Prestige calendar
 *                                 address, or "primary" for the service account)
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  service account address
 *   GOOGLE_SERVICE_ACCOUNT_KEY    that account's PEM private key ("\n" escapes OK)
 *
 * The Prestige calendar must be shared with the service account address with
 * "Make changes to events". When the vars are missing we return `skipped` and the
 * caller falls back to the owner notification, which carries the same details.
 */

type EnvLike = Record<string, string | undefined>;

export type CalendarResult = {
  status: "created" | "skipped" | "failed";
  eventId?: string;
  detail?: string;
};

export type CalendarEventInput = {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  location?: string;
};

export function googleCalendarConfigured(env: EnvLike = process.env) {
  return !!(
    env.GOOGLE_CALENDAR_ID?.trim() &&
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
    env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim()
  );
}

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function accessToken(env: EnvLike): Promise<string | null> {
  const clientEmail = (env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const privateKey = (env.GOOGLE_SERVICE_ACCOUNT_KEY || "")
    .trim()
    .replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/calendar.events",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      ...(env.GOOGLE_IMPERSONATED_USER?.trim()
        ? { sub: env.GOOGLE_IMPERSONATED_USER.trim() }
        : {}),
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(privateKey));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) {
    console.warn("Google token exchange failed", res.status);
    return null;
  }
  const data = (await res.json()) as { access_token?: string };
  return data.access_token || null;
}

export async function createCalendarHold(
  input: CalendarEventInput,
  env: EnvLike = process.env,
): Promise<CalendarResult> {
  if (!googleCalendarConfigured(env)) {
    return { status: "skipped", detail: "Google Calendar env vars not set" };
  }
  try {
    const token = await accessToken(env);
    if (!token) return { status: "failed", detail: "Could not mint Google token" };

    const calendarId = encodeURIComponent((env.GOOGLE_CALENDAR_ID || "").trim());
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: { dateTime: input.startIso, timeZone: input.timeZone },
          end: { dateTime: input.endIso, timeZone: input.timeZone },
          transparency: "opaque",
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn("Google Calendar insert failed", res.status, detail.slice(0, 300));
      return { status: "failed", detail: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { id?: string };
    return { status: "created", eventId: data.id };
  } catch (err) {
    console.warn("Google Calendar insert threw", err);
    return { status: "failed", detail: "exception" };
  }
}
