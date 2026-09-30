"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, UserRound, X } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { navItems, site } from "@/lib/site";

function closeDetails(e: React.MouseEvent) {
  e.currentTarget.closest("details")?.removeAttribute("open");
}

/**
 * Mobile (~375px): brand can truncate; phone 864-619-4911 stays visible; Account
 * collapses to its icon; the full menu, "Message the shop", and Book move into
 * the hamburger below `lg`. The public site shows no phone number other than
 * site.phone.
 */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0b0b0d]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.25rem] w-full max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <Link
          href="/"
          className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLockup />
          <span className="sr-only">Prestige Car Wash home</span>
        </Link>

        <div className="flex shrink-0 items-center justify-end gap-0.5 sm:gap-2">
          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm tracking-wide transition-colors",
                    active
                      ? "text-gold"
                      : "text-silver hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <a
            href={site.phoneTel}
            className="inline-flex min-h-11 items-center whitespace-nowrap px-1.5 text-[0.7rem] tracking-wide text-gold hover:text-foreground sm:px-2 sm:text-sm"
          >
            {site.phone}
          </a>

          <Link
            href="/contact"
            className="hidden min-h-11 items-center whitespace-nowrap rounded-md px-2 text-sm tracking-wide text-gold hover:text-foreground lg:inline-flex"
          >
            Message the shop
          </Link>

          <Link
            href="/account"
            aria-current={pathname.startsWith("/account") ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-9 gap-1.5 px-2 sm:h-10 sm:px-3",
            )}
            data-testid="account-button"
          >
            <UserRound aria-hidden />
            <span className="hidden sm:inline">Account</span>
            <span className="sr-only sm:hidden">Account</span>
          </Link>

          <Link
            href="/book"
            className={cn(
              buttonVariants({ size: "lg" }),
              "ml-1 hidden h-10 px-4 lg:inline-flex",
            )}
          >
            Book
          </Link>

          <details className="group relative lg:hidden">
            <summary
              className={cn(
                buttonVariants({ variant: "outline", size: "icon-lg" }),
                "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
              )}
            >
              <Menu className="group-open:hidden" aria-hidden />
              <X className="hidden group-open:block" aria-hidden />
              <span className="sr-only">Menu</span>
            </summary>
            <nav
              id="mobile-nav"
              aria-label="Mobile"
              className="absolute top-[3.1rem] right-0 z-50 w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border border-white/10 bg-[#0b0b0d] px-3 py-3 shadow-xl"
            >
              <ul className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={closeDetails}
                        className={cn(
                          "block rounded-md px-3 py-3 text-base",
                          active
                            ? "bg-white/5 text-gold"
                            : "text-silver",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Link
                    href="/account"
                    onClick={closeDetails}
                    className="block rounded-md px-3 py-3 text-base text-silver"
                  >
                    Account
                  </Link>
                </li>
                <li>
                  <a
                    href={site.phoneTel}
                    className="block rounded-md px-3 py-3 text-base text-gold"
                  >
                    Call {site.phone}
                  </a>
                </li>
                <li>
                  <Link
                    href="/contact"
                    onClick={closeDetails}
                    className="block rounded-md px-3 py-3 text-base text-gold"
                  >
                    Message the shop
                  </Link>
                </li>
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
