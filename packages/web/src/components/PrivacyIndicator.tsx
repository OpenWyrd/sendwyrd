/**
 * Privacy-posture indicator per ADR-019.
 *
 * v2 (post-UX-feedback): minimal lock glyph only — closed for Sealed,
 * open for Public. Hover/tap reveals the explanation. No verbose lines
 * of crypto detail in the primary surface.
 */

interface IndicatorProps {
  size?: number;
  className?: string;
}

export function SealedGlyph({ size = 18, className }: IndicatorProps) {
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
      <path
        d="M 5 8 V 5.5 Q 5 2.5 8 2.5 Q 11 2.5 11 5.5 V 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <rect
        x="3.5"
        y="8"
        width="9"
        height="6"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

export function OpenGlyph({ size = 18, className }: IndicatorProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role="img"
      aria-label="Public"
      className={className}
      style={{ display: "block" }}
    >
      {/* Open shackle — leans left, detached from body. */}
      <path
        d="M 5 8 V 5.5 Q 5 2.5 8 2.5 Q 11 2.5 11 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <rect
        x="3.5"
        y="8"
        width="9"
        height="6"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
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
  const tooltip = isSealed
    ? "Sealed · decrypted on your device. AES-256-GCM body, secp256k1 author key. The decryption key lives in the URL fragment, which browsers never send to the host."
    : "Public · readable by the host (and by anyone with the URL). The decryption key lives in the URL path; the host can decrypt server-side for previews and search.";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        color,
        cursor: "help",
      }}
      title={tooltip}
      aria-label={isSealed ? "Sealed" : "Public"}
    >
      {isSealed ? <SealedGlyph /> : <OpenGlyph />}
    </div>
  );
}
