import { createSign } from "crypto";

/**
 * Google Calendar is the middleman for availability, and the place paid holds are
 * written. No credentials are invented here: nothing talks to Google unless all
 * three env vars are present on the deploy.
 *
 *   GOOGLE_CALENDAR_ID            calendar to write to (e.g. the Prestige calendar
 *                                 address, or "primary" for the service account)
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  service account address
 *   GOOGLE_SERVICE_ACCOUNT_KEY    that account's PEM private key ("\n" escapes OK)
 *
 * Optional, for the availability read (see `listCalendarAvailability`):
 *
 *   GOOGLE_AVAILABILITY_CALENDAR_ID  calendar Emery marks open days on. Defaults
 *                                    to GOOGLE_CALENDAR_ID.
 *   GOOGLE_AVAILABILITY_KEYWORDS     comma-separated event-title markers that mean
 *                                    "open for bookings". Defaults to
 *                                    "open,available,availability".
 *
 * The Prestige calendar must be shared with the service account address with
 * "Make changes to events". When the vars are missing we return `skipped` and the
 * caller falls back to the owner notification, which carries the same details.
 */

type EnvLike = Record<string, string | undefined>;

export type CalendarResult = {
  status: "created" | "deleted" | "skipped" | "failed";
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

/** Remove a hold from the calendar after a cancellation. */
export async function deleteCalendarHold(
  eventId: string,
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
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    // 410 means it was already gone, which is the state we wanted anyway.
    if (!res.ok && res.status !== 410) {
      console.warn("Google Calendar delete failed", res.status);
      return { status: "failed", detail: `HTTP ${res.status}` };
    }
    return { status: "deleted", eventId };
  } catch (err) {
    console.warn("Google Calendar delete threw", err);
    return { status: "failed", detail: "exception" };
  }
}

/** Move an existing hold to a new window. Falls back to `skipped` when unconfigured. */
export async function updateCalendarHold(
  eventId: string,
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
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
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
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn("Google Calendar patch failed", res.status, detail.slice(0, 300));
      return { status: "failed", detail: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { id?: string };
    return { status: "created", eventId: data.id || eventId };
  } catch (err) {
    console.warn("Google Calendar patch threw", err);
    return { status: "failed", detail: "exception" };
  }
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

/** One window Emery marked open. `startTime` is null for an all-day open event. */
export type CalendarOpenWindow = {
  /** Local date in the shop time zone, "YYYY-MM-DD". */
  date: string;
  /** Local 24-hour start, "HH:MM", or null when the whole day was marked open. */
  startTime: string | null;
  /** Event title, kept for the owner-facing logs. */
  title: string;
};

export type CalendarBusyRange = { startMs: number; endMs: number };

export type CalendarAvailability = {
  status: "ok" | "skipped" | "failed";
  /** Only the events Emery titled as open. Never a generated weekly pattern. */
  openWindows: CalendarOpenWindow[];
  /** Everything else on the calendar, so a window Emery filled stops being offered. */
  busy: CalendarBusyRange[];
  /** All-day events that are not open markers — the whole local day is closed. */
  busyDates: string[];
  detail?: string;
};

type GoogleEvent = {
  status?: string;
  summary?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

const DEFAULT_AVAILABILITY_KEYWORDS = ["open", "available", "availability"];

export function availabilityCalendarId(env: EnvLike = process.env) {
  return (
    env.GOOGLE_AVAILABILITY_CALENDAR_ID?.trim() ||
    env.GOOGLE_CALENDAR_ID?.trim() ||
    ""
  );
}

/**
 * True only when this deploy can read Emery's calendar. When it is false the
 * caller must fall back to the checked-in availability file — never to a
 * generated weekly pattern.
 */
export function availabilitySyncConfigured(env: EnvLike = process.env) {
  return !!(
    availabilityCalendarId(env) &&
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
    env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim()
  );
}

export function availabilityKeywords(env: EnvLike = process.env) {
  const raw = (env.GOOGLE_AVAILABILITY_KEYWORDS || "").trim();
  if (!raw) return DEFAULT_AVAILABILITY_KEYWORDS;
  const list = raw
    .split(",")
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_AVAILABILITY_KEYWORDS;
}

function localParts(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const hour = String(Number(get("hour")) % 24).padStart(2, "0");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

function nextDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Read the open days Emery has set on Google Calendar.
 *
 * Emery owns availability: he adds an event titled "Open" (any of
 * `GOOGLE_AVAILABILITY_KEYWORDS`) for each window or day he wants bookable, and
 * the site mirrors exactly that — nothing is assumed for the days he left alone.
 * Every other event on the calendar comes back as busy so a window he filled
 * himself stops being offered.
 */
export async function listCalendarAvailability(
  range: { fromIso: string; toIso: string; timeZone: string },
  env: EnvLike = process.env,
): Promise<CalendarAvailability> {
  if (!availabilitySyncConfigured(env)) {
    return {
      status: "skipped",
      openWindows: [],
      busy: [],
      busyDates: [],
      detail: "Google Calendar availability env vars not set",
    };
  }
  try {
    const token = await accessToken(env);
    if (!token) {
      return {
        status: "failed",
        openWindows: [],
        busy: [],
        busyDates: [],
        detail: "Could not mint Google token",
      };
    }
    const calendarId = encodeURIComponent(availabilityCalendarId(env));
    const query = new URLSearchParams({
      timeMin: range.fromIso,
      timeMax: range.toIso,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
      showDeleted: "false",
    });
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${query.toString()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(
        "Google Calendar availability read failed",
        res.status,
        detail.slice(0, 300),
      );
      return {
        status: "failed",
        openWindows: [],
        busy: [],
        busyDates: [],
        detail: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { items?: GoogleEvent[] };
    const keywords = availabilityKeywords(env);
    const openWindows: CalendarOpenWindow[] = [];
    const busy: CalendarBusyRange[] = [];
    const busyDates = new Set<string>();

    for (const event of data.items || []) {
      if (event.status === "cancelled") continue;
      const title = (event.summary || "").trim();
      const haystack = title.toLowerCase();
      const isOpenMarker = keywords.some((word) => haystack.includes(word));

      if (isOpenMarker) {
        if (event.start?.dateTime) {
          const startMs = Date.parse(event.start.dateTime);
          if (Number.isNaN(startMs)) continue;
          const { date, time } = localParts(startMs, range.timeZone);
          openWindows.push({ date, startTime: time, title });
        } else if (event.start?.date) {
          // All-day marker: the whole day is open, so the shop's configured
          // day-open times apply. Google's end date is exclusive.
          const endDate = event.end?.date || nextDate(event.start.date);
          for (
            let date = event.start.date;
            date < endDate;
            date = nextDate(date)
          ) {
            openWindows.push({ date, startTime: null, title });
          }
        }
        continue;
      }

      // Anything Emery did not mark open is time he is not free.
      if (event.transparency === "transparent") continue;
      if (event.start?.dateTime && event.end?.dateTime) {
        const startMs = Date.parse(event.start.dateTime);
        const endMs = Date.parse(event.end.dateTime);
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
          busy.push({ startMs, endMs });
        }
      } else if (event.start?.date) {
        const endDate = event.end?.date || nextDate(event.start.date);
        for (let date = event.start.date; date < endDate; date = nextDate(date)) {
          busyDates.add(date);
        }
      }
    }

    return { status: "ok", openWindows, busy, busyDates: [...busyDates] };
  } catch (err) {
    console.warn("Google Calendar availability read threw", err);
    return {
      status: "failed",
      openWindows: [],
      busy: [],
      busyDates: [],
      detail: "exception",
    };
  }
}
