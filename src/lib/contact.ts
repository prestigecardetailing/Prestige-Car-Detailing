/**
 * Caller info required before any booking is confirmed (Derek, 2026-09-24,
 * amended): name, phone, AND the physical service address are required; email is
 * asked for but optional.
 *
 * Shared by the browser (so the customer is blocked before Square opens) and by
 * /api/checkout (so nothing can be booked around the form). Any future phone or
 * voice `book_slot` tool has to collect the same three required fields and
 * should call `validateContact` before it creates a booking.
 */

export type ContactInput = {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
};

export type ContactField = "name" | "phone" | "address" | "email";

export type ContactErrors = Partial<Record<ContactField, string>>;

export type ContactValue = {
  name: string;
  /** Digits only with the country code, e.g. "+18646194911". */
  phone: string;
  /** Pretty form for humans, e.g. "(864) 619-4911". */
  phoneDisplay: string;
  /** Where the vehicle will be — this is a mobile service, so it is required. */
  address: string;
  email: string;
};

export type ContactResult =
  | { ok: true; value: ContactValue; errors: ContactErrors }
  | { ok: false; value: null; errors: ContactErrors };

export const CONTACT_REQUIRED_NOTE =
  "Name, phone, and the address where the vehicle will be are required — we come to you. Email is optional.";

function digits(raw: string) {
  return raw.replace(/\D+/g, "");
}

/** US/CA numbers: 10 digits, or 11 starting with 1. Anything else is rejected. */
export function normalizePhone(raw: string | null | undefined) {
  const only = digits(String(raw || ""));
  const ten =
    only.length === 10 ? only : only.length === 11 && only.startsWith("1") ? only.slice(1) : "";
  if (!ten || ten.startsWith("0") || ten.startsWith("1")) return null;
  return {
    e164: `+1${ten}`,
    display: `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`,
  };
}

export function validateContact(input: ContactInput): ContactResult {
  const errors: ContactErrors = {};

  const name = String(input.name || "").trim().slice(0, 80);
  if (name.length < 2) {
    errors.name = "Enter the name the booking is under.";
  }

  const phoneRaw = String(input.phone || "").trim();
  const phone = normalizePhone(phoneRaw);
  if (!phoneRaw) {
    errors.phone = "Enter a phone number we can reach you at.";
  } else if (!phone) {
    errors.phone = "Enter a 10-digit US phone number, like 864-619-4911.";
  }

  // Free-text on purpose (apartments, gate codes, job sites), but it has to look
  // like somewhere a van can actually go: a street number and a street name.
  const address = String(input.address || "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, 240);
  if (!address) {
    errors.address = "Enter the address where we will detail the vehicle.";
  } else if (address.length < 8 || !/\d/.test(address) || !/[a-z]{3}/i.test(address)) {
    errors.address =
      "Include the street number, street, and city — like 123 Main St, Simpsonville SC.";
  }

  const email = String(input.email || "").trim().slice(0, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = "That email does not look right. Leave it blank to skip it.";
  }

  if (Object.keys(errors).length > 0 || !phone) {
    return { ok: false, value: null, errors };
  }
  return {
    ok: true,
    errors,
    value: {
      name,
      phone: phone.e164,
      phoneDisplay: phone.display,
      address,
      email,
    },
  };
}
