import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Payment received",
  description: `Payment confirmation for ${site.name}.`,
};

export default function PaySuccessPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
      <p className="text-xs tracking-[0.28em] text-gold uppercase">Paid</p>
      <h1 className="font-heading mt-3 text-4xl sm:text-5xl">
        Payment submitted.
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-silver">
        If Square processed the charge, your package is prepaid. Keep the time
        you booked. To reschedule, message the shop and include the original
        window.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/contact"
          className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
        >
          Message the shop
        </Link>
        <a
          href={site.phoneTel}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-11 px-5",
          )}
        >
          Call {site.phone}
        </a>
      </div>
    </div>
  );
}
