"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addons,
  formatMoney,
  getPackage,
  packages,
  resolveSelection,
} from "@/lib/catalog";
import {
  clearPendingBooking,
  readPendingBooking,
  rememberPendingBooking,
} from "@/lib/booking-session";
import { cn } from "@/lib/cn";
import {
  CONTACT_REQUIRED_NOTE,
  type ContactErrors,
  validateContact,
} from "@/lib/contact";
import { notifyOwnerFromBrowser } from "@/lib/notify-owner";
import { createCheckout, openAmountLink, payConfigForSelection } from "@/lib/square";
import { hostedOnNetlify, site } from "@/lib/site";
import type { OpenSlot } from "@/lib/slots";
import {
  WAIVER_CLOSING,
  WAIVER_DISCLAIMER,
  WAIVER_SECTIONS,
  WAIVER_TITLE,
  WAIVER_VERSION,
  buildWaiverText,
} from "@/lib/waiver";

function toQuery(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}

function parseAmountCents(raw: string) {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0.01) return null;
  return Math.round(n * 100);
}

function formatEastern(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

/**
 * WO (2026-09-22):
 * - Free browse of packages/addons — no waiver on load, scroll, or package select.
 * - Waiver modal ONLY when user clicks Pay for a package.
 * - Hard modal: Esc / backdrop do not dismiss; Cancel Pay or complete (agree + typed name).
 * - Other fees path skips the waiver.
 * - Checkbox enabled only after scrolling the waiver body to the bottom.
 *
 * WO (2026-09-24): pay-first booking. A window arrives as ?slot=<id> from /book and
 * is shown here, but nothing is reserved — the hold is written server-side only
 * after Square confirms the payment.
 */
export function PayForm({ initialPackage }: { initialPackage?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuery = getPackage(searchParams.get("package") || "")?.id;
  const slotId = (searchParams.get("slot") || "").trim();
  const [slotLookup, setSlotLookup] = useState<{
    id: string;
    slot: OpenSlot | null;
  } | null>(null);
  const [slotTaken, setSlotTaken] = useState(false);
  const [packageId, setPackageId] = useState(
    fromQuery || initialPackage || packages[0]?.id || "interior",
  );
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Caller info. Name and phone are required before we hand anyone to Square.
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});

  const [waiverOpen, setWaiverOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [agreedAt, setAgreedAt] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [savingWaiver, setSavingWaiver] = useState(false);
  const waiverRef = useRef<HTMLDivElement>(null);

  const [otherReason, setOtherReason] = useState("");
  const [otherAmount, setOtherAmount] = useState("");
  const [remoteConfig, setRemoteConfig] = useState<{
    key: string;
    value: ReturnType<typeof payConfigForSelection>;
  } | null>(null);

  const selection = useMemo(
    () => resolveSelection(packageId, addonIds),
    [packageId, addonIds],
  );
  const lookupReady = !!slotId && slotLookup?.id === slotId;
  const slot = lookupReady ? slotLookup.slot : null;
  const slotState: "none" | "loading" | "open" | "taken" = !slotId
    ? "none"
    : slotTaken
      ? "taken"
      : !lookupReady
        ? "loading"
        : slot
          ? "open"
          : "taken";
  const selectionKey = `${packageId}:${addonIds.join(",")}`;
  const localConfig = useMemo(
    () => payConfigForSelection(packageId, addonIds),
    [packageId, addonIds],
  );
  const config =
    remoteConfig?.key === selectionKey ? remoteConfig.value : localConfig;
  const waiverSigned =
    agreed && signerName.trim().length >= 2 && !!agreedAt;
  const squareOpen = openAmountLink();
  const otherCents = parseAmountCents(otherAmount);
  const otherReady = !!(otherReason.trim() && otherCents);
  const canSubmitWaiver =
    scrolled && agreed && signerName.trim().length >= 2 && !savingWaiver;
  const contact = validateContact({
    name: contactName,
    phone: contactPhone,
    email: contactEmail,
  });

  async function storeWaiverPdf(name: string, at: string) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch("/api/waiver-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          agreedAt: at,
          packageId: selection.pkg.id,
          packageName: selection.pkg.name,
          addonIds,
          userAgent: navigator.userAgent,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn("Waiver PDF store failed", res.status);
        return { url: "", filename: "", id: "" };
      }
      if (!(res.headers.get("content-type") || "").includes("application/json")) {
        return { url: "", filename: "", id: "" };
      }
      const data = await res.json();
      let url =
        typeof data.url === "string" && data.url
          ? data.url
          : "";
      // Prefer absolute path-style PDF URLs (query params get stripped by some mail clients)
      if (url.startsWith("/")) {
        url = `${window.location.origin}${url}`;
      }
      if (url && !/^https?:\/\//i.test(url) && typeof data.id === "string") {
        url = `${window.location.origin}/api/waiver-pdf/${data.id}`;
      }
      const filename = typeof data.filename === "string" ? data.filename : "";
      const id = typeof data.id === "string" ? data.id : "";
      return { url, filename, id };
    } catch (err) {
      console.warn("Waiver PDF store failed", err);
      return { url: "", filename: "", id: "" };
    } finally {
      window.clearTimeout(timer);
    }
  }

  /**
   * Undo before payment. Nothing is held at this point, so dropping the slot from
   * the URL is enough to put it back in front of the next customer — but if this
   * visit already opened a Square checkout, cancel that pending record too so any
   * stray hold is released right away.
   */
  function clearSlotSelection() {
    const pending = readPendingBooking();
    if (pending?.bookingId) {
      void fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: pending.bookingId }),
      }).catch(() => null);
      clearPendingBooking();
    }
    setSlotLookup(null);
    setSlotTaken(false);
    setError(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("slot");
    const query = params.toString();
    router.replace(query ? `/pay?${query}` : "/pay", { scroll: false });
  }

  function openWaiverForPay() {
    setError(null);
    setScrolled(false);
    setAgreed(false);
    setWaiverOpen(true);
  }

  function cancelPay() {
    setWaiverOpen(false);
    setAgreed(false);
    setScrolled(false);
    setSavingWaiver(false);
    setError(null);
  }

  async function checkoutPackage(waiver?: {
    name: string;
    agreedAt: string;
    pdfUrl: string;
    pdfId: string;
  }) {
    setError(null);
    setLoading(true);
    try {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId,
            addonIds,
            slotId: slotState === "open" ? slot?.id : undefined,
            name: contact.value?.name,
            phone: contact.value?.phone,
            email: contact.value?.email || undefined,
            waiver,
          }),
        });
        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          setSlotTaken(true);
          setError(
            data.error ||
              "That window was just taken. Pick another open time on the Book page.",
          );
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            if (data.bookingId) {
              rememberPendingBooking(data.bookingId, slot?.id || "");
            }
            window.location.assign(data.url);
            return;
          }
        }
      } catch {
        /* client fallback */
      }
      const fallback = await createCheckout(
        packageId,
        addonIds,
        window.location.origin,
      );
      if (fallback?.url) {
        window.location.assign(fallback.url);
        return;
      }
      if (squareOpen) {
        window.location.assign(squareOpen);
        return;
      }
      setError("Square is not connected for this selection yet.");
    } finally {
      setLoading(false);
    }
  }

  async function signWaiverAndPay() {
    if (!canSubmitWaiver) return;
    const name = signerName.trim();
    const at = new Date().toISOString();
    setSavingWaiver(true);
    try {
      const pdf = await storeWaiverPdf(name, at);
      const eastern = formatEastern(at);
      const addonNames =
        selection.selectedAddons.length > 0
          ? selection.selectedAddons.map((a) => a.name).join(", ")
          : "None";
      const totalLabel = formatMoney(selection.totalCents);
      const payload = {
        name,
        agreedAt: at,
        agreedAtEastern: eastern,
        packageId: selection.pkg.id,
        packageName: selection.pkg.name,
        addonIds: addonIds.join(","),
        addonNames,
        total: totalLabel,
        window: slotState === "open" && slot ? slot.label : "No window selected",
        phone: contact.value?.phoneDisplay || "",
        email: contact.value?.email || "",
        waiverVersion: WAIVER_VERSION,
        payUrl: `${site.url}/pay`,
        pdfUrl: pdf.url,
        pdfFilename: pdf.filename,
        pdfId: pdf.id,
        waiverText: buildWaiverText(),
      };

      if (hostedOnNetlify()) {
        await fetch("/", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: toQuery({ "form-name": "waiver", ...payload }),
        }).catch(() => null);
      }

      await fetch("/api/waiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          agreedAt: at,
          packageId: selection.pkg.id,
          addonIds,
          pdfUrl: pdf.url,
          pdfFilename: pdf.filename,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => null);

      await notifyOwnerFromBrowser({
        subject: `Prestige Car Wash waiver — ${name}`,
        name,
        phone: contact.value?.phoneDisplay || "",
        pdf: pdf.url,
        pdfId: pdf.id,
        message: [
          "Signed liability waiver — Prestige Car Wash",
          "",
          ...(pdf.url
            ? [
                "FULL WAIVER PDF — save this for your records",
                "1. Open the link below (it starts a download).",
                `2. Keep the file (${pdf.filename || "prestige-waiver.pdf"}) with the job folder.`,
                "3. On iPhone: tap the downloaded file → Share → Save to Files.",
                "4. On a computer: the browser downloads it; move it into the customer folder.",
                pdf.url,
              ]
            : [
                "A PDF download link was not stored for this signing. Use the summary below, and check Netlify → Forms → waiver if you need the backup row.",
              ]),
          "",
          `Legal name (signature): ${name}`,
          `Phone: ${contact.value?.phoneDisplay || "(not given)"}`,
          `Email: ${contact.value?.email || "(not given)"}`,
          `Signed at (ISO): ${at}`,
          `Signed at (America/New_York): ${eastern}`,
          `Window requested: ${
            slotState === "open" && slot ? slot.label : "No window selected"
          } (not held until Square clears)`,
          `Package: ${selection.pkg.name}`,
          `Add-ons: ${addonNames}`,
          `Total shown: ${totalLabel}`,
          `Waiver version: ${WAIVER_VERSION}`,
          `Pay page: ${site.url}/pay`,
          `User-Agent: ${navigator.userAgent}`,
        ].join("\n"),
      }).catch((err) => {
        console.warn("Waiver notify failed", err);
        return null;
      });

      setAgreedAt(at);
      setWaiverOpen(false);
      await checkoutPackage({
        name,
        agreedAt: at,
        pdfUrl: pdf.url,
        pdfId: pdf.id,
      });
    } catch (err) {
      console.warn("Waiver record failed", err);
      setError("Could not save the waiver. Please try again.");
    } finally {
      setSavingWaiver(false);
    }
  }

  /** Nobody continues to Square without a name and a phone number. */
  function contactReadyOrBlock() {
    setContactErrors(contact.errors);
    if (contact.ok) return true;
    setError(
      contact.errors.name || contact.errors.phone
        ? "Add your name and phone number before continuing to payment."
        : "Check the contact details above before continuing to payment.",
    );
    document
      .getElementById("contact-name")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  function onPayClick() {
    if (!config.canChargeSelection) {
      setError("Square is not connected for this selection yet.");
      return;
    }
    setError(null);
    if (!contactReadyOrBlock()) return;
    if (waiverSigned) {
      void checkoutPackage();
      return;
    }
    if (!signerName.trim() && contact.value?.name) {
      setSignerName(contact.value.name);
    }
    openWaiverForPay();
  }

  async function payOtherFee() {
    if (!otherReady || !otherCents) return;
    if (hostedOnNetlify()) {
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: toQuery({
          "form-name": "other-fee",
          description: otherReason.trim().slice(0, 200),
          amount: formatMoney(otherCents),
        }),
      }).catch(() => null);
    }
    await notifyOwnerFromBrowser({
      subject: "Prestige Car Wash other-fee",
      name: "Other fee",
      message: `Description: ${otherReason.trim().slice(0, 200)}\nAmount: ${formatMoney(otherCents)}`,
    }).catch(() => null);
    window.location.assign(squareOpen);
  }

  useEffect(() => {
    const params = new URLSearchParams({
      packageId,
      addonIds: addonIds.join(","),
    });
    const key = `${packageId}:${addonIds.join(",")}`;
    const controller = new AbortController();
    fetch(`/api/pay-config?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.mode && data.mode !== "disconnected") {
          setRemoteConfig({ key, value: data });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [packageId, addonIds]);

  // Confirm the window from /book is still open. Looking is free — nothing is
  // reserved here, and the same check runs again server-side at checkout.
  useEffect(() => {
    if (!slotId) return;
    const controller = new AbortController();
    fetch("/api/open-slots", { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { slots?: OpenSlot[] } | null) => {
        setSlotLookup({
          id: slotId,
          slot: data?.slots?.find((s) => s.id === slotId) || null,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSlotLookup({ id: slotId, slot: null });
      });
    return () => controller.abort();
  }, [slotId]);

  useEffect(() => {
    const el = waiverRef.current;
    if (el && waiverOpen && el.scrollHeight <= el.clientHeight + 8) {
      setScrolled(true);
    }
  }, [waiverOpen]);

  useEffect(() => {
    if (!waiverOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [waiverOpen]);

  return (
    <div className="space-y-10">
      {slotState !== "none" ? (
        <div
          className={cn(
            "rounded-xl p-5 ring-1 sm:p-6",
            slotState === "open"
              ? "bg-gold/8 ring-gold/50"
              : "bg-[#121216] ring-white/10",
          )}
          data-testid="selected-slot"
        >
          <p className="text-xs tracking-[0.24em] text-gold uppercase">
            {slotState === "open" ? "Window you picked" : "Window"}
          </p>
          {slotState === "loading" ? (
            <p className="mt-2 text-sm text-silver">Checking that window…</p>
          ) : slotState === "open" && slot ? (
            <>
              <p className="font-heading mt-2 text-2xl">{slot.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-silver">
                Still open. It is <strong className="text-silver">not</strong>{" "}
                reserved yet — we hold it the moment Square confirms your
                payment. Leave without paying and it stays open for someone else.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/book"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-10 px-4",
                  )}
                >
                  Change time
                </Link>
                <button
                  type="button"
                  onClick={clearSlotSelection}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-10 px-4",
                  )}
                  data-testid="clear-slot"
                >
                  Clear selection
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-heading mt-2 text-2xl">
                That window is no longer on the board.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-silver">
                Someone paid for it first, or it aged out. Pick another open time
                — you can still pay for a package here and we will call to
                schedule.
              </p>
              <Link
                href="/book"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "mt-4 h-10 px-4",
                )}
              >
                See open windows
              </Link>
            </>
          )}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <fieldset data-testid="contact-fields">
            <legend className="font-heading text-xl">Your info</legend>
            <p className="mt-2 text-sm text-silver">{CONTACT_REQUIRED_NOTE}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-name">
                  Full name <span className="text-gold">(required)</span>
                </Label>
                <Input
                  id="contact-name"
                  name="name"
                  value={contactName}
                  onChange={(e) => {
                    setContactName(e.target.value);
                    setContactErrors((prev) => ({ ...prev, name: undefined }));
                    setError(null);
                  }}
                  autoComplete="name"
                  maxLength={80}
                  aria-required="true"
                  aria-invalid={!!contactErrors.name}
                  className="h-11"
                />
                {contactErrors.name ? (
                  <p className="text-sm text-destructive" role="alert">
                    {contactErrors.name}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">
                  Phone <span className="text-gold">(required)</span>
                </Label>
                <Input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  value={contactPhone}
                  onChange={(e) => {
                    setContactPhone(e.target.value);
                    setContactErrors((prev) => ({ ...prev, phone: undefined }));
                    setError(null);
                  }}
                  autoComplete="tel"
                  placeholder="864-555-0134"
                  maxLength={24}
                  aria-required="true"
                  aria-invalid={!!contactErrors.phone}
                  className="h-11"
                />
                {contactErrors.phone ? (
                  <p className="text-sm text-destructive" role="alert">
                    {contactErrors.phone}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contact-email">
                  Email <span className="text-silver/70">(optional)</span>
                </Label>
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => {
                    setContactEmail(e.target.value);
                    setContactErrors((prev) => ({ ...prev, email: undefined }));
                    setError(null);
                  }}
                  autoComplete="email"
                  placeholder="Leave blank if you would rather not"
                  maxLength={120}
                  aria-invalid={!!contactErrors.email}
                  className="h-11"
                />
                {contactErrors.email ? (
                  <p className="text-sm text-destructive" role="alert">
                    {contactErrors.email}
                  </p>
                ) : null}
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-heading text-xl">Package</legend>
            <div className="mt-4 grid gap-3">
              {packages.map((pkg) => {
                const selected = pkg.id === packageId;
                return (
                  <label
                    key={pkg.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl px-4 py-4 ring-1 transition-colors",
                      selected
                        ? "bg-gold/8 ring-gold/50"
                        : "bg-[#121216] ring-white/10 hover:ring-white/20",
                    )}
                  >
                    <input
                      type="radio"
                      name="package"
                      value={pkg.id}
                      checked={selected}
                      onChange={() => setPackageId(pkg.id)}
                      className="mt-1 size-4 shrink-0 accent-[#d4af37]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {pkg.name}
                        </span>
                        <span className="text-gold">
                          {formatMoney(pkg.priceCents)}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-silver">
                        {pkg.summary}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-heading text-xl">Add-ons</legend>
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
                      name="addons"
                      value={addon.id}
                      checked={selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAddonIds((prev) => {
                          const has = prev.includes(addon.id);
                          if (checked && !has) return [...prev, addon.id];
                          if (!checked && has)
                            return prev.filter((id) => id !== addon.id);
                          return prev;
                        });
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
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-xl bg-[#121216] p-6 ring-1 ring-white/10">
            <h2 className="font-heading text-xl">Order summary</h2>
            <p className="mt-2 text-sm text-silver">
              Pay in full up front. No sales tax is added on this page.
            </p>
            {slotState === "open" && slot ? (
              <p className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-sm text-gold">
                {slot.label}
              </p>
            ) : null}
            <ul className="mt-6 space-y-3 text-sm" data-testid="order-lines">
              {selection.lines.map((line) => (
                <li key={line.id} className="flex justify-between gap-4">
                  <span className="text-silver">{line.name}</span>
                  <span>{formatMoney(line.priceCents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-between border-t border-white/10 pt-4">
              <span className="text-sm tracking-wide text-silver uppercase">
                Total
              </span>
              <span className="font-heading text-3xl" data-testid="order-total">
                {formatMoney(selection.totalCents)}
              </span>
            </div>
            {waiverSigned ? (
              <p className="mt-6 text-xs text-gold" role="status">
                Waiver signed by {signerName.trim()}
              </p>
            ) : (
              <p className="mt-6 text-xs text-silver">
                Browse freely. The liability waiver opens when you click Pay.
              </p>
            )}
            {!contact.ok ? (
              <p className="mt-2 text-xs text-silver" data-testid="contact-hint">
                Your name and phone go in above before you can continue to
                payment. Email is optional.
              </p>
            ) : null}
            <Button
              type="button"
              size="lg"
              className="mt-6 h-12 w-full"
              disabled={loading || savingWaiver || !config.canChargeSelection}
              onClick={onPayClick}
            >
              {loading
                ? "Opening Square…"
                : `Pay ${formatMoney(selection.totalCents)}`}
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-silver/80">
              Square opens a pay-what-you-owe screen. Enter{" "}
              <strong className="text-silver">
                {formatMoney(selection.totalCents)}
              </strong>{" "}
              as the amount — that is your total here.
            </p>
            {error ? (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {waiverOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="waiver-title"
          // Hard modal: backdrop click does not dismiss
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="my-6 w-full max-w-2xl rounded-xl bg-[#121216] p-5 ring-1 ring-white/15 sm:p-8">
            <p className="text-xs tracking-[0.24em] text-gold uppercase">
              Required before package pay
            </p>
            <h2 id="waiver-title" className="font-heading mt-2 text-2xl">
              {WAIVER_TITLE}
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-silver">
              {WAIVER_DISCLAIMER} Scroll to the end, check that you agree, and
              type your full legal name. This window stays open until you agree
              or cancel Pay.
            </p>

            <div
              ref={waiverRef}
              onScroll={() => {
                const el = waiverRef.current;
                if (
                  el &&
                  el.scrollTop + el.clientHeight >= el.scrollHeight - 12
                ) {
                  setScrolled(true);
                }
              }}
              className="mt-5 max-h-[32vh] space-y-4 overflow-y-auto rounded-lg border border-white/10 p-3 pr-2 text-sm leading-relaxed text-silver sm:max-h-[36vh]"
            >
              <p>
                By booking and/or paying for services, I (the “Customer”) agree
                as follows:
              </p>
              {WAIVER_SECTIONS.map((section) => (
                <div key={section.heading}>
                  <p className="font-medium text-foreground">
                    {section.heading}
                  </p>
                  <p className="mt-1">{section.body}</p>
                </div>
              ))}
              <p className="font-medium text-foreground">{WAIVER_CLOSING}</p>
            </div>

            {!scrolled ? (
              <p
                className="mt-3 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold"
                role="status"
              >
                Scroll to the bottom of the waiver to continue.
              </p>
            ) : (
              <p className="mt-3 text-xs text-silver" role="status">
                End of waiver reached — you can agree below.
              </p>
            )}

            <label
              className={cn(
                "mt-6 flex items-start gap-3",
                scrolled ? "cursor-pointer" : "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="checkbox"
                checked={agreed}
                disabled={!scrolled || savingWaiver}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[#d4af37]"
              />
              <span className="text-sm">
                I have read and agree to this service agreement and liability
                waiver.
              </span>
            </label>

            <div className="mt-4 space-y-2">
              <Label htmlFor="waiver-name">
                Type your full legal name as signature
              </Label>
              <Input
                id="waiver-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                autoComplete="name"
                maxLength={80}
                disabled={!scrolled || savingWaiver}
                className="h-11"
              />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={savingWaiver}
                onClick={cancelPay}
              >
                Cancel Pay
              </Button>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={!canSubmitWaiver}
                onClick={() => void signWaiverAndPay()}
              >
                {savingWaiver
                  ? "Saving your signature…"
                  : "I agree — continue to payment"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <section
        id="other-fees"
        className="rounded-xl border border-gold/30 bg-[#121216] p-6 ring-1 ring-white/10 sm:p-8"
      >
        <p className="text-xs font-medium tracking-[0.28em] text-gold uppercase">
          Separate from packages
        </p>
        <h2 className="font-heading mt-2 text-2xl">Other fees & services</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-silver sm:text-base">
          Use this for a quoted extra, a balance, or any charge that is not a
          listed package. No waiver is required here. Square will ask you to
          type the amount.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-2">
            <Label htmlFor="other-reason">What this charge is for</Label>
            <Textarea
              id="other-reason"
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              maxLength={200}
              placeholder="Trip fee, extra stain work, remaining balance…"
              className="min-h-24"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="other-amount">Amount</Label>
            <Input
              id="other-amount"
              inputMode="decimal"
              value={otherAmount}
              onChange={(e) => setOtherAmount(e.target.value)}
              placeholder="25.00"
              className="h-11"
            />
          </div>
        </div>
        {otherReason.trim() && otherCents ? (
          <p className="mt-4 text-sm text-gold" role="status">
            You are paying {formatMoney(otherCents)} for “
            {otherReason.trim()}”. Enter {formatMoney(otherCents)} on the Square
            screen.
          </p>
        ) : (
          <p className="mt-4 text-sm text-silver">
            Type what the charge is for and an amount, then continue to Square.
          </p>
        )}
        <a
          href={otherReady ? squareOpen : undefined}
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-5 h-12 px-6",
            !otherReady && "pointer-events-none opacity-50",
          )}
          aria-disabled={!otherReady}
          onClick={(e) => {
            if (otherReady) {
              e.preventDefault();
              void payOtherFee();
            } else {
              e.preventDefault();
            }
          }}
        >
          {otherCents
            ? `Pay ${formatMoney(otherCents)} on Square`
            : "Pay this amount on Square"}
        </a>
      </section>
    </div>
  );
}
