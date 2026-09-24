import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { navItems, site } from "@/lib/site";
import { availabilityConfig } from "@/lib/slots";

export function SiteFooter() {
  const { rescheduleCutoffHours } = availabilityConfig();
  return (
    <footer className="mt-auto border-t border-white/8 bg-[#08080a]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <BrandLockup />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-silver">
            Mobile detailing. We come to you with the wash — typically the same
            day you book.
          </p>
          <a
            href={site.phoneTel}
            className="mt-5 inline-flex text-gold hover:text-foreground"
          >
            {site.phone}
          </a>
          <p className="mt-4 text-xs tracking-[0.28em] text-gold uppercase">
            Service area
          </p>
          <p className="mt-2 text-sm text-silver">{site.serviceArea}.</p>
        </div>

        <div>
          <p className="text-xs tracking-[0.28em] text-gold uppercase">Visit</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/book" className="text-silver hover:text-foreground">
                Book a time
              </Link>
            </li>
            <li>
              <Link href="/pay" className="text-silver hover:text-foreground">
                Pay in full
              </Link>
            </li>
            <li>
              <Link
                href="/reschedule"
                className="text-silver hover:text-foreground"
              >
                Move a booking
              </Link>
            </li>
            <li>
              <a
                href={site.phoneTel}
                className="text-silver hover:text-foreground"
              >
                Call {site.phone}
              </a>
            </li>
            <li>
              <Link
                href="/contact"
                className="text-silver hover:text-foreground"
              >
                Message the shop
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs tracking-[0.28em] text-gold uppercase">
            Full menu
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-silver hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/privacy"
                className="text-silver hover:text-foreground"
              >
                Privacy
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-silver/80 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {site.name}. Prepaid bookings. Move a
            booking yourself up to {rescheduleCutoffHours} hours before it
            starts.
          </p>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
