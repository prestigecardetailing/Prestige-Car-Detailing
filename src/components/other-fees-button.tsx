"use client";

import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { notifyOwnerFromBrowser } from "@/lib/notify-owner";
import { hostedOnNetlify } from "@/lib/site";
import { openAmountLink } from "@/lib/square";

/**
 * "Other fees and services" — a separate Square charge, never part of a car wash
 * booking. Emery uses it on site: he types what the charge is for and the amount,
 * and Square takes that payment on its own. Deliberately a small form behind a
 * button rather than a panel on the page, so it stays out of the package list.
 */
function parseAmountCents(raw: string) {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const amount = Number.parseFloat(cleaned);
  if (!Number.isFinite(amount) || amount < 0.01) return null;
  return Math.round(amount * 100);
}

export function OtherFeesButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = parseAmountCents(amount);
  const ready = !!(description.trim() && amountCents);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function pay() {
    if (!ready || !amountCents) return;
    setSending(true);
    setError(null);
    const reason = description.trim().slice(0, 200);
    try {
      if (hostedOnNetlify()) {
        await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            "form-name": "other-fee",
            description: reason,
            amount: formatMoney(amountCents),
          }).toString(),
        }).catch(() => null);
      }
      await notifyOwnerFromBrowser({
        subject: "Prestige Car Wash other fee",
        name: "Other fees and services",
        message: `Separate charge — not a car wash booking.\nDescription: ${reason}\nAmount: ${formatMoney(amountCents)}`,
      }).catch(() => null);

      const res = await fetch("/api/other-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: reason, amountCents }),
      }).catch(() => null);
      const data = res && res.ok ? await res.json().catch(() => null) : null;
      const url = typeof data?.url === "string" ? data.url : openAmountLink();
      if (!url) {
        setError("Square is not connected on this deploy yet.");
        return;
      }
      window.location.assign(url);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="other-fees-button"
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "h-12 px-6 text-left",
          className,
        )}
      >
        Other fees and services not included separate from above.
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="other-fees-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-[#121216] p-5 ring-1 ring-white/15"
            data-testid="other-fees-form"
          >
            <p className="text-xs tracking-[0.24em] text-gold uppercase">
              Separate from the car wash
            </p>
            <h2 id="other-fees-title" className="font-heading mt-2 text-xl">
              Other fees and services
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-silver">
              Charged through Square on its own — this is not part of a car wash
              booking and no waiver is needed.
            </p>

            <div className="mt-4 space-y-2">
              <Label htmlFor="other-fee-description">What the charge is for</Label>
              <Input
                id="other-fee-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={200}
                placeholder="Exterior wash"
                className="h-11"
                autoFocus
              />
            </div>
            <div className="mt-3 space-y-2">
              <Label htmlFor="other-fee-amount">Amount</Label>
              <Input
                id="other-fee-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="25.00"
                className="h-11"
              />
            </div>

            {error ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={sending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={!ready || sending}
                onClick={() => void pay()}
                data-testid="other-fees-pay"
              >
                {sending
                  ? "Opening Square…"
                  : amountCents
                    ? `Pay ${formatMoney(amountCents)}`
                    : "Pay on Square"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
