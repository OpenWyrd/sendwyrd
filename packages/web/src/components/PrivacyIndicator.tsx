/**
 * Privacy-posture indicator per ADR-019 + renderer-contract §10 +
 * visual_direction_v1.md §6.
 *
 * Two states, symmetric by glyph topology:
 *   Sealed  — knotted thread (host cannot read)
 *   Open    — unknotted thread (host can read)
 *
 * Glyphs are 16×16 viewBox, two-stroke hairline 1.25px construction.
 * No motion on mount. No pulse, shimmer, or color transition.
 */

interface IndicatorProps {
  size?: number;
  className?: string;
}

export function SealedGlyph({ size = 16, className }: IndicatorProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role="img"
      aria-label="Sealed"
      className={className}
      style={{ display: "block" }}
    >
      {/* Two strokes crossing through center and tying via a small loop. */}
      <path
        d="M 3 4 Q 8 8 13 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M 3 12 Q 8 8 13 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      {/* Knot loop at the convergence. */}
      <circle
        cx="8"
        cy="8"
        r="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

export function OpenGlyph({ size = 16, className }: IndicatorProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role="img"
      aria-label="Open"
      className={className}
      style={{ display: "block" }}
    >
      {/* Two parallel curves — never touch. */}
      <path
        d="M 3 6 Q 8 4 13 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M 3 10 Q 8 12 13 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface PrivacyIndicatorProps {
  state: "sealed" | "open";
}

export function PrivacyIndicator({ state }: PrivacyIndicatorProps) {
  const isSealed = state === "sealed";
  const color = isSealed ? "var(--color-mark-sealed)" : "var(--color-mark-open)";
  const label = isSealed ? "Sealed" : "Open";
  const detail = isSealed ? "host cannot read this" : "host can read this";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-2)",
        color,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-caption)",
        lineHeight: 1.4,
        paddingTop: "var(--spacing-3)",
        paddingBottom: "var(--spacing-3)",
        borderTop: "1px solid var(--color-hairline)",
        borderBottom: "1px solid var(--color-hairline)",
      }}
      title={
        isSealed
          ? "The body of this wyrd lives in the URL fragment; the host serves opaque ciphertext."
          : "The body of this wyrd lives in the URL path; the host can render it for previews and search."
      }
    >
      {isSealed ? <SealedGlyph /> : <OpenGlyph />}
      <span>
        {label} · {detail}
      </span>
    </div>
  );
}
