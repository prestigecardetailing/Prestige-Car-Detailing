import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingSteps } from "@/components/book/booking-steps";
import { PayForm } from "@/components/pay/pay-form";
import { readSelection } from "@/lib/booking-flow";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pay",
  description: `Sign the waiver and pay in full for ${site.name} mobile detailing.`,
};

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{
    package?: string | string[];
    addons?: string | string[];
    slot?: string | string[];
  }>;
}) {
  const selection = readSelection(await searchParams);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <BookingSteps
        current="waiver"
        done={[
          ...(selection.packageId ? (["service"] as const) : []),
          ...(selection.slotId ? (["time"] as const) : []),
          "details" as const,
        ]}
      />
      <h1 className="font-heading mt-5 text-4xl sm:text-5xl lg:text-6xl">
        Sign the waiver, then pay.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        This is the last screen. When you click Pay, the liability waiver opens —
        sign it and you continue straight to Square. The window you picked is
        reserved for you only after Square confirms the payment.
      </p>
      <div className="mt-10">
        <Suspense fallback={<p className="text-silver">Loading pay form…</p>}>
          <PayForm />
        </Suspense>
      </div>
    </div>
  );
}
