import availabilityFile from "@/data/availability.json";
import { listHeldSlotIds } from "@/lib/booking-store";
import {
  type CalendarAvailability,
  availabilitySyncConfigured,
  listCalendarAvailability,
} from "@/lib/google-calendar";

/**
 * Availability is owner-set, never generated.
 *
 * HARD RULE (Derek, 2026-09-30): the booking page must not open a day just
 * because it is a weekday, and must not fall back to "shop hours". A window is
 * bookable only when Emery has explicitly put it on his availability source for
 * that exact date. Everything else renders grayed out and unbookable. There is no
 * standing weekday pattern anywhere in this file — `weekly` exists only because
 * the owner may choose to fill it, and it ships empty.
 *
 * Source of truth, in order:
 *   1. Emery's Google Calendar, read live by `listCalendarAvailability` whenever
 *      the GOOGLE_* availability env vars are set. He adds an event titled "Open"
 *      on the days/windows he wants bookable; the site syncs from that with no
 *      manual re-entry here. A failed read opens nothing.
 *   2. `src/data/availability.json` (or the `PRESTIGE_AVAILABILITY` env var, whose
 *      keys are merged over the file) — the same owner-set dates, kept as the
 *      mirror for deploys that have no calendar credentials.
 *
 * Google Appointment Schedules stay an *admin* view only: the public site never
 * books through them, because completing a Google booking would hold the slot
 * before the customer has paid. Square is payments only.
 */

export type AvailabilityConfig = {
  timeZone: string;
  slotMinutes: number;
  leadTimeHours: number;
  horizonDays: number;
  /** A paid customer can move their own booking until this many hours before it starts. */
  rescheduleCutoffHours: number;
  /** Cancel this far ahead and the refund is full; inside it, the late fee applies. */
  cancelCutoffHours: number;
  /**
   * Flat fee retained on any cancellation inside the cutoff. Everything above it
   * is refunded. Derek, 2026-09-29: $35, and the same $35 applies to an on-site
   * cancellation of the whole job or of the interior portion.
   */
  lateCancelFeeCents: number;
  /**
   * Window start times the /book grid draws for every day so closed times are
   * visible as grayed-out cells. Display only — a time here is never bookable
   * unless that exact date also lists it in `openDates` (or on the calendar).
   */
  displayTimes: string[];
  /**
   * Start times an all-day "Open" calendar event opens. Used only when Emery
   * marks a whole day open instead of a specific window.
   */
  dayOpenTimes: string[];
  /** Days the /book grid shows at a minimum; open dates beyond it are still shown. */
  gridDays: number;
  /**
   * Optional recurring openings: weekday name -> local start times ("08:00").
   * Ships empty on purpose — nothing is open because of the day of the week.
   */
  weekly: Record<string, string[]>;
  /**
   * The owner-set open dates: "YYYY-MM-DD" -> local start times. This is the
   * normal way availability is expressed when the calendar sync is off.
   */
  openDates: Record<string, string[]>;
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

// Deliberately opens nothing: an unreadable config must never invent a day.
const fallback: AvailabilityConfig = {
  timeZone: "America/New_York",
  slotMinutes: 240,
  leadTimeHours: 12,
  horizonDays: 21,
  rescheduleCutoffHours: 24,
  cancelCutoffHours: 24,
  lateCancelFeeCents: 3500,
  displayTimes: [],
  dayOpenTimes: [],
  gridDays: 14,
  weekly: {},
  openDates: {},
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

  const datesRaw = (raw.openDates || raw.extraDates || {}) as Record<
    string,
    unknown
  >;
  const openDates: Record<string, string[]> = {};
  for (const [date, times] of Object.entries(datesRaw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    openDates[date] = normalizeTimes(times);
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
    rescheduleCutoffHours: num(
      raw.rescheduleCutoffHours,
      fallback.rescheduleCutoffHours,
      0,
      24 * 14,
    ),
    cancelCutoffHours: num(
      raw.cancelCutoffHours,
      fallback.cancelCutoffHours,
      0,
      24 * 14,
    ),
    lateCancelFeeCents: num(
      raw.lateCancelFeeCents,
      fallback.lateCancelFeeCents,
      0,
      100_000,
    ),
    displayTimes: normalizeTimes(raw.displayTimes),
    dayOpenTimes: normalizeTimes(raw.dayOpenTimes),
    gridDays: num(raw.gridDays, fallback.gridDays, 1, 120),
    weekly,
    openDates,
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

/** "Thu, Sep 24, 11:00 PM EDT" — for deadlines and confirmations. */
export function formatMoment(iso: string, timeZone: string) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));
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

/** Where the open days on this deploy came from. Surfaced on /book and the API. */
export type AvailabilitySource =
  | "google-calendar"
  | "config"
  | "google-calendar-unreachable";

export type PublishedAvailability = {
  config: AvailabilityConfig;
  /** Every window the owner has set inside the horizon, before holds. */
  slots: OpenSlot[];
  source: AvailabilitySource;
  detail?: string;
};

/** Dates the owner closed outright, from config plus all-day calendar events. */
function closedDates(config: AvailabilityConfig, calendar: CalendarAvailability) {
  return new Set([...config.blackoutDates, ...calendar.busyDates]);
}

/**
 * Owner-set open times per date. Google Calendar wins when it is readable; the
 * config file is the mirror for deploys without calendar credentials. Neither
 * path can produce a date the owner did not set.
 */
function openTimesByDate(
  dates: string[],
  config: AvailabilityConfig,
  calendar: CalendarAvailability,
): Map<string, string[]> {
  const byDate = new Map<string, string[]>();
  const known = new Set(dates);

  if (calendar.status === "ok") {
    for (const window of calendar.openWindows) {
      if (!known.has(window.date)) continue;
      const times = window.startTime ? [window.startTime] : config.dayOpenTimes;
      const list = byDate.get(window.date) || [];
      for (const time of times) if (!list.includes(time)) list.push(time);
      byDate.set(window.date, list.sort());
    }
    return byDate;
  }

  if (calendar.status === "failed") return byDate;

  for (const date of dates) {
    const times = [
      ...(config.weekly[weekdayName(date)] || []),
      ...(config.openDates[date] || []),
    ];
    const unique = [...new Set(times)].sort();
    if (unique.length > 0) byDate.set(date, unique);
  }
  return byDate;
}

function horizonDates(config: AvailabilityConfig, nowMs: number) {
  const today = localDateString(nowMs, config.timeZone);
  const dates: string[] = [];
  for (let i = 0; i <= config.horizonDays; i += 1) dates.push(addDays(today, i));
  return dates;
}

async function readCalendar(
  config: AvailabilityConfig,
  dates: string[],
  env: Record<string, string | undefined>,
): Promise<CalendarAvailability> {
  if (!availabilitySyncConfigured(env)) {
    return { status: "skipped", openWindows: [], busy: [], busyDates: [] };
  }
  const fromMs = zonedToUtcMs(dates[0], "00:00", config.timeZone);
  const toMs = zonedToUtcMs(
    addDays(dates[dates.length - 1], 1),
    "00:00",
    config.timeZone,
  );
  if (fromMs === null || toMs === null) {
    return { status: "skipped", openWindows: [], busy: [], busyDates: [] };
  }
  return listCalendarAvailability(
    {
      fromIso: new Date(fromMs).toISOString(),
      toIso: new Date(toMs).toISOString(),
      timeZone: config.timeZone,
    },
    env,
  );
}

/**
 * Every window the owner has set inside the booking horizon, before holds are
 * subtracted. Sorted by start time. An empty list is a valid answer and means
 * nothing is open — it is never padded with a default.
 */
export async function publishedAvailability(
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): Promise<PublishedAvailability> {
  const config = availabilityConfig(env);
  const nowMs = now.getTime();
  const earliestMs = nowMs + config.leadTimeHours * 3_600_000;
  const dates = horizonDates(config, nowMs);
  const calendar = await readCalendar(config, dates, env);
  const closed = closedDates(config, calendar);
  const blackoutSlots = new Set(config.blackoutSlots);
  const byDate = openTimesByDate(dates, config, calendar);

  const slots: OpenSlot[] = [];
  const seen = new Set<string>();
  for (const date of dates) {
    if (closed.has(date)) continue;
    for (const startTime of byDate.get(date) || []) {
      const id = slotId(date, startTime);
      if (seen.has(id) || blackoutSlots.has(id)) continue;
      const slot = buildSlot(date, startTime, config);
      if (!slot) continue;
      const startMs = Date.parse(slot.start);
      if (startMs < earliestMs) continue;
      const endMs = Date.parse(slot.end);
      const collides = calendar.busy.some(
        (range) => range.startMs < endMs && range.endMs > startMs,
      );
      if (collides) continue;
      seen.add(id);
      slots.push(slot);
    }
  }

  const source: AvailabilitySource =
    calendar.status === "ok"
      ? "google-calendar"
      : calendar.status === "failed"
        ? "google-calendar-unreachable"
        : "config";

  return {
    config,
    slots: slots.sort((a, b) => a.start.localeCompare(b.start)),
    source,
    detail: calendar.detail,
  };
}

/** Published windows minus the ones a paid booking already holds. */
export async function listOpenSlots(
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): Promise<OpenSlot[]> {
  const held = new Set(await listHeldSlotIds());
  const { slots } = await publishedAvailability(now, env);
  return slots.filter((slot) => !held.has(slot.id));
}

export type SlotCellStatus = "open" | "booked" | "closed";

export type SlotCell = {
  id: string;
  startTime: string;
  endTime: string;
  /** "9:00 AM – 1:00 PM" in the shop time zone. */
  timeLabel: string;
  status: SlotCellStatus;
  /** Present only when the cell is bookable. */
  slot: OpenSlot | null;
};

export type SlotDay = {
  date: string;
  /** "Thursday, October 1" in the shop time zone. */
  dayLabel: string;
  cells: SlotCell[];
  openCount: number;
};

export type SlotGrid = {
  timeZone: string;
  slotMinutes: number;
  source: AvailabilitySource;
  detail?: string;
  days: SlotDay[];
  openCount: number;
};

function dayLabel(date: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function cellTimeLabel(startTime: string, config: AvailabilityConfig) {
  const fmt = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
  };
  return `${fmt(startTime)} – ${fmt(addMinutesToTime(startTime, config.slotMinutes))}`;
}

/**
 * The calendar the /book page draws: one row per day, one cell per published
 * window time. Only the windows the owner set for that exact date come back as
 * `open`; every other cell is `closed` so the page can gray it out instead of
 * pretending it is bookable.
 */
export async function listSlotGrid(
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): Promise<SlotGrid> {
  const held = new Set(await listHeldSlotIds());
  const { config, slots, source, detail } = await publishedAvailability(now, env);
  const openById = new Map(
    slots.filter((slot) => !held.has(slot.id)).map((slot) => [slot.id, slot]),
  );
  const publishedById = new Map(slots.map((slot) => [slot.id, slot]));

  const today = localDateString(now.getTime(), config.timeZone);
  const lastOpenDate = slots.length > 0 ? slots[slots.length - 1].date : today;
  const days: SlotDay[] = [];
  for (let i = 0; i <= config.horizonDays; i += 1) {
    const date = addDays(today, i);
    if (i >= config.gridDays && date > lastOpenDate) break;

    const times = [
      ...new Set([
        ...config.displayTimes,
        ...slots.filter((slot) => slot.date === date).map((s) => s.startTime),
      ]),
    ].sort();
    if (times.length === 0) continue;

    const cells: SlotCell[] = times.map((startTime) => {
      const id = slotId(date, startTime);
      const open = openById.get(id) || null;
      const status: SlotCellStatus = open
        ? "open"
        : publishedById.has(id)
          ? "booked"
          : "closed";
      return {
        id,
        startTime,
        endTime: addMinutesToTime(startTime, config.slotMinutes),
        timeLabel: cellTimeLabel(startTime, config),
        status,
        slot: open,
      };
    });

    days.push({
      date,
      dayLabel: dayLabel(date, config.timeZone),
      cells,
      openCount: cells.filter((cell) => cell.status === "open").length,
    });
  }

  return {
    timeZone: config.timeZone,
    slotMinutes: config.slotMinutes,
    source,
    detail,
    days,
    openCount: openById.size,
  };
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
