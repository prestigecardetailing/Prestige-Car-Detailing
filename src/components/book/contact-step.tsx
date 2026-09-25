"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ContactFields } from "@/components/booking/contact-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  type ContactDraft,
  emptyContactDraft,
  readContactDraft,
  saveContactDraft,
} from "@/lib/booking-session";
import { cn } from "@/lib/cn";
import { type ContactErrors, validateContact } from "@/lib/contact";
import { site } from "@/lib/site";
import type { OpenSlot } from "@/lib/slots";

/**
 * Step 2 of the booking flow: /book → /book/details?slot=... → /pay?slot=...
 *
 * Nothing is held here either — this step only collects the caller info Prestige
 * needs before a booking can be confirmed, and refuses to hand the customer on
 * to payment until name, phone, and the service address are all filled in.
 */
export function ContactStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slotId = (searchParams.get("slot") || "").trim();

  const [draft, setDraft] = useState<ContactDraft>(emptyContactDraft);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{ id: string; slot: OpenSlot | null } | null>(
    null,
  );

  // Coming back from /pay to fix a detail should not mean retyping everything.
  // Read after the first paint so the server and client markup still match.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(readContactDraft()).then((saved) => {
      if (!cancelled && saved) setDraft(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const ready = !!slotId && lookup?.id === slotId;
  const slot = ready ? lookup.slot : null;

  function onChange(patch: Partial<ContactDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as (keyof ContactDraft)[]) {
        delete next[key];
      }
      return next;
    });
    setSummary(null);
  }

  function onContinue() {
    const contact = validateContact(draft);
    setErrors(contact.errors);
    if (!contact.ok) {
      setSummary(
        contact.errors.name || contact.errors.phone || contact.errors.address
          ? "Add your name, phone, and service address to continue to payment."
          : "Check the details above to continue to payment.",
      );
      const firstBad = contact.errors.name
        ? "contact-name"
        : contact.errors.phone
          ? "contact-phone"
          : contact.errors.address
            ? "contact-address"
            : "contact-email";
      document
        .getElementById(firstBad)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    saveContactDraft(draft);
    router.push(slotId ? `/pay?slot=${encodeURIComponent(slotId)}` : "/pay");
  }

  return (
    <div className="space-y-8">
      <div
        className={cn(
          "rounded-xl p-5 ring-1 sm:p-6",
          slot ? "bg-gold/8 ring-gold/50" : "bg-[#121216] ring-white/10",
        )}
        data-testid="step-slot"
      >
        <p className="text-xs tracking-[0.24em] text-gold uppercase">
          {slot ? "Window you picked" : "Window"}
        </p>
        {!slotId ? (
          <>
            <p className="font-heading mt-2 text-2xl">No window picked yet.</p>
            <p className="mt-2 text-sm leading-relaxed text-silver">
              Start on the Book page and choose an open time, or fill this in and
              pay — we will call to schedule.
            </p>
          </>
        ) : !ready ? (
          <p className="mt-2 text-sm text-silver">Checking that window…</p>
        ) : slot ? (
          <>
            <p className="font-heading mt-2 text-2xl">{slot.label}</p>
            <p className="mt-2 text-sm leading-relaxed text-silver">
              Not reserved yet. We hold it the moment Square confirms your
              payment on the next screen.
            </p>
          </>
        ) : (
          <>
            <p className="font-heading mt-2 text-2xl">
              That window is no longer on the board.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-silver">
              Someone paid for it first, or it aged out. Pick another open time.
            </p>
          </>
        )}
        <Link
          href="/book"
          className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-10 px-4")}
        >
          {slot ? "Change time" : "See open windows"}
        </Link>
      </div>

      <div className="rounded-xl bg-[#121216] p-6 ring-1 ring-white/10 sm:p-8">
        <h2 className="font-heading text-xl">Your info</h2>
        <div className="mt-4">
          <ContactFields value={draft} errors={errors} onChange={onChange} />
        </div>

        {summary ? (
          <p className="mt-5 text-sm text-destructive" role="alert">
            {summary}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="lg"
            className="h-12 px-6"
            onClick={onContinue}
            data-testid="continue-to-payment"
          >
            Continue to payment
          </Button>
          <a
            href={site.phoneTel}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-12 px-5",
            )}
          >
            Rather book by phone? Call {site.phone}
          </a>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-silver/80">
          Next screen: pick your package, sign the liability waiver, and pay
          through Square. The window is held only once that payment clears.
        </p>
      </div>
    </div>
  );
}
