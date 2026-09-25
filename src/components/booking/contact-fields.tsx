"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContactDraft } from "@/lib/booking-session";
import { CONTACT_REQUIRED_NOTE, type ContactErrors } from "@/lib/contact";

/**
 * The caller-info form. Name, phone, and the physical service address are
 * required; email is asked for but optional. Used by the contact step
 * (/book/details) and again on /pay, so the two can never drift apart.
 */
export function ContactFields({
  value,
  errors,
  onChange,
}: {
  value: ContactDraft;
  errors: ContactErrors;
  onChange: (patch: Partial<ContactDraft>) => void;
}) {
  return (
    <div data-testid="contact-fields">
      <p className="text-sm text-silver">{CONTACT_REQUIRED_NOTE}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">
            Full name <span className="text-gold">(required)</span>
          </Label>
          <Input
            id="contact-name"
            name="name"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            autoComplete="name"
            maxLength={80}
            aria-required="true"
            aria-invalid={!!errors.name}
            className="h-11"
          />
          {errors.name ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.name}
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
            value={value.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            autoComplete="tel"
            placeholder="864-555-0134"
            maxLength={24}
            aria-required="true"
            aria-invalid={!!errors.phone}
            className="h-11"
          />
          {errors.phone ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.phone}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contact-address">
            Service address <span className="text-gold">(required)</span>
          </Label>
          <Textarea
            id="contact-address"
            name="address"
            value={value.address}
            onChange={(e) => onChange({ address: e.target.value })}
            autoComplete="street-address"
            maxLength={240}
            placeholder="123 Main St, Simpsonville SC 29681 — add apartment, gate code, or where the car sits"
            aria-required="true"
            aria-invalid={!!errors.address}
            className="min-h-20"
          />
          {errors.address ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.address}
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
            value={value.email}
            onChange={(e) => onChange({ email: e.target.value })}
            autoComplete="email"
            placeholder="Leave blank if you would rather not"
            maxLength={120}
            aria-invalid={!!errors.email}
            className="h-11"
          />
          {errors.email ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
