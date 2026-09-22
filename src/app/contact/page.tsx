import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Message",
  description: `Contact ${site.name} to request a visit or reschedule.`,
};

export default function ContactPage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:py-20">
      <div>
        <h1 className="font-heading text-4xl sm:text-5xl">
          Request a visit, or send a note.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-silver">
          The shop gets this form by email. Use it to request a visit, ask about
          a vehicle or location, or reschedule a prepaid booking. You can also
          call{" "}
          <a href={site.phoneTel} className="text-gold hover:text-foreground">
            {site.phone}
          </a>
          .
        </p>
        <h2 className="font-heading mt-10 text-2xl">What to include</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-silver">
          <li>Your full name and a phone we can call back.</li>
          <li>Service address — street, city, or neighborhood is enough.</li>
          <li>
            Vehicle year, make, and model (for example, 2019 Honda CR-V).
          </li>
          <li>
            If you are moving a booking, the original date and time you
            reserved.
          </li>
        </ul>
        <p className="mt-6 text-sm text-silver">
          Prefer to talk? Call{" "}
          <a href={site.phoneTel} className="text-gold hover:text-foreground">
            {site.phone}
          </a>
          .
        </p>
      </div>
      <div className="rounded-xl bg-[#121216] p-6 ring-1 ring-white/10 sm:p-8">
        <ContactForm />
      </div>
    </div>
  );
}
