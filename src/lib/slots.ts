import availabilityFile from "@/data/availability.json";
import { listHeldSlotIds } from "@/lib/booking-store";

/**
 * Site-owned availability. Google Appointment Schedules stay an *admin* view of
 * Emory's hours — the public site never books through them, because completing a
 * Google booking holds the slot before the customer has paid.
 *
 * Source of truth is `src/data/availability.json`. To change hours without a
 * deploy, set the `PRESTIGE_AVAILABILITY` env var to a JSON object with the same
 * shape; its keys are merged over the file.
 */

export type AvailabilityConfig = {
  timeZone: string;
  slotMinutes: number;
  leadTimeHours: number;
  horizonDays: number;
  /** Recurring weekly openings: weekday name -> list of local start times ("08:00"). */
  weekly: Record<string, string[]>;
  /** One-off openings: "YYYY-MM-DD" -> list of local start times. */
  extraDates: Record<string, string[]>;
  /** Whole days that are closed: ["YYYY-MM-DD"]. */
  blackoutDates: string[];
  /** Single windows that are closed: ["2026-10-03T0800"]. */
  blackoutSlots: string[];
};

export type OpenSlot = {
  /** Stable slot key, local wall-clock: "2026-10-03T0800". Used as ?slot= and as the hold key. */
  id: string;
  /** ISO-8601 UTC instant the window starts. */
  start: string;
  /** ISO-8601 UTC instant the window ends. */
  end: string;
  /** Local date in the shop time zone, "YYYY-MM-DD". */
  date: string;
  /** Local 24-hour start/end, "HH:MM". */
  startTime: string;
  endTime: string;
  durationMinutes: number;
  /** Human label, e.g. "Fri, Oct 3 · 8:00 AM – 12:00 PM ET". */
  label: string;
};

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const fallback: AvailabilityConfig = {
  timeZone: "America/New_York",
  slotMinutes: 240,
  leadTimeHours: 12,
  horizonDays: 21,
  weekly: {},
  extraDates: {},
  blackoutDates: [],
  blackoutSlots: [],
};

function normalizeTimes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const raw of value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(raw).trim());
    if (!match) continue;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) continue;
    out.add(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return [...out].sort();
}

function normalizeConfig(raw: Record<string, unknown>): AvailabilityConfig {
  const weeklyRaw = (raw.weekly || {}) as Record<string, unknown>;
  const weekly: Record<string, string[]> = {};
  for (const day of WEEKDAYS) weekly[day] = normalizeTimes(weeklyRaw[day]);

  const extraRaw = (raw.extraDates || {}) as Record<string, unknown>;
  const extraDates: Record<string, string[]> = {};
  for (const [date, times] of Object.entries(extraRaw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    extraDates[date] = normalizeTimes(times);
  }

  const num = (value: unknown, dflt: number, min: number, max: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return dflt;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  return {
    timeZone: typeof raw.timeZone === "string" ? raw.timeZone : fallback.timeZone,
    slotMinutes: num(raw.slotMinutes, fallback.slotMinutes, 30, 12 * 60),
    leadTimeHours: num(raw.leadTimeHours, fallback.leadTimeHours, 0, 24 * 30),
    horizonDays: num(raw.horizonDays, fallback.horizonDays, 1, 120),
    weekly,
    extraDates,
    blackoutDates: Array.isArray(raw.blackoutDates)
      ? raw.blackoutDates.map(String).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [],
    blackoutSlots: Array.isArray(raw.blackoutSlots)
      ? raw.blackoutSlots.map(String)
      : [],
  };
}

export function availabilityConfig(
  env: Record<string, string | undefined> = process.env,
): AvailabilityConfig {
  const base = availabilityFile as unknown as Record<string, unknown>;
  const override = (env.PRESTIGE_AVAILABILITY || "").trim();
  if (!override) return normalizeConfig(base);
  try {
    const parsed = JSON.parse(override);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return normalizeConfig({ ...base, ...(parsed as Record<string, unknown>) });
    }
  } catch {
    console.warn("PRESTIGE_AVAILABILITY is not valid JSON — using the repo file");
  }
  return normalizeConfig(base);
}

function tzOffsetMs(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - utcMs;
}

/** Convert a local wall-clock date/time in `timeZone` to a UTC instant. */
function zonedToUtcMs(
  date: string,
  time: string,
  timeZone: string,
): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const naive = Date.UTC(
    Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t[1]),
    Number(t[2]),
  );
  const guess = naive - tzOffsetMs(naive, timeZone);
  // Re-check: the offset can differ across a DST boundary.
  return naive - tzOffsetMs(guess, timeZone);
}

function localDateString(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

function weekdayName(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function addMinutesToTime(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function slotId(date: string, startTime: string) {
  return `${date}T${startTime.replace(":", "")}`;
}

export function parseSlotId(id: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})$/.exec((id || "").trim());
  if (!match) return null;
  return { date: match[1], startTime: `${match[2]}:${match[3]}` };
}

export function slotLabel(startMs: number, endMs: number, timeZone: string) {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(startMs));
  const time = (ms: number) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ms));
  const zone =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(new Date(startMs))
      .find((p) => p.type === "timeZoneName")?.value || "";
  return `${day} · ${time(startMs)} – ${time(endMs)} ${zone}`.trim();
}

function buildSlot(
  date: string,
  startTime: string,
  config: AvailabilityConfig,
): OpenSlot | null {
  const startMs = zonedToUtcMs(date, startTime, config.timeZone);
  if (startMs === null) return null;
  const endMs = startMs + config.slotMinutes * 60_000;
  return {
    id: slotId(date, startTime),
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    date,
    startTime,
    endTime: addMinutesToTime(startTime, config.slotMinutes),
    durationMinutes: config.slotMinutes,
    label: slotLabel(startMs, endMs, config.timeZone),
  };
}

/**
 * Every window Prestige has published inside the booking horizon, before holds
 * are subtracted. Sorted by start time.
 */
export function publishedSlots(
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): OpenSlot[] {
  const config = availabilityConfig(env);
  const nowMs = now.getTime();
  const earliestMs = nowMs + config.leadTimeHours * 3_600_000;
  const blackoutDates = new Set(config.blackoutDates);
  const blackoutSlots = new Set(config.blackoutSlots);

  const today = localDateString(nowMs, config.timeZone);
  const slots: OpenSlot[] = [];
  const seen = new Set<string>();

  for (let i = 0; i <= config.horizonDays; i += 1) {
    const date = addDays(today, i);
    if (blackoutDates.has(date)) continue;
    const times = [
      ...(config.weekly[weekdayName(date)] || []),
      ...(config.extraDates[date] || []),
    ];
    for (const startTime of [...new Set(times)].sort()) {
      const id = slotId(date, startTime);
      if (seen.has(id) || blackoutSlots.has(id)) continue;
      const slot = buildSlot(date, startTime, config);
      if (!slot) continue;
      if (Date.parse(slot.start) < earliestMs) continue;
      seen.add(id);
      slots.push(slot);
    }
  }

  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

/** Published windows minus the ones a paid booking already holds. */
export async function listOpenSlots(
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): Promise<OpenSlot[]> {
  const held = new Set(await listHeldSlotIds());
  return publishedSlots(now, env).filter((slot) => !held.has(slot.id));
}

/**
 * Resolve a slot id to a concrete window. Returns a slot even when the id is
 * outside the published list (so a paid booking can still be described), as long
 * as the id is well formed.
 */
export function describeSlot(
  id: string,
  env: Record<string, string | undefined> = process.env,
): OpenSlot | null {
  const parsed = parseSlotId(id);
  if (!parsed) return null;
  return buildSlot(parsed.date, parsed.startTime, availabilityConfig(env));
}

export async function isSlotOpen(
  id: string,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  const open = await listOpenSlots(now, env);
  return open.some((slot) => slot.id === id);
}
