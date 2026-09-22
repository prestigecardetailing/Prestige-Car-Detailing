import type { Metadata } from "next";
import { Suspense } from "react";
import { PayForm } from "@/components/pay/pay-form";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pay",
  description: `Pay in full for ${site.name} mobile detailing.`,
};

export default function PayPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl">
        Pay the package in full.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        Sign the waiver, choose a package and add-ons, then pay through Square.
        Prepaid before we arrive.
      </p>
      <div className="mt-10">
        <Suspense fallback={<p className="text-silver">Loading pay form…</p>}>
          <PayForm />
        </Suspense>
      </div>
    </div>
  );
}
