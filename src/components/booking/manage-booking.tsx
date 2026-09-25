"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";
import type { OpenSlot } from "@/lib/slots";

type ReschedulePolicy = {
  allowed: boolean;
  cutoffHours: number;
  deadline: string | null;
  deadlineLabel: string | null;
  reason?: "not-paid" | "no-slot" | "too-late" | "past";
};

type CancellationQuote = {
  allowed: boolean;
  policy: "full-refund" | "late-fee";
  cutoffHours: number;
  hoursBeforeStart: number;
  paidLabel: string;
  lateFeeLabel: string;
  feeLabel: string;
  feeCents: number;
  refundLabel: string;
  refundCents: number;
  fullRefundUntilLabel: string | null;
  reason?: "not-paid" | "no-slot" | "started" | "already-cancelled";
};

type CancelledRecord = {
  policy: "full-refund" | "late-fee";
  feeCents: number;
  refundCents: number;
  refundStatus: "issued" | "failed" | "skipped" | "not-needed";
};

type PublicBooking = {
  reference: string;
  status: string;
  slot: { id: string; label: string } | null;
  packageName: string;
  addonNames: string[];
  totalLabel: string;
  reschedule: ReschedulePolicy;
  cancellation: CancellationQuote;
  cancelled?: CancelledRecord;
};

type LookupReply = {
  booking?: PublicBooking;
  slots?: OpenSlot[];
  timeZone?: string;
  error?: string;
};

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

function groupByDate(slots: OpenSlot[]) {
  const groups = new Map<string, OpenSlot[]>();
  for (const slot of slots) {
    const list = groups.get(slot.date);
    if (list) list.push(slot);
    else groups.set(slot.date, [slot]);
  }
  return [...groups.entries()];
}

function rescheduleMessage(policy: ReschedulePolicy) {
  switch (policy.reason) {
    case "too-late":
      return `Changes close ${policy.cutoffHours} hours before the window starts, and that time has passed. Call ${site.phone} and we will move it for you.`;
    case "past":
      return `That window has already come and gone. Call ${site.phone} if you need another appointment.`;
    case "not-paid":
      return "That booking has not been paid yet, so there is nothing to move. Pick a window on the Book page.";
    default:
      return `There is no scheduled window on that payment. Call ${site.phone} and we will set one.`;
  }
}

function cancelMessage(quote: CancellationQuote) {
  switch (quote.reason) {
    case "started":
      return `That window has already started, so it cannot be cancelled online. Call ${site.phone}.`;
    case "already-cancelled":
      return "This booking is already cancelled.";
    case "not-paid":
      return "Nothing has been charged for this booking, so there is nothing to refund.";
    default:
      return `There is no scheduled window on that payment. Call ${site.phone} about a refund.`;
  }
}

function refundOutcome(cancelled: CancelledRecord) {
  const refundLabel = formatMoney(cancelled.refundCents);
  if (cancelled.refundStatus === "issued") {
    return `Square is sending ${refundLabel} back to the card you paid with. Refunds usually land in a few business days.`;
  }
  if (cancelled.refundStatus === "not-needed") {
    return "Nothing is left to refund after the late-cancellation fee.";
  }
  return `The shop has been notified to refund ${refundLabel} to your card. If you do not see it, call ${site.phone}.`;
}

async function fetchLookup(ref: string): Promise<LookupReply | null> {
  const res = await fetch(`/api/bookings/lookup?ref=${encodeURIComponent(ref)}`, {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as LookupReply | null;
  return res.ok ? data : null;
}

export function ManageBooking({
  intent = "reschedule",
}: {
  /** Which action the page leads with. Both are always available. */
  intent?: "reschedule" | "cancel";
}) {
  const searchParams = useSearchParams();
  const refFromUrl = (searchParams.get("ref") || "").trim();

  const [reference, setReference] = useState(refFromUrl);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [slots, setSlots] = useState<OpenSlot[]>([]);
  const [timeZone, setTimeZone] = useState("America/New_York");
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState<PublicBooking | null>(null);

  function applyLookup(data: LookupReply | null) {
    if (!data?.booking) {
      setBooking(null);
      setSlots([]);
      setError(
        `We could not find a booking with that reference. Check your payment confirmation, or call ${site.phone}.`,
      );
      return;
    }
    setBooking(data.booking);
    setSlots(data.slots || []);
    setTimeZone(data.timeZone || "America/New_York");
    setError(null);
  }

  async function lookup(ref: string) {
    const clean = ref.trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    setMoved(null);
    setCancelled(null);
    setConfirmingCancel(false);
    try {
      applyLookup(await fetchLookup(clean));
    } catch {
      setError("Could not reach the booking system. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Deep link from the payment confirmation: /reschedule?ref=… or /cancel?ref=…
  useEffect(() => {
    if (!refFromUrl) return;
    let cancelledEffect = false;
    fetchLookup(refFromUrl)
      .then((data) => {
        if (!cancelledEffect) applyLookup(data);
      })
      .catch(() => {
        if (!cancelledEffect) setError("Could not reach the booking system.");
      });
    return () => {
      cancelledEffect = true;
    };
  }, [refFromUrl]);

  async function moveTo(slot: OpenSlot) {
    if (!booking) return;
    setSaving(slot.id);
    setError(null);
    try {
      const res = await fetch("/api/bookings/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: booking.reference, slotId: slot.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Could not move that booking.");
        await lookup(booking.reference);
        return;
      }
      setBooking(data.booking);
      setSlots([]);
      setMoved(data.booking?.slot?.label || slot.label);
    } catch {
      setError("Could not reach the booking system. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  async function cancelBooking() {
    if (!booking) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: booking.reference, confirm: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.status !== "cancelled") {
        setError(data?.error || "Could not cancel that booking.");
        return;
      }
      setConfirmingCancel(false);
      setSlots([]);
      setMoved(null);
      setCancelled(data.booking);
      setBooking(data.booking);
    } catch {
      setError("Could not reach the booking system. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  const policy = booking?.reschedule;
  const quote = booking?.cancellation;
  const blockedMove = booking && policy && !policy.allowed ? rescheduleMessage(policy) : null;
  const showPicker = !!booking && !!policy?.allowed && !moved && !cancelled;

  return (
    <div className="space-y-8">
      <form
        className="rounded-xl bg-[#121216] p-6 ring-1 ring-white/10 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(reference);
        }}
      >
        <Label htmlFor="booking-ref">Booking reference</Label>
        <p className="mt-2 text-sm text-silver">
          The code on your payment confirmation screen — it looks like{" "}
          <span className="font-mono text-silver/90">902b40aaf8514fcb</span>.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Input
            id="booking-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Paste your booking reference"
            className="h-11 max-w-sm flex-1 font-mono"
            autoComplete="off"
          />
          <Button type="submit" size="lg" className="h-11 px-5" disabled={loading}>
            {loading ? "Looking…" : "Find my booking"}
          </Button>
        </div>
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {booking ? (
        <div className="rounded-xl bg-[#121216] p-6 ring-1 ring-white/10 sm:p-8">
          <p className="text-xs tracking-[0.24em] text-gold uppercase">
            {cancelled ? "Cancelled" : moved ? "Moved" : "Your booking"}
          </p>
          <h2 className="font-heading mt-2 text-2xl">
            {booking.slot?.label || "No window scheduled"}
          </h2>
          <p className="mt-2 text-sm text-silver">
            {booking.packageName}
            {booking.addonNames.length ? ` + ${booking.addonNames.join(", ")}` : ""}{" "}
            · {booking.totalLabel} · reference{" "}
            <span className="font-mono">{booking.reference}</span>
          </p>

          {cancelled?.cancelled ? (
            <div
              className="mt-4 rounded-lg bg-gold/10 px-4 py-3 text-sm leading-relaxed text-gold"
              role="status"
              data-testid="cancel-result"
            >
              <p>
                This booking is cancelled and the window is back on the board.
              </p>
              <p className="mt-2">
                {cancelled.cancelled.policy === "late-fee"
                  ? `Cancelled inside ${cancelled.cancellation.cutoffHours} hours, so the ${formatMoney(
                      cancelled.cancelled.feeCents,
                    )} late-cancellation fee was kept.`
                  : `Cancelled with more than ${cancelled.cancellation.cutoffHours} hours' notice, so nothing was kept.`}{" "}
                {refundOutcome(cancelled.cancelled)}
              </p>
            </div>
          ) : moved ? (
            <p
              className="mt-4 rounded-lg bg-gold/10 px-4 py-3 text-sm text-gold"
              role="status"
            >
              Done — your appointment is now {moved}. The shop has been notified.
            </p>
          ) : blockedMove ? (
            <div className="mt-4 rounded-lg border border-gold/40 bg-gold/8 px-4 py-3">
              <p className="text-sm leading-relaxed text-silver">{blockedMove}</p>
              <a
                href={site.phoneTel}
                className={cn(buttonVariants({ size: "lg" }), "mt-4 h-11 px-5")}
              >
                Call {site.phone}
              </a>
            </div>
          ) : policy?.deadlineLabel ? (
            <p className="mt-4 text-sm text-silver">
              You can move this yourself until{" "}
              <strong className="text-silver">{policy.deadlineLabel}</strong> —{" "}
              {policy.cutoffHours} hours before the window starts. After that,
              call {site.phone}.
            </p>
          ) : null}

          {quote && !cancelled ? (
            <div className="mt-6 border-t border-white/10 pt-6">
              <h3 className="font-heading text-xl">Cancel instead?</h3>
              <p className="mt-2 text-sm leading-relaxed text-silver">
                Cancel {quote.cutoffHours} or more hours before your window and
                you get a full refund. Inside {quote.cutoffHours} hours we keep a{" "}
                {quote.lateFeeLabel} late-cancellation fee and refund everything
                else.
                {quote.fullRefundUntilLabel
                  ? ` Full-refund cutoff for this booking: ${quote.fullRefundUntilLabel}.`
                  : ""}
              </p>

              {!quote.allowed ? (
                <div className="mt-4 rounded-lg border border-gold/40 bg-gold/8 px-4 py-3">
                  <p className="text-sm leading-relaxed text-silver">
                    {cancelMessage(quote)}
                  </p>
                </div>
              ) : confirmingCancel ? (
                <div
                  className="mt-4 rounded-lg border border-gold/40 bg-gold/8 px-4 py-4"
                  data-testid="cancel-confirm"
                >
                  <p className="text-sm leading-relaxed text-silver">
                    {quote.policy === "late-fee" ? (
                      <>
                        Your window starts in about {quote.hoursBeforeStart} hours,
                        which is inside the {quote.cutoffHours}-hour cutoff. You
                        paid {quote.paidLabel}; we keep {quote.feeLabel} as the
                        late-cancellation fee and refund{" "}
                        <strong className="text-gold">{quote.refundLabel}</strong>.
                      </>
                    ) : (
                      <>
                        You are more than {quote.cutoffHours} hours out, so this is
                        a full refund: you paid {quote.paidLabel} and get{" "}
                        <strong className="text-gold">{quote.refundLabel}</strong>{" "}
                        back.
                      </>
                    )}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      size="lg"
                      className="h-11 px-5"
                      disabled={cancelling}
                      onClick={() => void cancelBooking()}
                    >
                      {cancelling
                        ? "Cancelling…"
                        : `Yes, cancel and refund ${quote.refundLabel}`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-11 px-5"
                      disabled={cancelling}
                      onClick={() => setConfirmingCancel(false)}
                    >
                      Keep my booking
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="mt-4 h-11 px-5"
                  data-testid="cancel-start"
                  onClick={() => setConfirmingCancel(true)}
                >
                  Cancel this booking
                </Button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {showPicker ? (
        <div className="space-y-8">
          <h2 className="font-heading text-2xl">
            {intent === "cancel" ? "Or pick a different window" : "Pick the new window"}
          </h2>
          {slots.length === 0 ? (
            <p className="text-sm text-silver">
              Nothing else is open right now. Call {site.phone} and we will find a
              time.
            </p>
          ) : (
            groupByDate(slots).map(([date, daySlots]) => (
              <section key={date}>
                <h3 className="font-heading text-xl">
                  {dayHeading(date, timeZone)}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {daySlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      data-slot-id={slot.id}
                      disabled={!!saving}
                      onClick={() => void moveTo(slot)}
                      className="flex flex-col rounded-xl bg-[#121216] px-5 py-4 text-left ring-1 ring-white/10 transition-colors hover:bg-gold/8 hover:ring-gold/50 disabled:opacity-50"
                    >
                      <span className="font-heading text-lg">
                        {timeRange(slot, timeZone)}
                      </span>
                      <span className="mt-1 text-sm text-silver">
                        {Math.round((slot.durationMinutes / 60) * 10) / 10}-hour
                        window
                      </span>
                      <span className="mt-3 text-xs tracking-[0.18em] text-gold uppercase">
                        {saving === slot.id ? "Moving…" : "Move here →"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
