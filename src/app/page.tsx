import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { packages, formatMoney } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(236,198,99,0.14),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(180,177,167,0.08),transparent_35%)]" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div>
            <p className="text-xs tracking-[0.34em] text-gold uppercase">
              {site.name}
            </p>
            <h1 className="font-heading mt-4 text-5xl leading-[1.05] text-foreground sm:text-6xl lg:text-7xl">
              The wash comes to you.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-silver">
              Prestige Car Wash is a mobile detailing service. We work at your
              location — typically the same day you book — and leave with the
              vehicle washed, dried, and reset inside when you ask for it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/book"
                className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
              >
                Book a window
              </Link>
              <Link
                href="/pay"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 px-6",
                )}
              >
                Pay in full
              </Link>
            </div>
          </div>
          <div className="rounded-2xl bg-[#121216]/80 p-6 ring-1 ring-white/10 backdrop-blur sm:p-8">
            <p className="text-xs tracking-[0.28em] text-gold uppercase">
              Service area
            </p>
            <p className="mt-3 text-lg text-foreground">{site.serviceArea}</p>
            <p className="mt-4 text-sm leading-relaxed text-silver">
              Cars, SUVs, trucks, and vans. Large vehicles and heavier interiors
              are quoted after we see them — not guessed on this site.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-silver">
              <li>We come to you</li>
              <li>Same-day typical</li>
              <li>Prepaid before the visit</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="font-heading text-4xl sm:text-5xl">
          From a wash to a Diamond finish.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {packages.map((pkg) => (
            <Link
              key={pkg.id}
              href={`/pay?package=${pkg.id}`}
              className={cn(
                "rounded-xl bg-[#121216] p-6 ring-1 transition-colors",
                pkg.featured
                  ? "ring-gold/40 hover:ring-gold/70"
                  : "ring-white/10 hover:ring-white/20",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-2xl">{pkg.name}</h3>
                <span className="text-gold">{formatMoney(pkg.priceCents)}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-silver">
                {pkg.summary}
              </p>
              {pkg.priceNote ? (
                <p className="mt-3 text-xs text-gold">{pkg.priceNote}</p>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-white/8 bg-[#0b0b0d]/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="font-heading text-4xl sm:text-5xl">
            Book. Pay. We come to you.
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                title: "Choose a package",
                body: "Interior Clean, Exterior Clean, or a combo. Combo interiors are the same full cabin reset as Interior Clean — not a quick wipe.",
              },
              {
                n: "02",
                title: "Book a window",
                body: "Same-day is typical when the calendar is open. We come to you.",
              },
              {
                n: "03",
                title: "Pay in full",
                body: "Prepaid before the visit. If plans change, reschedule through the message form.",
              },
              {
                n: "04",
                title: "We arrive",
                body: "The wash happens at your driveway or lot in Simpsonville, Greenville, or about 20 miles around.",
              },
            ].map((step) => (
              <li key={step.n}>
                <p className="text-xs tracking-[0.28em] text-gold">{step.n}</p>
                <h3 className="font-heading mt-2 text-2xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-silver">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="font-heading text-4xl sm:text-5xl">
          Ready when you are.
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-silver">
          Reserve a window, then pay the package total. If you need to move a
          prepaid booking, message the shop.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/book"
            className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
          >
            Book
          </Link>
          <a
            href={site.phoneTel}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-12 px-6",
            )}
          >
            {site.phone}
          </a>
        </div>
      </section>
    </div>
  );
}
