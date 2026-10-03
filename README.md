# Prestige Car Wash

Next.js App Router site for [prestigecarwashsc.com](https://prestigecarwashsc.com) — mobile detailing in Simpsonville & Greenville, SC.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm start` — serve production build
- `npm run lint` — ESLint

## Booking is pay-first

A calendar window is **never** reserved by picking it. The destination order
(Derek, 2026-09-30) is **car wash type → time slot → customer information →
waiver → pay**:

1. **Car wash type** — `/book/service` takes the package and any add-ons. Every
   package and price on the site links here, so a price click never lands on the
   customer-information screen.
2. **Time slot** — `/book` shows the windows Emery has opened, from
   `GET /api/open-slots`.

   Steps 1 and 2 are interchangeable: a customer can start from a price or from
   the calendar, finishes that step, and is sent to the other one. The selection
   rides on the query string (`?package=&addons=&slot=`).
3. **Customer information** — `/book/details?package=<id>&slot=<id>` collects the
   caller info, and **only opens once both** the car wash type and the time slot
   are chosen; until then it shows what is still missing and links back. First
   name, last name, callback phone, and the full service address (street, city,
   state, ZIP) are required; email is optional, and so is a password for an
   account. Nothing is held on this screen either.
4. **Waiver** — clicking Pay on `/pay?package=<id>&slot=<id>` opens the liability
   waiver. It is a hard modal: agree and sign, or cancel the payment.
5. **Pay** — signing hands off to Square. `POST /api/checkout` writes a
   **pending** booking record; pending records do not affect availability.
6. Square confirms the charge → `POST /api/bookings/confirm` (from `/pay/success`)
   or the Square webhook writes the **hold**, creates the Google Calendar event
   when credentials exist, texts the customer a confirmation, texts Emery and
   Derek, posts the record to the hub, and emails the shop.

Abandoning Square, closing the tab, or a declined card leaves the window listed
on `/book` for the next customer.

### Other fees and services

Separate from the packages and from any booking: the **"Other fees and services
not included separate from above."** button at the bottom of `/`, `/services`, and
`/pay` opens a small form — what the charge is for, and an amount. It posts to
`POST /api/other-fee`, which creates a **standalone** Square payment link for that
exact amount (no booking record, no slot hold, no waiver), and falls back to the
open-amount `square.link` page when the Square API is not configured. Emery uses
it on site: type "exterior wash", type the amount, charge it.

## Pages

| Route | What it is |
| --- | --- |
| `/` | Home — packages, how it works, testimonials |
| `/services` | Packages, add-ons, and what to know before booking |
| `/gallery` | 20 labeled placeholders. Nothing on it is a real job yet. |
| `/about` | Who Emery is and what the business is built for |
| `/book/service` | Car wash type step — package and add-ons, no prices jumping to checkout |
| `/book` | Time slot step — only the windows Emery opened are selectable |
| `/book/details` | Customer information, unlocked once the wash and the time are both chosen |
| `/pay` | Waiver + Square payment, the last screen of the flow |
| `/pay/success` | Confirms the Square charge and writes the hold |
| `/reschedule`, `/cancel` | Self-service booking changes |
| `/account` | Optional account: sign in, see past washes |
| `/contact` | The message form. Labeled **"Message the shop"** everywhere it is linked; the URL stays `/contact`. Shows `site.email` next to the shop phone. |
| `/privacy` | Prestige-only privacy policy |

### Caller info required before any booking confirm

Required before a customer reaches Square (Derek, 2026-09-29):

- **First name** and **last name**
- **Callback phone**
- **Street address**, **city**, **state**, **ZIP** — the whole thing, because
  this is a mobile service and the van has to get there

Optional: **email**, and a **password** (which only creates an account — see
below). The `Your info` fieldset sits at the top of `/pay`, and clicking Pay with
any required field missing — or an unparseable phone, a street line with no
number, a state that is not a US code, a ZIP that is not five digits — shows
field-level errors and never opens the waiver or Square. The four address parts
are joined into one line (`123 Main St, Simpsonville, SC 29681`) for the Google
Calendar event location, the Square payment note, and the owner emails.

`src/lib/contact.ts` holds the one validator both sides use. `/api/checkout`
re-runs it and answers `400 { code: "contact-required", fields: {…} }`, so the
form is not the only guard. The normalized values land on the booking record,
pre-fill the Square checkout screen (`pre_populated_data`), and appear in the
waiver and owner emails.

**Phone/voice path:** when a `book_slot` tool is wired for the phone agent it
must collect the same required fields and call `validateContact` before creating a
booking. A legacy single `name` is split into first/last for compatibility, but
city, state, and ZIP have no fallback — they are required. The web flow enforces
all of it today.

### Optional customer accounts

An account is never required to book. The details step (`/book/details`) has one
optional password field: type one and `POST /api/account/register` creates the
account, signs the browser in with an httpOnly cookie, and the password is
dropped — it is never written to session storage and never travels to `/pay`.

- **Account** button in the site header → `/account`
- `GET /api/account` — the signed-in customer plus their past washes. Only reads
  bookings already linked to that account, so no customer can see another's.
- `POST /api/account/login` `{ phone, password }` — phone number is the login
  handle. Unknown phone and wrong password give the same 401, so the endpoint
  cannot be used to probe for accounts.
- `POST /api/account/logout`

Passwords are stored as scrypt hashes with a per-account random salt
(`src/lib/accounts.ts`). Plain text is never stored, logged, or sent to the hub.
Records live in the same layered store as bookings (Netlify Blobs, then `/tmp`,
then process memory) under `account/…`, with `account-phone/…` mapping a
normalized phone to an account id.

Sessions are signed with `PRESTIGE_ACCOUNT_SECRET`. When it is unset the process
signs with a random per-boot key: sessions still work but do not survive a
redeploy, which is the right failure mode — never a predictable key.

### Booking notifications (Derek, item 13)

When a payment is confirmed, four things happen and none of them can block the
hold, the calendar event, or each other:

1. **Owner email** to **mcelreath.intelligence@gmail.com** — the full booking
   summary, the payment metadata, and the status of everything below. Delivery
   rides the existing `notifyOwnerFromServer` path, so the inbox is whatever the
   `WEB3FORMS_ACCESS_KEY` (or the FormSubmit hash) is registered to. **That key
   has to point at mcelreath.intelligence@gmail.com** — the address is not a
   request parameter on either provider. This is the delivery inbox, not the
   address customers are given: the public one is `site.email`,
   **mcelreath@prestigecarwashsc.com**, a Namecheap forward into this same
   inbox. Changing what the site shows never moves delivery, and the provider
   key must not be repointed at the forwarding address.
2. **SMS to Emery** and **SMS to Derek** at their private mobile numbers.
3. **Customer confirmation SMS** with the window, address, package, amount, and
   the cancellation terms (see below).
4. **Hub ingest** of the whole record — booking, customer, account id, payment
   metadata, signed waiver.

The owner numbers live in `src/lib/owner-notify.ts`. **That module is server-side
only.** It is imported from route handlers and server helpers, never from a
`"use client"` component, because importing it into client code would ship the
private numbers in the browser bundle. `PRESTIGE_OWNER_SMS_TO` (comma-separated)
overrides them without touching code. The only phone number any public page shows
is `site.phone`, 864-619-4911.

### Hub ingest

`src/lib/hub-ingest.ts` is the one client for the mcelreath.intelligence hub.
There was no prior hub pattern in this repo, so everything goes through it:

```jsonc
POST $PRESTIGE_HUB_INGEST_URL
Authorization: Bearer $PRESTIGE_HUB_INGEST_SECRET
X-Prestige-Kind: booking            // booking | account | waiver | payment
X-Prestige-Reference: <booking ref>
{
  "kind": "booking",
  "reference": "deb9b53674cd4109",
  "source": "prestigecarwashsc.com",
  "at": "2026-09-29T18:00:00.000Z",
  "data": { /* booking, customer, accountId, payment metadata, waiver */ }
}
```

With either variable missing it logs `[hub:skipped]` and sends nothing. It never
throws. No card data (Square never hands us any) and no passwords go over this
wire — only the fact that an account has one.

### Square receipt email (Derek, item 14)

**Already Square's default.** The Payment Links / Online Checkout flow emails the
buyer a receipt itself; there is no API flag on `checkout_options` to turn it on,
and nothing in `src/lib/square.ts` suppresses it. Two things have to stay true:

1. `pre_populated_data.buyer_email` is sent whenever we captured an email, so the
   buyer does not have to retype it on the Square screen.
2. Square Dashboard → Settings → **Customer receipts** stays enabled on the
   Prestige location.

The site's own confirmation text is still sent separately, because Square's
receipt cannot carry the window, the service address, or the cancellation terms.

### Post-payment confirmation SMS

When a payment is confirmed the customer gets a text with their name, the window
(date and time), the service address, the package and amount paid, the reschedule
rule, the **flat $35 inside 24 hours** cancellation rule, and
`https://prestigecarwashsc.com`. Roughly 425 characters. This is the item-15
confirmation; Square's receipt email (above) is the emailed half.

Square's own receipt SMS is **not** a substitute: it cannot carry the window, the
service address, or the cancellation terms this message is required to state.

There are two rails, chosen in this order, and a safe no-op when neither is set.

**1. Twilio direct** (what Systems is provisioning). Posts to
`/2010-04-01/Accounts/{sid}/Messages.json` when all of these exist:

| Variable | Notes |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Account the message is billed to. |
| `TWILIO_AUTH_TOKEN` | Or `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET`, which win when both are present. |
| `TWILIO_FROM_NUMBER` | Or `TWILIO_MESSAGING_SERVICE_SID`. **Never 864-619-4911** — that line is voice only and the code refuses to send when it is the configured sender. |
| `TWILIO_API_BASE_URL` | Test-only host override so the request shape can be proven without spending. Never set in production. |

As of 2026-09-25 this path is dormant: Systems reports `IncomingPhoneNumbers=0`,
and the number cannot be bought until Trust Hub Primary compliance KYC clears.

**2. Systems-owned proxy**, if Prestige would rather keep Twilio credentials off
the site entirely. Set `PRESTIGE_SMS_API_URL` (plus `PRESTIGE_SMS_API_SECRET`, and
optionally `PRESTIGE_SMS_FROM`) and it takes precedence over the direct path:

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

**3. Neither configured:** the hook builds the payload, logs it with the phone
masked, records it on the booking, and sends nothing. It never throws.

Any 2xx is treated as accepted and the message `sid` is recorded on the booking. A
failed, blocked, or skipped text never blocks the payment, the hold, the calendar
event, or the owner email — the owner email then says to text by hand.

`GET /api/sms-status` reports which rail a deploy would use and which variables
are present (never their values), so the wiring can be checked without sending.

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

### Cancellation policy (Derek, 2026-09-29)

- **24 or more hours before the window starts:** full refund of everything paid.
- **Inside 24 hours:** a **flat $35** cancellation fee is retained and everything
  else is refunded.
- **On site:** the same **flat $35** applies once we have arrived, whether the
  customer calls off the whole job or only the interior portion. This replaces the
  old $25 late fee and the old 25%-of-quote on-site fee, so there is one number
  everywhere.
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

### Availability is owner-set, never generated

**HARD RULE (Derek, 2026-09-30):** a window is bookable only when Emery has put it
on his availability for that **exact date**. There is no standing weekday pattern
anywhere in the code, and no fallback to "shop hours" — `/book` draws every day in
the horizon and grays out every day and time that is not open, so an unavailable
time is visibly unbookable instead of quietly missing. If the availability source
cannot be read, nothing is offered.

Order of truth:

1. **Emery's Google Calendar** — the availability middleman (Square is payments
   only). When `GOOGLE_AVAILABILITY_CALENDAR_ID` (or `GOOGLE_CALENDAR_ID`) plus the
   service-account vars are set, `/book` syncs automatically: Emery adds an event
   titled **Open** on a window (a 2:30 PM event opens the 2:30 PM window) or on a
   whole day (which opens `dayOpenTimes`), and the site offers exactly that with no
   re-entry on the site. Any other event on that calendar counts as busy and pulls
   the overlapping window down. A failed read opens nothing.
2. **`src/data/availability.json`** — the same owner-set dates, kept as the mirror
   for deploys without calendar credentials, and overridable at runtime with
   `PRESTIGE_AVAILABILITY`.

Current set (2026-09-30, until Emery changes it): **Thu Oct 1, Mon Oct 5, and Tue
Oct 6, 2026 — the 2:30 PM window only.** That is a fixed list of dates, not a
Mon/Tue/Thu rule and not a rotating weekly schedule.

### Changing open hours

Emery's normal path is Google Calendar. Without calendar credentials, edit
`src/data/availability.json` and deploy:

- `openDates` — the open dates and their window start times,
  `"2026-10-01": ["14:30"]`. This is where availability normally lives.
- `weekly` — optional recurring start times per weekday. **Ships empty**; nothing
  is open because of the day of the week.
- `displayTimes` — window times the `/book` grid draws for every day so closed
  times show as grayed-out cells. Display only: a time here is never bookable
  unless that exact date opens it.
- `dayOpenTimes` — the window(s) an all-day "Open" calendar event opens
- `gridDays` — how many days the grid always draws (open days beyond it still show)
- `blackoutDates` / `blackoutSlots` — days or single windows to pull down
- `slotMinutes` — appointment length (currently 240 = 4 hours)
- `leadTimeHours` — how far ahead of "now" the first bookable window can be
- `horizonDays` — how far out the list runs
- `rescheduleCutoffHours` — self-service reschedule closes this long before the
  window starts (24)
- `cancelCutoffHours` — full-refund boundary for cancellations (24)
- `lateCancelFeeCents` — retained on a late cancellation (3500 = $35)

To change hours without a deploy, set the `PRESTIGE_AVAILABILITY` env var to a
JSON object with the same keys; it is merged over the file.

### `GET /api/open-slots`

`slots` is a positive list — every window that is open and bookable right now,
earliest first. If it is not in the list, do not offer it. `days` is the same
answer as the drawable grid `/book` renders, one entry per day with each cell
tagged `open`, `booked`, or `closed`; anything not `open` is grayed out and
unbookable. `source` is `google-calendar`, `config`, or
`google-calendar-unreachable` (in which case nothing is offered). Used by the site
slot picker and, later, by the phone/voice agent.

```json
{
  "timeZone": "America/New_York",
  "slotMinutes": 240,
  "generatedAt": "2026-09-30T21:00:00.000Z",
  "source": "config",
  "count": 1,
  "slots": [
    {
      "id": "2026-10-01T1430",
      "start": "2026-10-01T18:30:00.000Z",
      "end": "2026-10-01T22:30:00.000Z",
      "date": "2026-10-01",
      "startTime": "14:30",
      "endTime": "18:30",
      "durationMinutes": 240,
      "label": "Thu, Oct 1 · 2:30 PM – 6:30 PM EDT",
      "bookUrl": "/book/details?slot=2026-10-01T1430"
    }
  ],
  "days": [
    {
      "date": "2026-10-01",
      "dayLabel": "Thursday, October 1",
      "openCount": 1,
      "cells": [
        { "id": "2026-10-01T0900", "startTime": "09:00", "timeLabel": "9:00 AM – 1:00 PM", "status": "closed", "slot": null },
        { "id": "2026-10-01T1430", "startTime": "14:30", "timeLabel": "2:30 PM – 6:30 PM", "status": "open", "slot": { "...": "as above" } }
      ]
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
| `GOOGLE_AVAILABILITY_CALENDAR_ID` | Calendar Emery marks open days on, if it is not `GOOGLE_CALENDAR_ID`. With the service-account vars set, `/book` syncs bookable windows from it automatically. |
| `GOOGLE_AVAILABILITY_KEYWORDS` | Comma-separated event-title markers that mean "open for bookings". Default `open,available,availability`. |
| `GOOGLE_IMPERSONATED_USER` | Optional Workspace domain-wide delegation subject. |
| `PRESTIGE_ADMIN_TOKEN` | Lets the shop confirm a hold by hand: `POST /api/bookings/confirm` with `{ "bookingId": "…", "adminToken": "…" }`. Used when a payment could not be verified automatically. |
| `PRESTIGE_AVAILABILITY` | JSON override for `src/data/availability.json`. |
| `PRESTIGE_NOTIFY_DISABLED` | `1` on preview/local runs so test payments do not email the shop. |
| `SQUARE_API_BASE_URL` | Test-only override for the Square API host, so a local stub can stand in for Square. Never set this in production. |
| `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` / `WEB3FORMS_ACCESS_KEY` | Preferred owner-notification channel; FormSubmit is the fallback. The key must be registered to **mcelreath.intelligence@gmail.com** — neither provider takes the recipient as a request parameter. |
| `PRESTIGE_HUB_INGEST_URL`, `PRESTIGE_HUB_INGEST_SECRET` | Posts bookings, accounts, payment metadata, and signed waivers to the mcelreath.intelligence hub. Both required; a logged no-op otherwise. |
| `PRESTIGE_ACCOUNT_SECRET` | Signing key for the optional customer-account session cookie. Unset means a random per-boot key: sessions work but do not survive a redeploy. |
| `PRESTIGE_OWNER_SMS_TO` | Comma-separated override for the owner SMS destinations. Defaults to Emery and Derek's numbers in `src/lib/owner-notify.ts` (server-side only, never public). |

When the Google vars are absent the hold still happens on the site and the shop
gets an email with the full window details and a note to add the calendar event
by hand — no secrets are invented.

Pending bookings and holds are stored in Netlify Blobs (store `bookings`), with
`/tmp` and in-process copies as local-dev fallbacks — same pattern as the waiver
PDF store.

## Deploy

Netlify with `@netlify/plugin-nextjs` (see `netlify.toml`). Public phone:
**864-619-4911**.
