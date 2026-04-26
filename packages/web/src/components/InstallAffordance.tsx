"use client";

/**
 * Install affordance for the landing page.
 *
 * - Chromium (canPrompt): renders an "Install as app" button that calls
 *   the deferred beforeinstallprompt event.
 * - iOS Safari (ios && !canPrompt): renders a small expandable hint with
 *   the manual Add-to-Home-Screen instructions.
 * - Already installed OR no install path available: renders nothing.
 *
 * Visual register: secondary affordance below the primary Compose CTA.
 * Smaller font, hairline border, muted ink.
 */

import { useState } from "react";
import { useInstallState, triggerInstall } from "@/lib/installPrompt";

export function InstallAffordance() {
  const { canPrompt, installed, ios } = useInstallState();
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  if (installed) return null;
  if (!canPrompt && !ios) return null;

  if (canPrompt) {
    return (
      <button
        type="button"
        onClick={() => void triggerInstall()}
        style={btnStyle}
      >
        Install as app
      </button>
    );
  }

  // iOS branch
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--spacing-3)",
      }}
    >
      <button
        type="button"
        onClick={() => setIosHelpOpen((v) => !v)}
        style={btnStyle}
      >
        Install on iPhone
      </button>
      {iosHelpOpen && (
        <p
          style={{
            margin: 0,
            color: "var(--color-ink-subtle)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-microcaption)",
            textAlign: "center",
            maxWidth: "var(--max-content)",
            lineHeight: 1.6,
          }}
        >
          Tap the share icon at the bottom of Safari, then choose
          {" "}
          <strong style={{ color: "var(--color-ink-muted)" }}>
            Add to Home Screen
          </strong>
          .
        </p>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "var(--spacing-2) var(--spacing-5)",
  border: "1px solid var(--color-hairline)",
  background: "transparent",
  color: "var(--color-ink-muted)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  cursor: "pointer",
};
