import type { Metadata } from "next";
import { SlotPicker } from "@/components/book/slot-picker";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";
import { availabilityConfig, listOpenSlots } from "@/lib/slots";

export const metadata: Metadata = {
  title: "Book",
  description: `Pick an open mobile detailing window with ${site.name} and pay to lock it in.`,
};

// Availability changes as soon as a payment clears, so never serve this cached.
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const config = availabilityConfig();
  const slots = await listOpenSlots();
  const hours = Math.round((config.slotMinutes / 60) * 10) / 10;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl">
        Pick a window. We come to you.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        Every time below is open right now. Choose one and you go straight to the
        waiver and Square. The window is only reserved once your payment clears —
        if you stop partway through, it stays open for the next customer.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-silver/80">
        Appointments run {hours} hours. Same-day is typical when the calendar is
        open. To move a prepaid booking, call {site.phone}.
      </p>

      <div className="mt-10">
        <SlotPicker
          initialSlots={slots}
          timeZone={config.timeZone}
          slotMinutes={config.slotMinutes}
        />
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <a
          href={site.phoneTel}
          className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
        >
          Call {site.phone}
        </a>
        <a
          href="/pay"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-11 px-5",
          )}
        >
          Pay without picking a window
        </a>
      </div>
    </div>
  );
}
