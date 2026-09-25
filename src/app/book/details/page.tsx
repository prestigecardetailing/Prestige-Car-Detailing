import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactStep } from "@/components/book/contact-step";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Your details",
  description: `Tell ${site.name} where to bring the wash before you pay.`,
};

export default function BookDetailsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 lg:py-20">
      <p className="text-xs tracking-[0.28em] text-gold uppercase">Step 2 of 3</p>
      <h1 className="font-heading mt-3 text-4xl sm:text-5xl">
        Where are we coming?
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        We are mobile, so we need a name, a phone number, and the address where
        the vehicle will be. Email is optional. Nothing is charged and no time is
        reserved on this screen.
      </p>

      <div className="mt-10">
        <Suspense fallback={<p className="text-silver">Loading…</p>}>
          <ContactStep />
        </Suspense>
      </div>
    </div>
  );
}
