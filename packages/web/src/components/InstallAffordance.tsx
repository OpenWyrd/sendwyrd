"use client";

/**
 * Install affordance — surfaces a PWA install pitch on mobile only.
 *
 * Two variants:
 *
 *   - "homepage": a discrete card in the page flow with one line of pitch
 *     copy, a single button (Chromium) or expandable iOS instructions
 *     with the inline share glyph, and a small × dismiss control.
 *
 *   - "wyrd": a compact one-line strip placed under the wyrd content,
 *     in the same column as Quote / Share / DM Author. One line of pitch,
 *     one button, one ×.
 *
 * Gating:
 *   - Server-render returns nothing; mounts via useEffect.
 *   - Hidden when installed (display-mode: standalone, navigator.standalone,
 *     or our local "appinstalled" flag).
 *   - Hidden on desktop. We treat any of the following as desktop:
 *       - userAgentData.mobile === false on browsers that expose it
 *       - matchMedia("(min-width: 641px)") with fine pointer
 *     We do NOT user-agent sniff for "mobile" — the matchMedia query
 *     plus the pointer hint cover both real phones and dev-tools mobile
 *     emulation.
 *   - Hidden when the user has × dismissed this session (sessionStorage,
 *     never localStorage — capability URLs are fresh visits).
 *   - Hidden when there is no install path (not iOS Safari AND no
 *     captured beforeinstallprompt event yet).
 *
 * Privacy:
 *   - No fetch, no analytics, no Sentry breadcrumb. console.debug only
 *     when running on localhost (visible in dev, silent in prod logs).
 */

import { useEffect, useState } from "react";
import { useInstallState, triggerInstall } from "@/lib/installPrompt";

type Variant = "homepage" | "wyrd";

const SESSION_DISMISS_KEY = "sendwyrd:install-dismissed";

// Detect whether the current browser is a mobile viewport. Returns null
// during SSR + first paint to avoid hydration mismatch; the consumer
// should render nothing until a boolean is available.
function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsMobile(false);
      return;
    }

    function compute(): boolean {
      // Modern: navigator.userAgentData.mobile is a clean boolean on
      // Chromium. When present and false, definitively desktop.
      const uaData = (
        navigator as Navigator & { userAgentData?: { mobile?: boolean } }
      ).userAgentData;
      if (uaData && typeof uaData.mobile === "boolean") {
        return uaData.mobile;
      }
      // Fallback: viewport width + coarse pointer. Either narrow OR
      // touch-coarse implies mobile-class. Both desktop signals → no.
      const narrow = window.matchMedia("(max-width: 640px)").matches;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      return narrow || coarse;
    }

    setIsMobile(compute());

    const mqNarrow = window.matchMedia("(max-width: 640px)");
    const mqCoarse = window.matchMedia("(pointer: coarse)");
    const onChange = () => setIsMobile(compute());
    mqNarrow.addEventListener("change", onChange);
    mqCoarse.addEventListener("change", onChange);
    return () => {
      mqNarrow.removeEventListener("change", onChange);
      mqCoarse.removeEventListener("change", onChange);
    };
  }, []);

  return isMobile;
}

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

// Apple-style share glyph (square + arrow up). Inline SVG so it renders
// inside the iOS instructions exactly the way Apple's own UI labels it,
// no font dependency, no emoji.
function ShareGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        display: "inline-block",
        verticalAlign: "-2px",
        marginInline: "0.15em",
      }}
    >
      <path d="M8 1 L8 13" />
      <path d="M4.5 4.5 L8 1 L11.5 4.5" />
      <path d="M3 8 L3 18 L13 18 L13 8" />
    </svg>
  );
}

// × close button — same idiom across both variants.
function CloseX({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss install hint"
      style={{
        background: "transparent",
        border: "none",
        padding: "var(--spacing-1) var(--spacing-2)",
        margin: 0,
        color: "var(--color-ink-subtle)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-caption)",
        lineHeight: 1,
        cursor: "pointer",
      }}
    >
      ×
    </button>
  );
}

interface Props {
  variant?: Variant;
}

export function InstallAffordance({ variant = "homepage" }: Props) {
  const { canPrompt, installed, ios } = useInstallState();
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [iosOpen, setIosOpen] = useState(false);

  // Read sessionStorage dismissal once mounted (client-only).
  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  function dismiss() {
    writeDismissed();
    setDismissed(true);
    if (
      typeof window !== "undefined" &&
      /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    ) {
      // eslint-disable-next-line no-console
      console.debug("[InstallAffordance] dismissed for session");
    }
  }

  // Hydration-safe gating: render nothing until isMobile resolves.
  if (isMobile === null) return null;
  if (!isMobile) return null;
  if (installed) return null;
  if (dismissed) return null;
  if (!canPrompt && !ios) return null;

  if (variant === "wyrd") {
    return (
      <div style={wyrdRowStyle}>
        <span style={wyrdCopyStyle}>
          Install SendWyrd. Open faster, share-into from any app.
        </span>
        {canPrompt ? (
          <button
            type="button"
            onClick={() => void triggerInstall()}
            style={wyrdButtonStyle}
          >
            install
          </button>
        ) : (
          <details
            className="reply-disclosure"
            style={{ display: "inline-block" }}
          >
            <summary style={wyrdSummaryStyle}>install on iPhone</summary>
            <div style={iosBodyStyleCompact}>
              Tap <ShareGlyph />, then{" "}
              <strong style={{ color: "var(--color-ink-muted)" }}>
                Add to Home Screen
              </strong>
              .
            </div>
          </details>
        )}
        <CloseX onClick={dismiss} />
      </div>
    );
  }

  // Homepage card.
  return (
    <div style={homepageCardStyle}>
      <div style={homepageHeaderStyle}>
        <p style={homepageCopyStyle}>
          Add SendWyrd to your home screen. Faster opens. Share-into from
          anywhere. No account, no tracking.
        </p>
        <CloseX onClick={dismiss} />
      </div>
      {canPrompt ? (
        <button
          type="button"
          onClick={() => void triggerInstall()}
          style={homepageButtonStyle}
        >
          Install as app
        </button>
      ) : (
        <details
          className="reply-disclosure"
          open={iosOpen}
          onToggle={(e) => setIosOpen((e.target as HTMLDetailsElement).open)}
          style={{ width: "100%" }}
        >
          <summary style={homepageSummaryStyle}>Install on iPhone</summary>
          <div style={iosBodyStyle}>
            Tap <ShareGlyph size={16} /> at the bottom of Safari, then{" "}
            <strong style={{ color: "var(--color-ink-muted)" }}>
              Add to Home Screen
            </strong>
            . Done.
          </div>
        </details>
      )}
    </div>
  );
}

// — Homepage variant styles ——————————————————————————————

const homepageCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "var(--max-content)",
  border: "1px solid var(--color-hairline)",
  padding: "var(--spacing-3) var(--spacing-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-3)",
  fontFamily: "var(--font-mono)",
};

const homepageHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "var(--spacing-3)",
};

const homepageCopyStyle: React.CSSProperties = {
  margin: 0,
  flex: 1,
  color: "var(--color-ink-muted)",
  fontSize: "var(--text-caption)",
  lineHeight: 1.5,
};

const homepageButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "var(--spacing-2) var(--spacing-5)",
  border: "1px solid var(--color-hairline-strong)",
  background: "transparent",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  letterSpacing: "0.02em",
  cursor: "pointer",
};

const homepageSummaryStyle: React.CSSProperties = {
  cursor: "pointer",
  listStyle: "none",
  padding: "var(--spacing-2) 0",
  color: "var(--color-ink)",
  fontSize: "var(--text-caption)",
  letterSpacing: "0.02em",
  display: "inline-block",
  borderBottom: "1px solid var(--color-hairline-strong)",
};

const iosBodyStyle: React.CSSProperties = {
  marginTop: "var(--spacing-3)",
  color: "var(--color-ink-muted)",
  fontSize: "var(--text-caption)",
  lineHeight: 1.6,
};

// — Wyrd-view variant styles ——————————————————————————————

const wyrdRowStyle: React.CSSProperties = {
  marginTop: "var(--spacing-4)",
  paddingTop: "var(--spacing-3)",
  borderTop: "1px solid var(--color-hairline)",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--spacing-3)",
  fontFamily: "var(--font-mono)",
};

const wyrdCopyStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  color: "var(--color-ink-subtle)",
  fontSize: "var(--text-microcaption)",
  lineHeight: 1.5,
};

const wyrdButtonStyle: React.CSSProperties = {
  padding: "var(--spacing-1) var(--spacing-4)",
  border: "1px solid var(--color-hairline-strong)",
  background: "transparent",
  color: "var(--color-ink-muted)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-microcaption)",
  letterSpacing: "0.02em",
  cursor: "pointer",
};

const wyrdSummaryStyle: React.CSSProperties = {
  cursor: "pointer",
  listStyle: "none",
  color: "var(--color-ink-muted)",
  fontSize: "var(--text-microcaption)",
  letterSpacing: "0.02em",
  padding: "var(--spacing-1) var(--spacing-3)",
  border: "1px solid var(--color-hairline-strong)",
  display: "inline-block",
};

const iosBodyStyleCompact: React.CSSProperties = {
  marginTop: "var(--spacing-2)",
  color: "var(--color-ink-subtle)",
  fontSize: "var(--text-microcaption)",
  lineHeight: 1.5,
  width: "100%",
};
