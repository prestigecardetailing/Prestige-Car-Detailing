"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { afterTimeStep } from "@/lib/booking-flow";
import { cn } from "@/lib/cn";
import type { AvailabilitySource, SlotDay } from "@/lib/slots";
import { site } from "@/lib/site";

type OpenSlotsResponse = {
  timeZone: string;
  slotMinutes: number;
  source?: AvailabilitySource;
  days?: SlotDay[];
};

/**
 * Availability is owner-set. Every day inside the booking horizon is drawn, and a
 * cell is only clickable when Emery put that exact date and time on his
 * availability. Closed and already-booked cells render grayed out and unbookable
 * — the page never fills empty days with a standing 9:00 AM / 2:30 PM pattern.
 */
export function SlotPicker({
  initialDays,
  initialSource,
  slotMinutes,
  packageId,
  addonIds,
}: {
  initialDays: SlotDay[];
  initialSource: AvailabilitySource;
  slotMinutes: number;
  packageId: string | null;
  addonIds: string[];
}) {
  const [days, setDays] = useState(initialDays);
  const [source, setSource] = useState(initialSource);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/open-slots", { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: OpenSlotsResponse | null) => {
        if (data?.days) {
          setDays(data.days);
          if (data.source) setSource(data.source);
        }
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
    return () => controller.abort();
  }, []);

  const hours = Math.round((slotMinutes / 60) * 10) / 10;
  const openCount = days.reduce((sum, day) => sum + day.openCount, 0);

  return (
    <div className="space-y-8">
      <div
        className="rounded-xl bg-[#121216] p-5 ring-1 ring-white/10 sm:p-6"
        data-testid="availability-summary"
        data-availability-source={source}
        data-open-count={openCount}
      >
        <h2 className="font-heading text-xl">
          {openCount === 1
            ? "1 open window right now"
            : `${openCount} open windows right now`}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-silver">
          {source === "google-calendar-unreachable"
            ? `We could not reach the shop calendar, so nothing is offered rather than guessed. Call ${site.phone} and Emery will fit you in.`
            : openCount > 0
              ? `Only the days and times Emery has opened are selectable below. Everything grayed out is not available — nothing on this page is bookable unless he set it.`
              : refreshing
                ? "Loading the openings Emery has set…"
                : `Emery has not opened any windows in the next few weeks. Nothing here is bookable until he does — call ${site.phone} and he will fit you in.`}
        </p>
        {openCount === 0 ? (
          <a
            href={site.phoneTel}
            className={cn(buttonVariants({ size: "lg" }), "mt-5 h-11 px-5")}
          >
            Call {site.phone}
          </a>
        ) : null}
      </div>

      {days.map((day) => (
        <section key={day.date} data-date={day.date} data-open={day.openCount}>
          <h3
            className={cn(
              "font-heading text-xl",
              day.openCount > 0 ? "text-foreground" : "text-silver/45",
            )}
          >
            {day.dayLabel}
            {day.openCount === 0 ? (
              <span className="ml-3 align-middle text-xs tracking-[0.18em] text-silver/40 uppercase">
                Not available
              </span>
            ) : null}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {day.cells.map((cell) =>
              cell.status === "open" && cell.slot ? (
                <Link
                  key={cell.id}
                  href={afterTimeStep({ packageId, addonIds, slotId: cell.id })}
                  data-slot-id={cell.id}
                  data-slot-status="open"
                  className="group flex flex-col rounded-xl bg-[#121216] px-5 py-4 text-left ring-1 ring-white/10 transition-colors hover:bg-gold/8 hover:ring-gold/50 focus-visible:ring-gold"
                >
                  <span className="font-heading text-lg text-foreground">
                    {cell.timeLabel}
                  </span>
                  <span className="mt-1 text-sm text-silver">
                    {hours}-hour window · arrives within the window
                  </span>
                  <span className="mt-3 text-xs tracking-[0.18em] text-gold uppercase">
                    Select this time →
                  </span>
                </Link>
              ) : (
                <div
                  key={cell.id}
                  data-slot-id={cell.id}
                  data-slot-status={cell.status}
                  aria-disabled="true"
                  className="flex cursor-not-allowed flex-col rounded-xl bg-[#0d0d10] px-5 py-4 text-left ring-1 ring-white/5 opacity-60"
                >
                  <span className="font-heading text-lg text-silver/40 line-through">
                    {cell.timeLabel}
                  </span>
                  <span className="mt-1 text-sm text-silver/40">
                    {cell.status === "booked"
                      ? "Already booked"
                      : "Not available"}
                  </span>
                  <span className="mt-3 text-xs tracking-[0.18em] text-silver/30 uppercase">
                    Unavailable
                  </span>
                </div>
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
