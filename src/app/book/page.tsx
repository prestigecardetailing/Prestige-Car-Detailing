import type { Metadata } from "next";
import Link from "next/link";
import { BookingSteps } from "@/components/book/booking-steps";
import { SlotPicker } from "@/components/book/slot-picker";
import { buttonVariants } from "@/components/ui/button";
import { readSelection, servicePath } from "@/lib/booking-flow";
import { formatMoney, getPackage } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";
import { listSlotGrid } from "@/lib/slots";

export const metadata: Metadata = {
  title: "Book",
  description: `Pick an open mobile detailing window with ${site.name} and pay to lock it in.`,
};

// Availability changes as soon as Emery edits his calendar or a payment clears,
// so never serve this cached.
export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{
    package?: string | string[];
    addons?: string | string[];
  }>;
}) {
  const selection = readSelection(await searchParams);
  const grid = await listSlotGrid();
  const hours = Math.round((grid.slotMinutes / 60) * 10) / 10;
  const pkg = selection.packageId ? getPackage(selection.packageId) : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <BookingSteps current="time" done={pkg ? ["service"] : []} />
      <h1 className="font-heading mt-5 text-4xl sm:text-5xl lg:text-6xl">
        Pick one of the open times.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        Emery sets which days and windows are open, and this calendar shows exactly
        that — nothing more. Times that are grayed out are not available and cannot
        be booked. The window is only reserved once your payment clears, so if you
        stop partway through it stays open for the next customer.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-silver/80">
        Appointments run {hours} hours. {site.mobileOnlyNote} To move a prepaid
        booking, call {site.phone}.
      </p>

      {pkg ? (
        <div
          className="mt-8 rounded-xl bg-gold/8 p-5 ring-1 ring-gold/50 sm:p-6"
          data-testid="time-step-package"
        >
          <p className="text-xs tracking-[0.24em] text-gold uppercase">
            Car wash already picked
          </p>
          <p className="font-heading mt-2 text-2xl">
            {pkg.name} — {formatMoney(pkg.priceCents)}
          </p>
          <Link
            href={servicePath(selection)}
            className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-10 px-4")}
          >
            Change car wash
          </Link>
        </div>
      ) : (
        <div className="mt-8 rounded-xl bg-[#121216] p-5 ring-1 ring-white/10 sm:p-6">
          <p className="text-xs tracking-[0.24em] text-gold uppercase">
            Car wash not picked yet
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-silver">
            You can start from either end. Pick a time here and we will ask which
            car wash you want next, or choose the car wash first.
          </p>
          <Link
            href={servicePath(selection)}
            className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-10 px-4")}
          >
            Choose the car wash first
          </Link>
        </div>
      )}

      <div className="mt-10">
        <SlotPicker
          initialDays={grid.days}
          initialSource={grid.source}
          slotMinutes={grid.slotMinutes}
          packageId={selection.packageId}
          addonIds={selection.addonIds}
        />
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <a
          href={site.phoneTel}
          className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
        >
          Call {site.phone}
        </a>
        <Link
          href={servicePath(selection)}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-11 px-5",
          )}
        >
          Choose your car wash
        </Link>
      </div>
    </div>
  );
}
