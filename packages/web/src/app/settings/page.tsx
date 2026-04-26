"use client";

/**
 * Settings page per visual_direction_v1.md §10.8.
 * v1: theme toggle + forget-seed. Backup mnemonic + change passphrase land in Phase G2.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasSeed, forgetSeed } from "@/lib/seedClient";
import { Segmented } from "@/components/Segmented";

type Theme = "system" | "dark" | "light";
const THEME_KEY = "sendwyrd:theme";

export default function SettingsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("system");
  const [seedPresent, setSeedPresent] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(THEME_KEY) as Theme | null) ?? "system";
    setTheme(stored);
    applyTheme(stored);
    setSeedPresent(hasSeed());
  }, []);

  function changeTheme(next: Theme) {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  function doForgetSeed() {
    if (!confirm("Forget the seed on this device? You will need your mnemonic to recover.")) return;
    if (!confirm("Are you sure? This is final.")) return;
    forgetSeed();
    setSeedPresent(false);
    router.push("/");
  }

  return (
    <main style={pageStyle}>
      <h1 style={wordmarkStyle}>SendWyrd</h1>

      <section style={panelStyle}>
        <h2 style={sectionStyle}>Theme</h2>
        <div style={{ marginBottom: "var(--spacing-12)" }}>
          <Segmented
            name="theme"
            value={theme}
            onChange={(v) => changeTheme(v as Theme)}
            ariaLabel="Theme"
            options={[
              { value: "system", label: "system" },
              { value: "dark", label: "dark" },
              { value: "light", label: "light" },
            ]}
          />
        </div>

        <h2 style={sectionStyle}>About</h2>
        <p style={{ ...metaStyle, marginBottom: "var(--spacing-12)" }}>
          SendWyrd v0.1 · MOP protocol v1
          <br />
          <a href="https://github.com/openwyrd/sendwyrd" style={linkStyle} rel="noreferrer">
            github.com/openwyrd/sendwyrd
          </a>
        </p>

        <h2 style={{ ...sectionStyle, color: "var(--color-danger)" }}>Danger</h2>
        <button
          onClick={doForgetSeed}
          disabled={!seedPresent}
          style={{
            padding: "var(--spacing-3) var(--spacing-6)",
            border: "1px solid var(--color-danger)",
            background: "transparent",
            color: "var(--color-danger)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-caption)",
            cursor: seedPresent ? "pointer" : "not-allowed",
            opacity: seedPresent ? 1 : 0.4,
          }}
        >
          Forget seed on this device
        </button>
      </section>
    </main>
  );
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  html.classList.remove("dark", "light");
  if (theme === "dark") html.classList.add("dark");
  else if (theme === "light") html.classList.add("light");
  // "system" leaves no override class — falls back to prefers-color-scheme.
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "var(--spacing-12) var(--spacing-6)",
  gap: "var(--spacing-12)",
};
const wordmarkStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-h2)",
  fontWeight: 600,
  margin: 0,
  color: "var(--color-ink)",
};
const panelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "var(--max-content)",
  fontFamily: "var(--font-mono)",
  color: "var(--color-ink)",
};
const sectionStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  fontWeight: 500,
  textTransform: "lowercase",
  letterSpacing: "0.05em",
  color: "var(--color-ink-muted)",
  margin: 0,
  marginBottom: "var(--spacing-4)",
  paddingBottom: "var(--spacing-2)",
  borderBottom: "1px solid var(--color-hairline)",
};
const metaStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  color: "var(--color-ink-muted)",
  lineHeight: 1.6,
};
const linkStyle: React.CSSProperties = {
  color: "var(--color-accent)",
  textDecoration: "none",
};
