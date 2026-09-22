export const site = {
  name: "Prestige Car Wash",
  domain: "prestigecarwashsc.com",
  url: "https://prestigecarwashsc.com",
  tagline: "Mobile detailing for Simpsonville and Greenville",
  description:
    "Prestige Car Wash is a mobile car detailing service for Simpsonville, Greenville, and about 20 miles around. Book a time, pay in full, and we come to you. Same-day is typical.",
  serviceArea: "Simpsonville, Greenville, and about 20 miles around",
  phone: "864-619-4911",
  phoneTel: "tel:+18646194911",
} as const;

export const navItems = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/book", label: "Book" },
  { href: "/pay", label: "Pay" },
] as const;

export function hostedOnNetlify() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "prestigecarwashsc.com" || host.endsWith(".netlify.app");
}

export const BOOKING_CALENDAR_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1upBXBWtg3UJKVlTGvvMK4t7mh-42uC4D-OmqYOl6KwFz3kRBuCCfpymCwIzFx30wgD58R8TmS?gv=true";

export const FORMSUBMIT_AJAX_HASH = "b8ebe506b85c52f6586dbded50efc0e8";
export const SQUARE_LINK_OPEN_AMOUNT_DEFAULT =
  "https://square.link/u/34YKS1SV";
