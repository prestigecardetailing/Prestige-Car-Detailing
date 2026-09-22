import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { addons, formatMoney, packages } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services",
  description: `Packages and add-ons for ${site.name} mobile detailing.`,
};

export default function ServicesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl">
        What we do, and what it includes.
      </h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-silver">
        Combo packages use the same Interior Clean as the cabin-only package: a
        full reset, not a quick wipe. Prestige and Diamond finish the exterior
        with a hand-applied protective glaze. Add-ons are optional.
      </p>

      <div className="mt-12 space-y-6">
        {packages.map((pkg) => (
          <article
            key={pkg.id}
            className={cn(
              "rounded-xl bg-[#121216] p-6 ring-1 sm:p-8",
              pkg.featured ? "ring-gold/40" : "ring-white/10",
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-heading text-3xl">{pkg.name}</h2>
              <p className="text-gold">{formatMoney(pkg.priceCents)}</p>
            </div>
            <p className="mt-3 max-w-3xl text-silver">{pkg.summary}</p>
            {pkg.priceNote ? (
              <p className="mt-2 text-sm text-gold">{pkg.priceNote}</p>
            ) : null}
            <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-silver">
              {pkg.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link
              href={`/pay?package=${pkg.id}`}
              className={cn(buttonVariants({ size: "lg" }), "mt-6 h-11 px-5")}
            >
              Pay {pkg.name}
            </Link>
          </article>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="font-heading text-3xl">Add-ons</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {addons.map((addon) => (
            <div
              key={addon.id}
              className="rounded-xl bg-[#121216] p-5 ring-1 ring-white/10"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-xl">{addon.name}</h3>
                <span className="text-gold">
                  +{formatMoney(addon.priceCents)}
                </span>
              </div>
              <p className="mt-2 text-sm text-silver">{addon.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-white/10 bg-[#0b0b0d] p-6 sm:p-8">
        <h2 className="font-heading text-3xl">Before you book</h2>
        <ul className="mt-5 list-disc space-y-2 pl-5 text-silver">
          <li>
            We detail cars, SUVs, trucks, and vans. Large vehicles take the
            oversized add-on.
          </li>
          <li>
            Heavily soiled interiors take the soil add-on. Extreme cases may be
            quoted or declined after we see the vehicle.
          </li>
          <li>
            This is a mobile service. Same-day is typical when the calendar is
            open.
          </li>
          <li>Service area: {site.serviceArea}.</li>
        </ul>
      </section>
    </div>
  );
}
