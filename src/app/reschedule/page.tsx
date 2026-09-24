import type { Metadata } from "next";
import { Suspense } from "react";
import { RescheduleForm } from "@/components/reschedule/reschedule-form";
import { availabilityConfig } from "@/lib/slots";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Move a booking",
  description: `Change the window on a prepaid ${site.name} booking.`,
};

export default function ReschedulePage() {
  const { rescheduleCutoffHours, slotMinutes } = availabilityConfig();
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

      <div className="mt-10">
        <Suspense fallback={<p className="text-silver">Loading…</p>}>
          <RescheduleForm />
        </Suspense>
      </div>
    </div>
  );
}
