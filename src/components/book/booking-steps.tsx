import { BOOKING_STEPS, type BookingStepKey } from "@/lib/booking-flow";
import { cn } from "@/lib/cn";

/**
 * The fixed destination order: car wash type → time slot → customer information
 * → waiver → pay. The first two can be done in either order, so `done` is passed
 * explicitly rather than inferred from the current step.
 */
export function BookingSteps({
  current,
  done = [],
}: {
  current: BookingStepKey;
  done?: BookingStepKey[];
}) {
  return (
    <ol
      className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs tracking-[0.18em] uppercase"
      data-testid="booking-steps"
    >
      {BOOKING_STEPS.map((step, index) => {
        const isCurrent = step.key === current;
        const isDone = done.includes(step.key);
        return (
          <li key={step.key} className="flex items-center gap-2">
            {index > 0 ? <span className="text-white/20">·</span> : null}
            <span
              data-step={step.key}
              data-state={isCurrent ? "current" : isDone ? "done" : "todo"}
              className={cn(
                "rounded-full px-3 py-1 ring-1",
                isCurrent
                  ? "bg-gold/12 text-gold ring-gold/50"
                  : isDone
                    ? "text-silver ring-white/15"
                    : "text-silver/45 ring-white/8",
              )}
            >
              {index + 1}. {step.label}
              {isDone ? " ✓" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
