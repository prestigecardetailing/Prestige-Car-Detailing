import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Gallery",
  description: `Photo gallery for ${site.name}. Real job photos are coming soon.`,
};

const PLACEHOLDER_LABEL = "placeholder — real job photos coming soon";
const PLACEHOLDER_COUNT = 20;

/**
 * Every tile on this page is a placeholder and says so. Nothing here is a real
 * customer vehicle, and nothing here may be presented as one. Replacing a tile
 * means dropping in an actual job photo and removing its placeholder label.
 */
export default function GalleryPage() {
  const slots = Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => i + 1);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl">Gallery</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        Every tile below is a placeholder, not a customer vehicle. Real
        before-and-after photos from Prestige jobs go here as they are shot — we
        would rather show an empty frame than someone else&apos;s work.
      </p>
      <p
        className="mt-6 max-w-2xl rounded-xl border border-gold/40 bg-gold/8 px-4 py-3 text-sm leading-relaxed text-gold"
        role="note"
      >
        None of these {PLACEHOLDER_COUNT} images are real jobs. They are labeled
        placeholders so nothing on this page can be mistaken for finished work.
      </p>

      <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {slots.map((n) => (
          <li
            key={n}
            data-testid="gallery-placeholder"
            className="overflow-hidden rounded-xl bg-[#121216] ring-1 ring-white/10"
          >
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 border-b border-white/10 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_10px,transparent_10px,transparent_20px)] px-4 text-center">
              <ImageOff className="size-6 text-silver/60" aria-hidden />
              <span className="font-heading text-lg text-silver">
                Photo {String(n).padStart(2, "0")} of {PLACEHOLDER_COUNT}
              </span>
            </div>
            <p className="px-4 py-3 text-xs leading-relaxed text-gold">
              {PLACEHOLDER_LABEL}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/book"
          className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
        >
          See open windows
        </Link>
        <a
          href={site.phoneTel}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-12 px-6",
          )}
        >
          Call or text {site.phone}
        </a>
      </div>
    </div>
  );
}
