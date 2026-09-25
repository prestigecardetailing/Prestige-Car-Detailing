# Prestige Car Wash

Next.js App Router site for [prestigecarwashsc.com](https://prestigecarwashsc.com) — mobile detailing in Simpsonville & Greenville, SC.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm start` — serve production build
- `npm run lint` — ESLint

## Booking is pay-first

A calendar window is **never** reserved by picking it. The order is:

1. **Pick a time** — `/book` lists the windows Prestige currently has open
   (4 hours each) from `GET /api/open-slots`.
2. **Enter details** — `/book/details?slot=<id>` collects the caller info.
   Name, phone, and the physical service address are required; email is
   optional. "Continue to payment" is blocked until the required fields are
   filled. Nothing is held on this screen either.
3. **Pay** — `/pay?slot=<id>` carries the details over, takes the package
   selection and the liability waiver, and hands off to Square.
   `POST /api/checkout` writes a **pending** booking record; pending records do
   not affect availability.
4. Square confirms the charge → `POST /api/bookings/confirm` (from `/pay/success`)
   or the Square webhook writes the **hold**, creates the Google Calendar event
   when credentials exist, texts the customer a confirmation, and emails the shop.

Abandoning Square, closing the tab, or a declined card leaves the window listed
on `/book` for the next customer.

### Caller info required before any booking confirm

Name, phone, and the **physical service address** are required before a customer
reaches Square; email is offered but **optional**. The `Your info` fieldset sits
at the top of `/pay`, and clicking Pay with any required field missing — or an
unparseable phone, or an address with no street number — shows field-level
errors and never opens the waiver or Square. The address is also what lands on
the Google Calendar event as the event location.

`src/lib/contact.ts` holds the one validator both sides use. `/api/checkout`
re-runs it and answers `400 { code: "contact-required", fields: {…} }`, so the
form is not the only guard. The normalized values land on the booking record,
pre-fill the Square checkout screen (`pre_populated_data`), and appear in the
waiver and owner emails.

**Phone/voice path:** when a `book_slot` tool is wired for the phone agent it
must collect the same three required fields and call `validateContact` before
creating a booking. The web flow enforces it today.

### Post-payment confirmation SMS

When a payment is confirmed the customer gets a text with their name, the window,
the service address, the package and amount paid, the reschedule and cancellation
rules, and `https://prestigecarwashsc.com`. Roughly 425 characters.

The rail is a **Systems-owned endpoint**, not Twilio directly — this app never
holds Twilio credentials and never spends Twilio balance:

| Variable | Effect |
| --- | --- |
| `PRESTIGE_SMS_API_URL` | HTTPS endpoint Systems exposes with Twilio behind it. Unset ⇒ the hook is a stub that logs the exact payload (phone masked) and sends nothing. |
| `PRESTIGE_SMS_API_SECRET` | Sent as `Authorization: Bearer …` to that endpoint. |
| `PRESTIGE_SMS_FROM` | Optional sender hint passed through. **Never 864-619-4911** — that line is voice only, and the code refuses to send if it is set to that number. |

Request Systems will receive:

```jsonc
POST $PRESTIGE_SMS_API_URL
Authorization: Bearer $PRESTIGE_SMS_API_SECRET
X-Prestige-Booking: <booking reference>
{
  "kind": "booking-confirmation",
  "to": "+18645550134",        // E.164, the phone captured at booking
  "from": "+18645550111",      // only when PRESTIGE_SMS_FROM is set
  "body": "<message text>",
  "bookingRef": "deb9b53674cd4109",
  "source": "prestigecarwashsc.com"
}
```

Any 2xx is treated as accepted; a `sid` in the reply is recorded on the booking.
A failed or stubbed text never blocks the payment, the hold, the calendar event,
or the owner email — the owner email says to text the customer by hand instead.

### Undo before payment

Nothing is held before payment, so undoing is just dropping the selection.
`/pay` shows **Change time** (back to the picker) and **Clear selection** next to
the chosen window. Clearing removes the `slot` query param and, if this visit had
already opened a Square checkout, calls `POST /api/bookings/cancel` to mark that
pending record cancelled and release any hold pointing at it. The window is
immediately bookable again.

### Reschedule after payment

A paid customer can move their own booking until **24 hours before the window
starts** (`rescheduleCutoffHours` in `src/data/availability.json`). Inside that,
the UI blocks the change and tells them to call 864-619-4911.

The booking reference shown on `/pay/success` (and in the shop's paid-booking
email) is the key: `/reschedule?ref=<reference>` looks the booking up, shows the
deadline, and lists the open windows. Moving holds the new window, releases the
old one, patches the Google Calendar event when one exists, and emails the shop.

- `GET /api/bookings/lookup?ref=…` — booking summary plus the reschedule policy and cancellation quote
- `POST /api/bookings/reschedule` `{ ref, slotId }` — 409 `code: "too-late"` inside the cutoff
- `POST /api/bookings/cancel` `{ ref }` — undo an unpaid selection, or quote/execute a paid cancellation

### Cancellation policy (Derek, 2026-09-24)

- **24 or more hours before the window starts:** full refund of everything paid.
- **Inside 24 hours:** a **$25** late-cancellation fee is retained and everything
  else is refunded.
- **After the window has started:** not a self-service cancellation — the page
  tells the customer to call 864-619-4911.

Both numbers are `cancelCutoffHours` and `lateCancelFeeCents` in
`src/data/availability.json`. The policy is stated on `/pay/success`, on
`/cancel` and `/reschedule`, in the site footer, and in the shop's paid-booking
and cancellation emails.

`POST /api/bookings/cancel` is deliberately two-step for paid bookings:

```
POST /api/bookings/cancel { "ref": "…" }
  → { "status": "quote", "quote": { policy, paidLabel, feeLabel, refundLabel, … } }
POST /api/bookings/cancel { "ref": "…", "confirm": true }
  → { "status": "cancelled", "booking": { … , "cancelled": { refundStatus, refundId, … } } }
```

Confirming refunds through the Square Refunds API (`POST /v2/refunds`) using the
same `SQUARE_ACCESS_TOKEN` the checkout uses plus the payment id recorded at
confirmation, releases the window back to `/book`, deletes the Google Calendar
event, and emails the shop. If Square cannot be called — no API token, or the
open-amount link that never gives us a payment id — the booking is still
cancelled and released, `refundStatus` is `skipped`, and the shop's email leads
with `ACTION REQUIRED — refund $X to this customer in Square by hand`.

The public Google Appointment Schedule iframe was removed on purpose: finishing a
Google booking holds the slot immediately, before payment. `BOOKING_CALENDAR_URL`
in `src/lib/site.ts` is kept as an admin-only reference.

### Changing open hours

Edit `src/data/availability.json` and deploy:

- `weekly` — recurring start times per weekday, local 24-hour (`"08:00"`)
- `extraDates` — one-off openings, `"2026-10-03": ["08:00"]`
- `blackoutDates` / `blackoutSlots` — days or single windows to pull down
- `slotMinutes` — appointment length (currently 240 = 4 hours)
- `leadTimeHours` — how far ahead of "now" the first bookable window can be
- `horizonDays` — how far out the list runs
- `rescheduleCutoffHours` — self-service reschedule closes this long before the
  window starts (24)
- `cancelCutoffHours` — full-refund boundary for cancellations (24)
- `lateCancelFeeCents` — retained on a late cancellation (2500 = $25)

To change hours without a deploy, set the `PRESTIGE_AVAILABILITY` env var to a
JSON object with the same keys; it is merged over the file.

### `GET /api/open-slots`

Positive list only — every window that is open and bookable right now, earliest
first. If it is not in the list, do not offer it. Used by the site slot picker
and, later, by the phone/voice agent.

```json
{
  "timeZone": "America/New_York",
  "slotMinutes": 240,
  "generatedAt": "2026-09-24T21:00:00.000Z",
  "count": 1,
  "slots": [
    {
      "id": "2026-10-03T0800",
      "start": "2026-10-03T12:00:00.000Z",
      "end": "2026-10-03T16:00:00.000Z",
      "date": "2026-10-03",
      "startTime": "08:00",
      "endTime": "12:00",
      "durationMinutes": 240,
      "label": "Fri, Oct 3 · 8:00 AM – 12:00 PM EDT",
      "bookUrl": "/pay?slot=2026-10-03T0800"
    }
  ]
}
```

## Environment variables

Nothing below is required for the site to build or for `/book` to work. Each one
upgrades a fallback.

| Variable | Effect when set |
| --- | --- |
| `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID` | Real Square payment links: the booking id rides as the order `reference_id`, comes back on the redirect, and the charge is verified server-side before any hold is written. Without these, checkout falls back to the open-amount `square.link` page and payments cannot be verified automatically. |
| `SQUARE_ENVIRONMENT` | `production` to hit `connect.squareup.com` (default is sandbox). Square only appends `checkoutId` / `orderId` / `transactionId` / `referenceId` to redirects on **production** links. |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Enables `POST /api/square/webhook` (subscribe to `payment.created` / `payment.updated`). Holds the slot even if the customer closes the tab before the success page loads. Requests are rejected when unset. |
| `SQUARE_WEBHOOK_URL` | Exact notification URL Square is configured with, if it differs from the request origin (used in the signature check). |
| `GOOGLE_CALENDAR_ID` | Calendar the paid hold is written to — the Prestige calendar address, or `primary` for the service account. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account address. Share the Prestige calendar with it and grant "Make changes to events". |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | That service account's PEM private key (`\n` escapes are fine). |
| `GOOGLE_IMPERSONATED_USER` | Optional Workspace domain-wide delegation subject. |
| `PRESTIGE_ADMIN_TOKEN` | Lets the shop confirm a hold by hand: `POST /api/bookings/confirm` with `{ "bookingId": "…", "adminToken": "…" }`. Used when a payment could not be verified automatically. |
| `PRESTIGE_AVAILABILITY` | JSON override for `src/data/availability.json`. |
| `PRESTIGE_NOTIFY_DISABLED` | `1` on preview/local runs so test payments do not email the shop. |
| `SQUARE_API_BASE_URL` | Test-only override for the Square API host, so a local stub can stand in for Square. Never set this in production. |
| `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` / `WEB3FORMS_ACCESS_KEY` | Preferred owner-notification channel; FormSubmit is the fallback. |

When the Google vars are absent the hold still happens on the site and the shop
gets an email with the full window details and a note to add the calendar event
by hand — no secrets are invented.

Pending bookings and holds are stored in Netlify Blobs (store `bookings`), with
`/tmp` and in-process copies as local-dev fallbacks — same pattern as the waiver
PDF store.

## Deploy

Netlify with `@netlify/plugin-nextjs` (see `netlify.toml`). Public phone:
**864-619-4911**.
