import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageBooking } from "@/components/booking/manage-booking";
import { formatMoney } from "@/lib/catalog";
import { availabilityConfig } from "@/lib/slots";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Move or cancel a booking",
  description: `Change the window on a prepaid ${site.name} booking, or cancel it.`,
};

export default function ReschedulePage() {
  const { rescheduleCutoffHours, cancelCutoffHours, lateCancelFeeCents, slotMinutes } =
    availabilityConfig();
  const hours = Math.round((slotMinutes / 60) * 10) / 10;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 lg:py-20">
      <h1 className="font-heading text-4xl sm:text-5xl">Move your booking.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        Paid already and need a different time? Enter your booking reference and
        pick another open {hours}-hour window. You can do this yourself up to{" "}
        {rescheduleCutoffHours} hours before your appointment starts — inside
        that, call {site.phone} and we will move it for you.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-silver/80">
        Need to cancel instead? Cancel {cancelCutoffHours} or more hours ahead for
        a full refund. Inside {cancelCutoffHours} hours we keep a{" "}
        {formatMoney(lateCancelFeeCents)} late-cancellation fee and refund
        everything else.
      </p>

      <div className="mt-10">
        <Suspense fallback={<p className="text-silver">Loading…</p>}>
          <ManageBooking intent="reschedule" />
        </Suspense>
      </div>
    </div>
  );
}
