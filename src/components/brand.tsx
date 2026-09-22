import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-10", className)}
      aria-hidden="true"
    >
      <circle
        cx="24"
        cy="24"
        r="21.25"
        stroke="#C7CCD4"
        strokeWidth="1.15"
      />
      <path
        d="M9.8 29.2C12.4 16.8 24.2 9.4 36.4 13.6"
        stroke="#D4AF37"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M18 34.2V13.8"
        stroke="#E8C547"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M18 13.8H25.1C30.4 13.8 33.6 17.1 33.6 21.2C33.6 25.3 30.4 28.6 25.1 28.6H18"
        stroke="#D8DCE3"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 36.5H28"
        stroke="#D4AF37"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLockup({
  className,
  markClassName,
  wordmark = true,
}: {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandMark className={markClassName} />
      {wordmark ? (
        <span className="leading-none">
          <span className="font-heading block text-[1.15rem] font-semibold tracking-[0.22em] text-foreground">
            PRESTIGE
          </span>
          <span className="mt-1 block text-[0.62rem] font-medium tracking-[0.34em] text-silver uppercase">
            Car Wash
          </span>
        </span>
      ) : null}
    </span>
  );
}
