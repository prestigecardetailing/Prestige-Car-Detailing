import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BOOKING_CALENDAR_URL, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Book",
  description: `Book a mobile detailing window with ${site.name}.`,
};

export default function BookPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl">
        Pick a window. We come to you.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        Same-day is typical when the calendar is open. After you reserve a time,
        pay the package total on the Pay page. To move a prepaid booking,
        message the shop.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/pay"
          className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
        >
          Continue to pay
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

      <div className="mt-10 overflow-hidden rounded-xl bg-[#121216] ring-1 ring-white/10">
        <iframe
          src={BOOKING_CALENDAR_URL}
          title="Book a Prestige Car Wash appointment"
          className="h-[720px] w-full border-0 bg-white"
          loading="lazy"
        />
      </div>
    </div>
  );
}
