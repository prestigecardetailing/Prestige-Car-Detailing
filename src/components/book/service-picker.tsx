"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  afterServiceStep,
  parseAddonIds,
  parsePackageId,
  parseSlotParam,
  timePath,
} from "@/lib/booking-flow";
import { addons, formatMoney, packages, resolveSelection } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import type { OpenSlot } from "@/lib/slots";

/**
 * Step "car wash type". Reached from any package or price on the site — a price
 * click lands here, never on the customer information screen.
 *
 * Nothing is charged and no window is held here. Continuing goes to the time step
 * when no window has been picked yet, or straight to the information step when the
 * customer started from the booking calendar.
 */
export function ServicePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slotId = parseSlotParam(searchParams.get("slot"));
  const fromQuery = parsePackageId(searchParams.get("package"));

  const [packageId, setPackageId] = useState<string | null>(fromQuery);
  const [addonIds, setAddonIds] = useState<string[]>(
    parseAddonIds(searchParams.get("addons")),
  );
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{ id: string; slot: OpenSlot | null } | null>(
    null,
  );

  useEffect(() => {
    if (!slotId) return;
    const controller = new AbortController();
    fetch("/api/open-slots", { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { slots?: OpenSlot[] } | null) => {
        setLookup({
          id: slotId,
          slot: data?.slots?.find((s) => s.id === slotId) || null,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLookup({ id: slotId, slot: null });
      });
    return () => controller.abort();
  }, [slotId]);

  const selection = useMemo(() => {
    if (!packageId) return null;
    try {
      return resolveSelection(packageId, addonIds);
    } catch {
      return null;
    }
  }, [packageId, addonIds]);

  const pickedSlot = lookup?.id === slotId ? lookup.slot : null;

  function onContinue() {
    if (!packageId) {
      setError("Choose the car wash you want before you continue.");
      return;
    }
    setError(null);
    router.push(afterServiceStep({ packageId, addonIds, slotId }));
  }

  return (
    <div className="space-y-8">
      {slotId ? (
        <div
          className={cn(
            "rounded-xl p-5 ring-1 sm:p-6",
            pickedSlot ? "bg-gold/8 ring-gold/50" : "bg-[#121216] ring-white/10",
          )}
          data-testid="service-step-slot"
        >
          <p className="text-xs tracking-[0.24em] text-gold uppercase">
            Time slot already picked
          </p>
          <p className="font-heading mt-2 text-2xl">
            {lookup?.id !== slotId
              ? "Checking that window…"
              : pickedSlot
                ? pickedSlot.label
                : "That window is no longer open."}
          </p>
          <Link
            href={timePath({ packageId, addonIds })}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-4 h-10 px-4",
            )}
          >
            {pickedSlot ? "Change time" : "See open windows"}
          </Link>
        </div>
      ) : null}

      <fieldset data-testid="car-wash-types">
        <legend className="font-heading text-xl">Pick your car wash</legend>
        <div className="mt-4 grid gap-3">
          {packages.map((pkg) => {
            const selected = pkg.id === packageId;
            return (
              <label
                key={pkg.id}
                data-package={pkg.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl px-4 py-4 ring-1 transition-colors",
                  selected
                    ? "bg-gold/8 ring-gold/50"
                    : "bg-[#121216] ring-white/10 hover:ring-white/20",
                )}
              >
                <input
                  type="radio"
                  name="car-wash-type"
                  value={pkg.id}
                  checked={selected}
                  onChange={() => {
                    setPackageId(pkg.id);
                    setError(null);
                  }}
                  className="mt-1 size-4 shrink-0 accent-[#d4af37]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{pkg.name}</span>
                    <span className="text-gold">
                      {formatMoney(pkg.priceCents)}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-silver">
                    {pkg.summary}
                  </span>
                  {pkg.priceNote ? (
                    <span className="mt-1 block text-xs text-gold">
                      {pkg.priceNote}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-heading text-xl">Add-ons (optional)</legend>
        <div className="mt-4 space-y-3">
          {addons.map((addon) => {
            const selected = addonIds.includes(addon.id);
            return (
              <label
                key={addon.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl px-4 py-4 ring-1 transition-colors",
                  selected
                    ? "bg-gold/8 ring-gold/50"
                    : "bg-[#121216] ring-white/10 hover:ring-white/20",
                )}
              >
                <input
                  type="checkbox"
                  value={addon.id}
                  checked={selected}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAddonIds((prev) =>
                      checked
                        ? prev.includes(addon.id)
                          ? prev
                          : [...prev, addon.id]
                        : prev.filter((id) => id !== addon.id),
                    );
                  }}
                  className="mt-1 size-4 shrink-0 accent-[#d4af37]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{addon.name}</span>
                    <span className="text-gold">
                      +{formatMoney(addon.priceCents)}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-silver">
                    {addon.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-xl bg-[#121216] p-5 ring-1 ring-white/10 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-sm tracking-wide text-silver uppercase">
            Running total
          </span>
          <span className="font-heading text-3xl" data-testid="service-total">
            {selection ? formatMoney(selection.totalCents) : "—"}
          </span>
        </div>
        <p className="mt-2 text-sm text-silver">
          {selection
            ? `${selection.pkg.name}${
                selection.selectedAddons.length > 0
                  ? ` + ${selection.selectedAddons.map((a) => a.name).join(", ")}`
                  : ""
              }. Nothing is charged on this screen.`
            : "Choose a car wash to see the total. Nothing is charged on this screen."}
        </p>
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          size="lg"
          className="mt-5 h-12 w-full sm:w-auto sm:px-8"
          disabled={!packageId}
          onClick={onContinue}
          data-testid="continue-from-service"
        >
          {slotId ? "Continue to your information" : "Continue to pick a time"}
        </Button>
      </div>
    </div>
  );
}
