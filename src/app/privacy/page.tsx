import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy policy for ${site.name} — prestigecarwashsc.com.`,
};

/**
 * Prestige-only privacy policy. The Ask Jesus iOS app policy used to share this
 * page; the two were split on 2026-09-29 and the app policy now lives on the
 * McElreath Intelligence site. Do not add app sections back here.
 */
const sections: { title: string; body: string[] }[] = [
  {
    title: "Who operates this",
    body: [
      "Prestige Car Wash LLC (“Prestige,” “we,” “us”) is a South Carolina mobile detailing business. This policy covers prestigecarwashsc.com and the detailing work booked through it. It does not cover any other product or app.",
      "The public shop phone is 864-619-4911. Privacy questions and deletion requests go to mcelreath.intelligence@gmail.com — not a personal cell number.",
    ],
  },
  {
    title: "What this policy covers",
    body: [
      "Booking a window, the prepaid Square checkout, the customer-details form, optional account sign-in, the message form, and signed liability-waiver records for detailing jobs.",
      "Prestige is mobile only — there is no storefront — so a service address is part of almost every record described below.",
    ],
  },
  {
    title: "Information we collect on this website",
    body: [
      "Customer details for a booking. First and last name, callback phone number, and the service address: street, city, state, and ZIP code. Email address is optional. These are required because we drive to the vehicle.",
      "Optional account password. If you choose to create an account so you can see your past washes, we store a one-way hash of the password you pick — never the password itself. You can book without ever setting one.",
      "Vehicle and job notes. Vehicle description, package and add-ons selected, and anything you type into the message form.",
      "Signed waiver records. The typed full legal name you use as a signature, the date and time you signed, the waiver version, and a copy of the signed waiver PDF.",
      "Payment metadata. Square handles the card entry on its own screens. We keep what Square hands back — the order and payment identifiers, the amount, and whether the charge cleared — so a booking can be verified, refunded, or cancelled. We never see or store card numbers.",
      "Technical logs. Our host may log IP address, browser type, pages requested, and timestamps to operate the site and stop abuse.",
    ],
  },
  {
    title: "Website forms in detail",
    body: [
      "The booking details form collects first name, last name, callback phone, street address, city, state, and ZIP code as required fields. Email is optional. A password is optional and only used to create an account.",
      "The message form collects name, phone, service address, vehicle, and your message.",
      "The waiver form collects your typed full legal name as a signature, plus the timestamp, package, and window it was signed against.",
      "All of these are delivered to the shop by email and stored as business records for the job. Payment card numbers are entered on Square, not on this site.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "To schedule the appointment, drive to the right address, and call you back.",
      "To take prepaid payment through Square, and to issue refunds under the cancellation policy.",
      "To keep signed waiver records for the job and for insurance purposes.",
      "To let you sign in and see your own past washes, if you created an account.",
      "To answer messages, prevent spam or abuse, and keep the site working.",
    ],
  },
  {
    title: "We do not sell personal data",
    body: [
      "We do not sell, rent, or trade your personal information, and we do not use it to build an advertising profile.",
      "We share information only with the service providers that let the business run — Square for payments, Google Calendar for the appointment itself, our website host, and our form/email and text delivery providers — or if the law requires it.",
    ],
  },
  {
    title: "Third parties",
    body: [
      "Square — prepaid detailing checkout, receipts, and refunds.",
      "Google Calendar — the scheduled appointment window for a paid booking.",
      "Netlify and form/email delivery — hosting the website and sending shop notifications from the booking, message, and waiver forms.",
      "Text-message delivery — the confirmation text sent after a payment clears.",
      "Those companies process data under their own policies. We do not control how they secure their systems.",
    ],
  },
  {
    title: "Retention",
    body: [
      "Bookings, customer details, payment metadata, and signed waivers are kept as business records for the job and for legal and insurance needs, then deleted when they are no longer required.",
      "Account records, including the password hash, are kept until you ask us to delete the account.",
      "Server logs are kept only as long as needed to operate and debug the site, typically a short rolling window unless a specific incident requires longer review.",
    ],
  },
  {
    title: "Children’s privacy",
    body: [
      "prestigecarwashsc.com is not directed at children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child under 13 submitted a form, email us and we will delete what we control.",
    ],
  },
  {
    title: "Your privacy rights (United States / California)",
    body: [
      "Depending on where you live, you may have the right to ask what personal information we have, request a copy, correct it, or ask us to delete it, and to opt out of “sale” or “sharing” of personal information. We do not sell personal information and we do not share it for cross-context behavioral advertising.",
      "To use these rights, email the address below. We will need enough detail to find your records — usually the name and phone number on the booking. We will not discriminate against you for making a request.",
      "If we cannot verify a request, we will say so and explain what we need.",
    ],
  },
  {
    title: "How to contact us or request deletion",
    body: [
      "Privacy contact: mcelreath.intelligence@gmail.com. Use that address for access, correction, or deletion requests about this website.",
      "For a booking, payment, or refund question, call or text the shop at 864-619-4911, or use the message form on this site.",
    ],
  },
  {
    title: "Changes",
    body: [
      "If this policy changes in a material way, we will update this page and the effective date. Continued use of the site after an update means you accept the revised policy.",
    ],
  },
  {
    title: "Privacy email",
    body: [
      "Send privacy questions and deletion requests to mcelreath.intelligence@gmail.com. Effective date: September 29, 2026.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
      <h1 className="font-heading text-4xl sm:text-5xl">Privacy Policy</h1>
      <p className="mt-5 text-lg leading-relaxed text-silver">
        How Prestige Car Wash LLC handles information for {site.domain}.
        Effective September 29, 2026.
      </p>
      <div className="mt-8 rounded-xl border border-gold/30 bg-[#121216] p-5 sm:p-6">
        <p className="text-xs tracking-[0.24em] text-gold uppercase">
          Privacy contact
        </p>
        <p className="mt-3 text-sm leading-relaxed text-silver">
          Email{" "}
          <a
            href="mailto:mcelreath.intelligence@gmail.com"
            className="text-gold hover:text-foreground"
          >
            mcelreath.intelligence@gmail.com
          </a>{" "}
          for access, correction, or deletion requests. For a booking or payment
          question, call or text the shop at{" "}
          <a href={site.phoneTel} className="text-gold hover:text-foreground">
            {site.phone}
          </a>
          .
        </p>
      </div>
      <div className="mt-12 space-y-10">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-heading text-2xl">{section.title}</h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-silver sm:text-base">
              {section.body.map((p) => (
                <p key={p.slice(0, 48)}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
