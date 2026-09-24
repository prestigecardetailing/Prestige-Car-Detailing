"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { OpenSlot } from "@/lib/slots";
import { site } from "@/lib/site";

type OpenSlotsResponse = {
  timeZone: string;
  slotMinutes: number;
  slots: OpenSlot[];
};

function groupByDate(slots: OpenSlot[]) {
  const groups = new Map<string, OpenSlot[]>();
  for (const slot of slots) {
    const list = groups.get(slot.date);
    if (list) list.push(slot);
    else groups.set(slot.date, [slot]);
  }
  return [...groups.entries()];
}

function dayHeading(date: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function timeRange(slot: OpenSlot, timeZone: string) {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  return `${fmt(slot.start)} – ${fmt(slot.end)}`;
}

export function SlotPicker({
  initialSlots,
  timeZone,
  slotMinutes,
}: {
  initialSlots: OpenSlot[];
  timeZone: string;
  slotMinutes: number;
}) {
  const [slots, setSlots] = useState(initialSlots);
  const [zone, setZone] = useState(timeZone);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/open-slots", { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: OpenSlotsResponse | null) => {
        if (data?.slots) {
          setSlots(data.slots);
          setZone(data.timeZone || timeZone);
        }
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
    return () => controller.abort();
  }, [timeZone]);

  const hours = Math.round((slotMinutes / 60) * 10) / 10;
  const groups = groupByDate(slots);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl bg-[#121216] p-6 ring-1 ring-white/10 sm:p-8">
        <h2 className="font-heading text-2xl">Call for the next opening</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-silver sm:text-base">
          {refreshing
            ? "Loading the current openings…"
            : `New ${hours}-hour windows post here as soon as they open. Call and we will fit you in.`}
        </p>
        <a
          href={site.phoneTel}
          className={cn(buttonVariants({ size: "lg" }), "mt-5 h-11 px-5")}
        >
          Call {site.phone}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map(([date, daySlots]) => (
        <section key={date}>
          <h2 className="font-heading text-xl text-foreground">
            {dayHeading(date, zone)}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {daySlots.map((slot) => (
              <Link
                key={slot.id}
                href={`/pay?slot=${encodeURIComponent(slot.id)}`}
                data-slot-id={slot.id}
                className="group flex flex-col rounded-xl bg-[#121216] px-5 py-4 text-left ring-1 ring-white/10 transition-colors hover:bg-gold/8 hover:ring-gold/50 focus-visible:ring-gold"
              >
                <span className="font-heading text-lg text-foreground">
                  {timeRange(slot, zone)}
                </span>
                <span className="mt-1 text-sm text-silver">
                  {hours}-hour window · arrives within the window
                </span>
                <span className="mt-3 text-xs tracking-[0.18em] text-gold uppercase">
                  Select &amp; pay →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
