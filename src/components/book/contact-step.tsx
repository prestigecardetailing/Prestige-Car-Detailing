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
import {
  payPath,
  readyForDetails,
  selectionFromQuery,
  servicePath,
  timePath,
} from "@/lib/booking-flow";
import { formatMoney, resolveSelection } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { type ContactErrors, validateContact } from "@/lib/contact";
import { site } from "@/lib/site";
import type { OpenSlot } from "@/lib/slots";

const REQUIRED_FIELD_ORDER = [
  "firstName",
  "lastName",
  "phone",
  "address",
  "city",
  "state",
  "zip",
  "email",
  "password",
] as const;

const FIELD_INPUT_ID: Record<string, string> = {
  firstName: "contact-first-name",
  lastName: "contact-last-name",
  phone: "contact-phone",
  address: "contact-address",
  city: "contact-city",
  state: "contact-state",
  zip: "contact-zip",
  email: "contact-email",
  password: "contact-password",
};

/**
 * Customer information — the third step, and the one that waits for the other
 * two. The car wash type and the time slot can be done in either order, but this
 * screen only unlocks once both are chosen; until then it points back at whichever
 * one is missing. From here the order is fixed: waiver, then the pay screen.
 *
 * Nothing is held here either. The password is optional and never travels further
 * than this step: if one is typed, the account is created here and it is dropped.
 */
export function ContactStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selection = selectionFromQuery((key) => searchParams.get(key));
  const { packageId, addonIds, slotId } = selection;

  const [draft, setDraft] = useState<ContactDraft>(emptyContactDraft);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<ContactErrors>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
  const bothChosen = readyForDetails(selection);
  let order: ReturnType<typeof resolveSelection> | null = null;
  if (packageId) {
    try {
      order = resolveSelection(packageId, addonIds);
    } catch {
      order = null;
    }
  }

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

  function focusFirstError(current: ContactErrors) {
    const field = REQUIRED_FIELD_ORDER.find((key) => current[key]);
    if (!field) return;
    document
      .getElementById(FIELD_INPUT_ID[field])
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function onContinue() {
    if (!bothChosen) {
      setSummary(
        "Finish choosing your car wash and your time slot before we take your details.",
      );
      return;
    }
    const contact = validateContact({ ...draft, password });
    setErrors(contact.errors);
    if (!contact.ok) {
      setSummary(
        "Fill in your name, phone, and the full service address to continue to the waiver.",
      );
      focusFirstError(contact.errors);
      return;
    }

    saveContactDraft(draft);

    // Optional account. A failure here must not block the booking, so the only
    // thing that stops the customer is a password that clashes with an existing
    // account — otherwise they carry on to payment either way.
    if (password) {
      setSaving(true);
      try {
        const res = await fetch("/api/account/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, password }),
        });
        if (res.status === 409) {
          const data = await res.json().catch(() => null);
          setErrors({
            password:
              data?.fields?.password ||
              "That password does not match the account already on this phone number.",
          });
          setSummary(
            data?.error ||
              "There is already an account on that phone number. Enter its password, or clear the password to book without an account.",
          );
          focusFirstError({ password: "clash" });
          return;
        }
        if (!res.ok) {
          console.warn("Account create failed", res.status);
        }
      } catch (err) {
        console.warn("Account create failed", err);
      } finally {
        setSaving(false);
      }
    }

    router.push(payPath(selection));
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div
          className={cn(
            "rounded-xl p-5 ring-1",
            order ? "bg-gold/8 ring-gold/50" : "bg-[#121216] ring-white/10",
          )}
          data-testid="step-package"
        >
          <p className="text-xs tracking-[0.24em] text-gold uppercase">
            Car wash type
          </p>
          {order ? (
            <>
              <p className="font-heading mt-2 text-2xl">{order.pkg.name}</p>
              <p className="mt-1 text-sm text-silver">
                {formatMoney(order.totalCents)}
                {order.selectedAddons.length > 0
                  ? ` · ${order.selectedAddons.map((a) => a.name).join(", ")}`
                  : ""}
              </p>
            </>
          ) : (
            <p className="font-heading mt-2 text-2xl">Not chosen yet.</p>
          )}
          <Link
            href={servicePath(selection)}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-4 h-10 px-4",
            )}
          >
            {order ? "Change car wash" : "Choose your car wash"}
          </Link>
        </div>

        <div
          className={cn(
            "rounded-xl p-5 ring-1",
            slot ? "bg-gold/8 ring-gold/50" : "bg-[#121216] ring-white/10",
          )}
          data-testid="step-slot"
        >
          <p className="text-xs tracking-[0.24em] text-gold uppercase">
            Time slot
          </p>
          {!slotId ? (
            <p className="font-heading mt-2 text-2xl">Not chosen yet.</p>
          ) : !ready ? (
            <p className="mt-2 text-sm text-silver">Checking that window…</p>
          ) : slot ? (
            <>
              <p className="font-heading mt-2 text-2xl">{slot.label}</p>
              <p className="mt-1 text-sm text-silver">
                Not reserved until Square confirms your payment.
              </p>
            </>
          ) : (
            <p className="font-heading mt-2 text-2xl">
              That window is no longer open.
            </p>
          )}
          <Link
            href={timePath(selection)}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-4 h-10 px-4",
            )}
          >
            {slot ? "Change time" : "See open windows"}
          </Link>
        </div>
      </div>

      {!bothChosen ? (
        <div
          className="rounded-xl bg-[#121216] p-6 ring-1 ring-white/10 sm:p-8"
          data-testid="details-locked"
        >
          <h2 className="font-heading text-2xl">
            One more choice before your details.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-silver sm:text-base">
            {!packageId && !slotId
              ? "Pick the car wash you want and an open window, then we will ask who you are and where to come."
              : !packageId
                ? "Your window is picked. Choose the car wash that goes with it and this screen opens."
                : "Your car wash is picked. Choose one of the open windows and this screen opens."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {!packageId ? (
              <Link
                href={servicePath(selection)}
                className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
              >
                Choose your car wash
              </Link>
            ) : null}
            {!slotId ? (
              <Link
                href={timePath(selection)}
                className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
              >
                Pick an open time
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-[#121216] p-6 ring-1 ring-white/10 sm:p-8">
          <h2 className="font-heading text-xl">Your info</h2>
          <div className="mt-4">
            <ContactFields
              value={draft}
              errors={errors}
              onChange={onChange}
              password={{
                value: password,
                onChange: (next) => {
                  setPassword(next);
                  setErrors((prev) => {
                    const rest = { ...prev };
                    delete rest.password;
                    return rest;
                  });
                  setSummary(null);
                },
              }}
            />
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
              disabled={saving}
              onClick={() => void onContinue()}
              data-testid="continue-to-payment"
            >
              {saving ? "Saving your details…" : "Continue to the waiver"}
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
            Next screen: sign the liability waiver, then pay through Square. The
            window is held only once that payment clears.
          </p>
        </div>
      )}
    </div>
  );
}
