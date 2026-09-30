import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingSteps } from "@/components/book/booking-steps";
import { ContactStep } from "@/components/book/contact-step";
import { readSelection, readyForDetails } from "@/lib/booking-flow";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Your details",
  description: `Tell ${site.name} where to bring the wash before you pay.`,
};

export default async function BookDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{
    package?: string | string[];
    addons?: string | string[];
    slot?: string | string[];
  }>;
}) {
  const selection = readSelection(await searchParams);
  const ready = readyForDetails(selection);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 lg:py-20">
      <BookingSteps
        current="details"
        done={[
          ...(selection.packageId ? (["service"] as const) : []),
          ...(selection.slotId ? (["time"] as const) : []),
        ]}
      />
      <h1 className="font-heading mt-5 text-4xl sm:text-5xl">
        Where are we coming?
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        {ready
          ? "Your car wash and your window are set. We are mobile, so we need your first and last name, a callback phone, and the full address where the vehicle will be — street, city, state, and ZIP. Email is optional, and a password is only needed if you want an account."
          : "Finish choosing your car wash and your time first — this screen opens once both are done."}{" "}
        Nothing is charged and no time is reserved on this screen.
      </p>

      <div className="mt-10">
        <Suspense fallback={<p className="text-silver">Loading…</p>}>
          <ContactStep />
        </Suspense>
      </div>
    </div>
  );
}
