"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearPendingBooking, readPendingBooking } from "@/lib/booking-session";
import { site } from "@/lib/site";

type ConfirmReply = {
  status: "held" | "unpaid" | "review" | "unknown";
  slot?: { label: string; start: string } | null;
  conflict?: boolean;
  reference?: string;
  reschedule?: {
    allowed: boolean;
    cutoffHours: number;
    deadlineLabel: string | null;
  } | null;
  cancellation?: {
    cutoffHours: number;
    lateFeeLabel: string;
  } | null;
};

/**
 * Square only appends checkoutId / orderId / transactionId / referenceId on
 * production payment links, and some links (the open-amount fallback) carry
 * nothing at all. Read every carrier we have, most specific first.
 */
function readContext() {
  const raw = window.location.search || "";
  // Defensive: if Square appends its params with a second "?", fold it into "&".
  const normalized = raw.replace(/\?/g, (match, index: number) =>
    index === 0 ? match : "&",
  );
  const params = new URLSearchParams(normalized);

  let bookingId = params.get("booking") || params.get("referenceId") || "";
  let slotId = params.get("slot") || "";
  if (!bookingId) {
    const stored = readPendingBooking();
    if (stored) {
      bookingId = stored.bookingId;
      slotId = slotId || stored.slotId;
    }
  }

  return {
    bookingId,
    slotId,
    orderId: params.get("orderId") || undefined,
    transactionId: params.get("transactionId") || undefined,
    checkoutId: params.get("checkoutId") || undefined,
  };
}

export function SuccessConfirm() {
  const [result, setResult] = useState<
    { state: "working" } | { state: "idle" } | { state: "done"; reply: ConfirmReply | null }
  >({ state: "working" });

  useEffect(() => {
    let cancelled = false;
    const context = readContext();
    const request = context.bookingId
      ? fetch("/api/bookings/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(context),
        }).then((res) => res.json().catch(() => null))
      : Promise.resolve<ConfirmReply | null>(null);

    request
      .then((data: ConfirmReply | null) => {
        if (cancelled) return;
        if (!context.bookingId) {
          setResult({ state: "idle" });
          return;
        }
        setResult({ state: "done", reply: data });
        if (data?.status === "held") clearPendingBooking();
      })
      .catch(() => {
        if (!cancelled) setResult({ state: "done", reply: null });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const state = result.state;
  const reply = result.state === "done" ? result.reply : null;

  if (state === "idle") return null;

  const box =
    "mt-8 rounded-xl p-5 ring-1 sm:p-6 text-sm leading-relaxed sm:text-base";

  if (state === "working") {
    return (
      <div className={`${box} bg-[#121216] text-silver ring-white/10`} role="status">
        Checking your payment with Square…
      </div>
    );
  }

  if (reply?.status === "held") {
    return (
      <div className={`${box} bg-gold/8 text-silver ring-gold/50`} role="status">
        <p className="font-heading text-xl text-foreground">
          {reply.slot?.label
            ? `Your window is held: ${reply.slot.label}`
            : "Payment confirmed."}
        </p>
        <p className="mt-2">
          It is off the booking board now, and the shop has the details.
        </p>
        {reply.reference ? (
          <p className="mt-4">
            Booking reference:{" "}
            <span className="font-mono text-foreground">{reply.reference}</span>{" "}
            — save this. Need a different time?{" "}
            <Link
              href={`/reschedule?ref=${encodeURIComponent(reply.reference)}`}
              className="text-gold underline underline-offset-4"
            >
              Move your booking
            </Link>
            {reply.reschedule?.deadlineLabel
              ? ` until ${reply.reschedule.deadlineLabel} (${reply.reschedule.cutoffHours} hours before the window).`
              : "."}{" "}
            After that, call {site.phone}.
          </p>
        ) : null}
        {reply.reference && reply.cancellation ? (
          <p className="mt-3">
            Need to cancel? Cancel {reply.cancellation.cutoffHours} or more hours
            before your window for a full refund. Inside{" "}
            {reply.cancellation.cutoffHours} hours we keep a{" "}
            {reply.cancellation.lateFeeLabel} late-cancellation fee and refund
            everything else.{" "}
            <Link
              href={`/cancel?ref=${encodeURIComponent(reply.reference)}`}
              className="text-gold underline underline-offset-4"
            >
              Cancel this booking
            </Link>
            .
          </p>
        ) : null}
        {reply.conflict ? (
          <p className="mt-2 text-destructive">
            Heads up: another paid booking is on this window. We will call you to
            sort it out.
          </p>
        ) : null}
      </div>
    );
  }

  if (reply?.status === "unpaid") {
    return (
      <div className={`${box} bg-[#121216] text-silver ring-white/10`} role="status">
        Square has not reported a completed charge yet, so your window is still
        open on the booking page. If you were charged, call {site.phone} and we
        will lock it in.
      </div>
    );
  }

  return (
    <div className={`${box} bg-[#121216] text-silver ring-white/10`} role="status">
      Payment submitted. The shop has been notified to confirm your window by
      hand — you will hear from us. Questions: {site.phone}.
    </div>
  );
}
