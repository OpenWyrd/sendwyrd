/**
 * Privacy-posture indicator per ADR-019 (amended by ADR-021).
 *
 * Single-form architecture: every wyrd is sealed. The indicator is now
 * monomorphic — a closed lock affirming that the host stays blind. Kept
 * for pedagogical visibility (users see the lock, understand the
 * fragment-form contract). Removable if it later becomes noise.
 */

interface SealedGlyphProps {
  size?: number;
  className?: string;
}

export function SealedGlyph({ size = 18, className }: SealedGlyphProps) {
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

export function PrivacyIndicator() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        color: "var(--color-mark-sealed)",
        cursor: "help",
      }}
      title="Sealed · decrypted on your device. AES-256-GCM body, secp256k1 author key. The decryption key lives in the URL fragment, which browsers never send to the host."
      aria-label="Sealed"
    >
      <SealedGlyph />
    </div>
  );
}
