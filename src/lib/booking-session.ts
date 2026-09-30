/**
 * Last-resort carrier for the pending booking id across the Square round trip.
 * Square only appends its own params (checkoutId / orderId / transactionId /
 * referenceId) to production payment-link redirects, and the open-amount link
 * appends nothing, so the browser keeps a copy too.
 */
export const BOOKING_SESSION_KEY = "pcw:pending-booking";

export type PendingBookingSession = {
  bookingId: string;
  slotId: string;
  at: number;
};

export function rememberPendingBooking(bookingId: string, slotId: string) {
  try {
    window.sessionStorage.setItem(
      BOOKING_SESSION_KEY,
      JSON.stringify({ bookingId, slotId, at: Date.now() }),
    );
  } catch {
    /* private mode — the redirect params and referenceId still carry the id */
  }
}

export function readPendingBooking(): PendingBookingSession | null {
  try {
    const raw = window.sessionStorage.getItem(BOOKING_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingBookingSession>;
    if (!parsed.bookingId) return null;
    return {
      bookingId: parsed.bookingId,
      slotId: parsed.slotId || "",
      at: parsed.at || 0,
    };
  } catch {
    return null;
  }
}

export function clearPendingBooking() {
  try {
    window.sessionStorage.removeItem(BOOKING_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Caller info collected on the contact step (/book/details) and carried to /pay.
 * Session storage rather than query params: this is the customer's name, phone,
 * and home address, and it has no business sitting in a URL or a referrer header.
 * /api/checkout re-validates it server-side regardless.
 *
 * The optional account password is deliberately NOT part of this draft. The
 * details step posts it straight to /api/account/register and forgets it, so a
 * password never sits in session storage.
 */
export const CONTACT_SESSION_KEY = "pcw:contact";

export type ContactDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  email: string;
};

export const emptyContactDraft: ContactDraft = {
  firstName: "",
  lastName: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  email: "",
};

export function saveContactDraft(draft: ContactDraft) {
  try {
    window.sessionStorage.setItem(CONTACT_SESSION_KEY, JSON.stringify(draft));
  } catch {
    /* private mode — /pay simply asks for the details again */
  }
}

export function readContactDraft(): ContactDraft | null {
  try {
    const raw = window.sessionStorage.getItem(CONTACT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ContactDraft> & { name?: string };
    if (!parsed || typeof parsed !== "object") return null;
    // Drafts saved before the form was split still have a single `name`.
    const legacy = String(parsed.name || "").trim().split(/\s+/).filter(Boolean);
    return {
      firstName: String(parsed.firstName || legacy[0] || ""),
      lastName: String(parsed.lastName || legacy.slice(1).join(" ") || ""),
      phone: String(parsed.phone || ""),
      address: String(parsed.address || ""),
      city: String(parsed.city || ""),
      state: String(parsed.state || ""),
      zip: String(parsed.zip || ""),
      email: String(parsed.email || ""),
    };
  } catch {
    return null;
  }
}

export function clearContactDraft() {
  try {
    window.sessionStorage.removeItem(CONTACT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
