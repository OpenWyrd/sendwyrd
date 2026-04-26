/**
 * The wyrd sigil — single brand-load-bearing custom mark.
 * Per visual_direction_v1.md §7: three intersecting hairline strokes
 * converging at a knot point near center. Reads as both a stylized W
 * and a three-strand braid converging into a knot.
 *
 * Used in three places only (per § 7):
 *   1. Wordmark lockup
 *   2. Landing hero (with breathing animation per § 7.2)
 *   3. Browser favicon / app icon
 *
 * The breathing animation lives in globals.css (.wyrd-sigil-breathing)
 * and is opted into via the `breathing` prop. Static everywhere else.
 */

interface WyrdSigilProps {
  size?: number;
  breathing?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function WyrdSigil({
  size = 32,
  breathing = false,
  ariaLabel = "SendWyrd",
  className,
}: WyrdSigilProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel}
      className={[breathing ? "wyrd-sigil-breathing" : "", className]
        .filter(Boolean)
        .join(" ")}
      style={{ display: "block" }}
    >
      {/* Three hairline strokes converging at the knot point (16, 18). */}
      {/* Outer-left stroke: from upper-left, descends to knot, returns down to left foot. */}
      <path
        d="M 5 5 L 16 18 L 11 27"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Outer-right stroke: from upper-right, descends to knot, returns down to right foot. */}
      <path
        d="M 27 5 L 16 18 L 21 27"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Middle stroke: vertical from top through knot — the third braid. */}
      <path
        d="M 16 5 L 16 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      {/* Knot: small circle at the convergence point. */}
      <circle
        cx="16"
        cy="18"
        r="1.25"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
