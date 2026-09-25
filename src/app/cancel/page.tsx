import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageBooking } from "@/components/booking/manage-booking";
import { formatMoney } from "@/lib/catalog";
import { availabilityConfig } from "@/lib/slots";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cancel a booking",
  description: `Cancel a prepaid ${site.name} booking and see the refund before you confirm.`,
};

export default function CancelPage() {
  const { cancelCutoffHours, rescheduleCutoffHours, lateCancelFeeCents } =
    availabilityConfig();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 lg:py-20">
      <h1 className="font-heading text-4xl sm:text-5xl">Cancel your booking.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        Enter your booking reference and we will show you the exact refund before
        anything is cancelled.
      </p>
      <div className="mt-6 max-w-2xl rounded-xl border border-gold/30 bg-[#121216] p-5 sm:p-6">
        <p className="text-xs tracking-[0.24em] text-gold uppercase">
          Cancellation policy
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-silver">
          <li>
            <strong className="text-foreground">
              {cancelCutoffHours} or more hours before your window:
            </strong>{" "}
            full refund of everything you paid.
          </li>
          <li>
            <strong className="text-foreground">
              Inside {cancelCutoffHours} hours:
            </strong>{" "}
            we keep a {formatMoney(lateCancelFeeCents)} late-cancellation fee and
            refund the rest.
          </li>
          <li>
            Once the window has started, cancellation is a phone call —{" "}
            {site.phone}.
          </li>
        </ul>
        <p className="mt-3 text-sm text-silver/80">
          Rather keep the detail? You can move it to another open window up to{" "}
          {rescheduleCutoffHours} hours ahead, right on this page.
        </p>
      </div>

      <div className="mt-10">
        <Suspense fallback={<p className="text-silver">Loading…</p>}>
          <ManageBooking intent="cancel" />
        </Suspense>
      </div>
    </div>
  );
}
