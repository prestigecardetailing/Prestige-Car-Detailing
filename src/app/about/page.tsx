import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `Who runs ${site.name}, what it is built for, and how to book.`,
};

/**
 * Derek's About draft (2026-09-29), used verbatim. Split into paragraphs for
 * readability only — no wording changed. Edit the source list, not the markup.
 */
const ABOUT_PARAGRAPHS = [
  "Prestige Car Wash is Emery's business — he started it on his own two years ago, bought all his own supplies, and built it up from scratch. Emery loves cars. He goes to car shows every week, and cars are his passion. He's detail-oriented by nature — the kind of person who notices every streak, every smudge, every spot you missed. That's exactly what you want when someone's cleaning your vehicle. He currently works at a car wash as his regular job, so he knows the trade from the inside.",
  "Prestige Car Wash is a mobile-only service — there's no storefront to visit. Emery comes to your driveway or lot in Simpsonville, Greenville, and about 20 miles around, typically the same day you book.",
  "A quick note on fit: this business is built for cars in normal, everyday condition — regular wear and tear, interiors that just need a reset. It's not for moldy or neglected vehicles that haven't been cleaned in years. If your car is in decent shape and you want it looking its best, Emery's your guy.",
  "Bookings are at 9:00 AM or 2:30 PM Eastern, depending on availability — check the calendar for open windows. Call or text 864-619-4911.",
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
      <p className="text-xs tracking-[0.34em] text-gold uppercase">
        {site.name}
      </p>
      <h1 className="font-heading mt-4 text-4xl sm:text-5xl lg:text-6xl">
        About Prestige Car Wash
      </h1>

      <div className="mt-10 space-y-6 text-lg leading-relaxed text-silver">
        {ABOUT_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/book"
          className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
        >
          See open windows
        </Link>
        <a
          href={site.phoneTel}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-12 px-6",
          )}
        >
          Call or text {site.phone}
        </a>
      </div>
    </div>
  );
}
