export const WAIVER_DISCLAIMER =
  "This is a Prestige Car Wash business form. It is not legal advice to you.";

export const WAIVER_TITLE =
  "Service Agreement and Liability Waiver — Prestige Car Wash (mobile detailing)";

export const WAIVER_SECTIONS = [
  {
    heading: "1. Authorization",
    body: "I authorize Prestige Car Wash and its owner/operators/helpers (“Provider”) to enter the service location I provide, and to wash, detail, vacuum, polish, wax/protect, and otherwise work on the vehicle(s) I identify.",
  },
  {
    heading: "2. Vehicle condition",
    body: "I represent that I own or am authorized to have this vehicle serviced. I will remove or secure valuables, firearms, cash, documents, electronics, and fragile items before service. Provider is not a bailee of personal property left in or on the vehicle.",
  },
  {
    heading: "3. Pre-existing damage",
    body: "Vehicles may have scratches, swirl marks, chips, cracks, dents, loose trim, failing clear coat, aftermarket wraps/films, cracked lenses, or other wear. Aggressive cleaning, polishing, or stain work can reveal or make pre-existing defects more visible. I accept that risk.",
  },
  {
    heading: "4. Release of liability",
    body: "TO THE FULLEST EXTENT ALLOWED BY SOUTH CAROLINA LAW, I RELEASE AND FOREVER DISCHARGE PROVIDER FROM ALL CLAIMS, DEMANDS, AND DAMAGES ARISING FROM OR RELATED TO THE SERVICES, INCLUDING BUT NOT LIMITED TO: scratches; swirl marks; paint, glass, chrome, plastic, rubber, or trim damage; water intrusion; electrical issues; interior stains that do not fully come out; fabric/leather/vinyl wear; odors; missing, damaged, or stolen items from the vehicle or premises; tire/wheel issues; and any consequential, incidental, or emotional damages. THIS RELEASE COVERS NEGLIGENCE TO THE EXTENT PERMITTED BY LAW (but not intentional misconduct or gross negligence where such waiver is unenforceable).",
  },
  {
    heading: "5. Assumption of risk",
    body: "I understand detailing involves water, chemicals, brushes, extractors, polishers, and ladders/steps around vehicles and driveways, and I assume those risks for myself and anyone present.",
  },
  {
    heading: "6. Results not guaranteed",
    body: "Results vary with vehicle age, prior care, paint hardness, fabric type, and soil level. “Excessively soiled,” pet hair, biohazards, or large vehicles may require extra time/fees or may be declined.",
  },
  {
    heading: "7. Payment",
    body: "Prepaid amounts are for the selected package/add-ons unless we agree otherwise. Quotes may change after inspection.",
  },
  {
    heading: "8. Photos",
    body: "Provider may take before/after photos for quality and marketing unless I object in writing before service.",
  },
  {
    heading: "9. Indemnity",
    body: "I will indemnify Provider against claims by third parties arising from my vehicle, my premises, or my breach of this agreement.",
  },
  {
    heading: "10. Governing law",
    body: "South Carolina law. If any clause is unenforceable, the rest remains in effect.",
  },
] as const;

export const WAIVER_CLOSING =
  "I HAVE READ THIS WAIVER, UNDERSTAND IT, AND AGREE VOLUNTARILY.";

export const WAIVER_VERSION = "2026-09-10";

export function buildWaiverText() {
  return [
    WAIVER_TITLE,
    "",
    WAIVER_DISCLAIMER,
    "",
    "By booking and/or paying for services, I (the “Customer”) agree as follows:",
    "",
    ...WAIVER_SECTIONS.flatMap((s) => [s.heading, s.body, ""]),
    WAIVER_CLOSING,
  ].join("\n");
}
