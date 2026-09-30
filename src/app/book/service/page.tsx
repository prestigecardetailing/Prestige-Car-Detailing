import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingSteps } from "@/components/book/booking-steps";
import { ServicePicker } from "@/components/book/service-picker";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Choose your car wash",
  description: `Pick the ${site.name} car wash you want, then choose a time.`,
};

export default async function BookServicePage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string | string[] }>;
}) {
  const { slot } = await searchParams;
  const hasSlot = !!(Array.isArray(slot) ? slot[0] : slot);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 lg:py-20">
      <BookingSteps current="service" done={hasSlot ? ["time"] : []} />
      <h1 className="font-heading mt-5 text-4xl sm:text-5xl">
        Which car wash do you want?
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        {hasSlot
          ? "You already have a window. Pick the wash that goes with it, then we will ask for your details."
          : "Pick the wash first. Next you choose an open time, then we ask for your details, the waiver, and payment."}{" "}
        Nothing is charged here and no window is held yet.
      </p>

      <div className="mt-10">
        <Suspense fallback={<p className="text-silver">Loading packages…</p>}>
          <ServicePicker />
        </Suspense>
      </div>
    </div>
  );
}
