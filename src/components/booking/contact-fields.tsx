"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContactDraft } from "@/lib/booking-session";
import {
  CONTACT_REQUIRED_NOTE,
  PASSWORD_MIN_LENGTH,
  type ContactErrors,
} from "@/lib/contact";

/**
 * The caller-info form. First name, last name, callback phone, street address,
 * city, state, and ZIP are required; email is optional. Used by the contact step
 * (/book/details) and again on /pay, so the two can never drift apart.
 *
 * The optional account password is rendered separately (see `password` props) so
 * /pay can leave it out entirely — an account is created once, on the details
 * step, not on every screen.
 */
export function ContactFields({
  value,
  errors,
  onChange,
  password,
}: {
  value: ContactDraft;
  errors: ContactErrors;
  onChange: (patch: Partial<ContactDraft>) => void;
  password?: {
    value: string;
    onChange: (next: string) => void;
  };
}) {
  const required = <span className="text-gold">(required)</span>;

  return (
    <div data-testid="contact-fields">
      <p className="text-sm leading-relaxed text-silver">
        {CONTACT_REQUIRED_NOTE}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-first-name">First name {required}</Label>
          <Input
            id="contact-first-name"
            name="firstName"
            value={value.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            autoComplete="given-name"
            maxLength={40}
            aria-required="true"
            aria-invalid={!!errors.firstName}
            className="h-11"
          />
          {errors.firstName ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.firstName}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-last-name">Last name {required}</Label>
          <Input
            id="contact-last-name"
            name="lastName"
            value={value.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            autoComplete="family-name"
            maxLength={40}
            aria-required="true"
            aria-invalid={!!errors.lastName}
            className="h-11"
          />
          {errors.lastName ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.lastName}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contact-phone">Callback phone {required}</Label>
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
          <Label htmlFor="contact-address">Street address {required}</Label>
          <Input
            id="contact-address"
            name="address"
            value={value.address}
            onChange={(e) => onChange({ address: e.target.value })}
            autoComplete="address-line1"
            maxLength={160}
            placeholder="123 Main St, Apt 4 — add the gate code or where the car sits"
            aria-required="true"
            aria-invalid={!!errors.address}
            className="h-11"
          />
          {errors.address ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.address}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contact-city">City {required}</Label>
          <Input
            id="contact-city"
            name="city"
            value={value.city}
            onChange={(e) => onChange({ city: e.target.value })}
            autoComplete="address-level2"
            maxLength={60}
            placeholder="Simpsonville"
            aria-required="true"
            aria-invalid={!!errors.city}
            className="h-11"
          />
          {errors.city ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.city}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-state">State {required}</Label>
          <Input
            id="contact-state"
            name="state"
            value={value.state}
            onChange={(e) => onChange({ state: e.target.value })}
            autoComplete="address-level1"
            maxLength={20}
            placeholder="SC"
            aria-required="true"
            aria-invalid={!!errors.state}
            className="h-11"
          />
          {errors.state ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.state}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-zip">ZIP code {required}</Label>
          <Input
            id="contact-zip"
            name="zip"
            inputMode="numeric"
            value={value.zip}
            onChange={(e) => onChange({ zip: e.target.value })}
            autoComplete="postal-code"
            maxLength={10}
            placeholder="29681"
            aria-required="true"
            aria-invalid={!!errors.zip}
            className="h-11"
          />
          {errors.zip ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.zip}
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

        {password ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="contact-password">
              Password <span className="text-silver/70">(optional)</span>
            </Label>
            <p className="text-xs leading-relaxed text-silver/80">
              Only if you want an account to look up your past washes later. At
              least {PASSWORD_MIN_LENGTH} characters. Leave it blank and you can
              still book — nothing else changes.
            </p>
            <Input
              id="contact-password"
              name="password"
              type="password"
              value={password.value}
              onChange={(e) => password.onChange(e.target.value)}
              autoComplete="new-password"
              maxLength={200}
              aria-invalid={!!errors.password}
              className="h-11"
            />
            {errors.password ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.password}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
