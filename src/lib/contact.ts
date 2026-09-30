/**
 * Caller info required before any booking is confirmed (Derek, 2026-09-29):
 * first name, last name, callback phone, and the full service address — street,
 * city, state, ZIP — are all hard-required. Email is asked for but optional, and
 * a password is optional (it only creates an account).
 *
 * Shared by the browser (so the customer is blocked before Square opens) and by
 * /api/checkout (so nothing can be booked around the form). Any future phone or
 * voice `book_slot` tool has to collect the same required fields and should call
 * `validateContact` before it creates a booking.
 */

export type ContactInput = {
  firstName?: string | null;
  lastName?: string | null;
  /** Legacy single-field name. Split into first/last when the parts are absent. */
  name?: string | null;
  phone?: string | null;
  /** Street line only — number, street, unit. City/state/ZIP are separate. */
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  email?: string | null;
  /** Optional: creates an account. Never stored in plain text anywhere. */
  password?: string | null;
};

export type ContactField =
  | "firstName"
  | "lastName"
  | "phone"
  | "address"
  | "city"
  | "state"
  | "zip"
  | "email"
  | "password";

export type ContactErrors = Partial<Record<ContactField, string>>;

export type ContactValue = {
  firstName: string;
  lastName: string;
  /** "First Last" — what Square, the calendar, and the shop emails show. */
  name: string;
  /** Digits only with the country code, e.g. "+18646194911". */
  phone: string;
  /** Pretty form for humans, e.g. "(864) 619-4911". */
  phoneDisplay: string;
  /** Street line where the vehicle will be. This is a mobile service. */
  address: string;
  city: string;
  /** Two-letter US state code, upper case. */
  state: string;
  zip: string;
  /** One line: "123 Main St, Simpsonville SC 29681". Used as the event location. */
  fullAddress: string;
  email: string;
  /** Present only when the customer chose to create an account. */
  password: string;
};

export type ContactResult =
  | { ok: true; value: ContactValue; errors: ContactErrors }
  | { ok: false; value: null; errors: ContactErrors };

export const CONTACT_REQUIRED_NOTE =
  "First name, last name, a callback phone, and the full service address — street, city, state, and ZIP — are required, because we come to you. Email is optional, and a password is only needed if you want an account.";

export const PASSWORD_MIN_LENGTH = 8;

const US_STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "PR", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

const STATE_NAMES: Record<string, string> = {
  "south carolina": "SC",
  "north carolina": "NC",
  georgia: "GA",
  tennessee: "TN",
};

function digits(raw: string) {
  return raw.replace(/\D+/g, "");
}

function tidy(raw: string | null | undefined, max: number) {
  return String(raw || "")
    .replace(/[\s\u00a0]+/g, " ")
    .trim()
    .slice(0, max);
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

/** Accepts "SC" or "South Carolina"; returns the two-letter code or "". */
export function normalizeState(raw: string | null | undefined) {
  const value = tidy(raw, 40);
  if (!value) return "";
  const upper = value.toUpperCase();
  if (US_STATES.has(upper)) return upper;
  const mapped = STATE_NAMES[value.toLowerCase()];
  return mapped || "";
}

/** "29681" or "29681-1234"; returns "" when it is not a US ZIP. */
export function normalizeZip(raw: string | null | undefined) {
  const value = tidy(raw, 12).replace(/\s/g, "");
  const match = /^(\d{5})(?:-?(\d{4}))?$/.exec(value);
  if (!match) return "";
  return match[2] ? `${match[1]}-${match[2]}` : match[1];
}

/** Legacy single-field names arrive from older sessions and the voice path. */
function splitName(raw: string | null | undefined) {
  const parts = tidy(raw, 160).split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function formatFullAddress(parts: {
  address: string;
  city: string;
  state: string;
  zip: string;
}) {
  const tail = [parts.state, parts.zip].filter(Boolean).join(" ");
  return [parts.address, parts.city, tail].filter(Boolean).join(", ");
}

export function validateContact(input: ContactInput): ContactResult {
  const errors: ContactErrors = {};
  const legacy = splitName(input.name);

  const firstName = tidy(input.firstName, 40) || legacy.firstName;
  if (firstName.length < 2) {
    errors.firstName = "Enter your first name.";
  }

  const lastName = tidy(input.lastName, 40) || legacy.lastName;
  if (lastName.length < 2) {
    errors.lastName = "Enter your last name.";
  }

  const phoneRaw = tidy(input.phone, 24);
  const phone = normalizePhone(phoneRaw);
  if (!phoneRaw) {
    errors.phone = "Enter a phone number we can call you back at.";
  } else if (!phone) {
    errors.phone = "Enter a 10-digit US phone number, like 864-619-4911.";
  }

  // Free-text on purpose (apartments, gate codes, job sites), but it has to look
  // like somewhere a van can actually go: a street number and a street name.
  const address = tidy(input.address, 160);
  if (!address) {
    errors.address = "Enter the street address where we will detail the vehicle.";
  } else if (address.length < 5 || !/\d/.test(address) || !/[a-z]{3}/i.test(address)) {
    errors.address = "Include the street number and street — like 123 Main St.";
  }

  const city = tidy(input.city, 60);
  if (!city) {
    errors.city = "Enter the city.";
  } else if (!/[a-z]{2}/i.test(city)) {
    errors.city = "Enter the city name.";
  }

  const stateRaw = tidy(input.state, 40);
  const state = normalizeState(stateRaw);
  if (!stateRaw) {
    errors.state = "Enter the state.";
  } else if (!state) {
    errors.state = "Use the two-letter state code, like SC.";
  }

  const zipRaw = tidy(input.zip, 12);
  const zip = normalizeZip(zipRaw);
  if (!zipRaw) {
    errors.zip = "Enter the ZIP code.";
  } else if (!zip) {
    errors.zip = "Enter a 5-digit ZIP code, like 29681.";
  }

  const email = tidy(input.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = "That email does not look right. Leave it blank to skip it.";
  }

  // Not trimmed: a password is whatever the customer typed.
  const password = String(input.password || "").slice(0, 200);
  if (password && password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters, or leave it blank to skip the account.`;
  }

  if (Object.keys(errors).length > 0 || !phone) {
    return { ok: false, value: null, errors };
  }
  return {
    ok: true,
    errors,
    value: {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      phone: phone.e164,
      phoneDisplay: phone.display,
      address,
      city,
      state,
      zip,
      fullAddress: formatFullAddress({ address, city, state, zip }),
      email,
      password,
    },
  };
}
