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
