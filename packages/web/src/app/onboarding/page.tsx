"use client";

/**
 * Onboarding per visual_direction_v1.md §10.9.
 * Three steps, single column, mono throughout, no progress dots, no illustrations.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateSeed } from "@sendwyrd/core";
import { hasSeed, storeSeed } from "@/lib/seedClient";
import { requestPersistence } from "@/lib/persistentStorage";
import { WyrdSigil } from "@/components/WyrdSigil";

type Step = "generate" | "mnemonic" | "passphrase";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("generate");
  const [mnemonic, setMnemonic] = useState<string>("");
  const [seed, setSeed] = useState<Uint8Array | null>(null);
  const [readGateOpen, setReadGateOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirm, setPassphraseConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If a seed already exists, send the user to compose.
  useEffect(() => {
    if (hasSeed()) router.replace("/compose");
  }, [router]);

  // 5s read-gate before "I wrote it down" enables.
  useEffect(() => {
    if (step !== "mnemonic") return;
    setReadGateOpen(false);
    const t = setTimeout(() => setReadGateOpen(true), 5000);
    return () => clearTimeout(t);
  }, [step]);

  function doGenerate() {
    const { mnemonic: m, seed: s } = generateSeed(12);
    setMnemonic(m);
    setSeed(s);
    setStep("mnemonic");
  }

  async function doSavePassphrase() {
    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters.");
      return;
    }
    if (passphrase !== passphraseConfirm) {
      setError("Passphrases don't match.");
      return;
    }
    if (!seed) {
      setError("No seed in memory — restart onboarding.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await storeSeed({ seed, counter: 0, passphrase });
      // Ask the browser to keep this seed across sessions. Silent — we never
      // block onboarding on the result.
      void requestPersistence();
      router.push("/compose");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save seed.");
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--spacing-20) var(--spacing-6)",
        gap: "var(--spacing-12)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-h1)",
          fontWeight: 600,
          margin: 0,
          color: "var(--color-ink)",
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-3)",
        }}
      >
        <WyrdSigil size={40} ariaLabel="" />
        <span>SendWyrd</span>
      </h1>

      <section
        style={{
          width: "100%",
          maxWidth: "var(--max-content)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink)",
          lineHeight: 1.6,
        }}
      >
        {step === "generate" && (
          <>
            <p style={{ margin: 0, marginBottom: "var(--spacing-6)" }}>
              Your seed is your authorship. SendWyrd generates one for you now.
              It lives only on this device.
            </p>
            <button onClick={doGenerate} style={btnStyle}>
              Generate seed
            </button>
          </>
        )}

        {step === "mnemonic" && (
          <>
            <p style={{ margin: 0, marginBottom: "var(--spacing-6)" }}>
              Write this down somewhere offline. SendWyrd stores the seed
              locally — if local storage clears or this device fails and you
              didn&apos;t back up the mnemonic, your sealed wyrds are gone.
              That&apos;s how SendWyrd works.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "var(--spacing-3)",
                padding: "var(--spacing-6)",
                border: "1px solid var(--color-hairline)",
                marginBottom: "var(--spacing-8)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-body)",
              }}
            >
              {mnemonic.split(" ").map((word, i) => (
                <div key={i} style={{ display: "flex", gap: "var(--spacing-2)" }}>
                  <span style={{ color: "var(--color-ink-subtle)", minWidth: 24 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{word}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep("passphrase")}
              disabled={!readGateOpen}
              style={{
                ...btnStyle,
                opacity: readGateOpen ? 1 : 0.4,
                cursor: readGateOpen ? "pointer" : "not-allowed",
              }}
            >
              {readGateOpen ? "I wrote it down" : "Read the words first…"}
            </button>
          </>
        )}

        {step === "passphrase" && (
          <>
            <p style={{ margin: 0, marginBottom: "var(--spacing-6)" }}>
              Set a passphrase. It encrypts your seed at rest on this device.
              You&apos;ll enter it once per session — the seed stays unlocked
              until you close this tab.
            </p>
            <input
              type="password"
              autoComplete="new-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="passphrase"
              style={inputStyle}
            />
            <input
              type="password"
              autoComplete="new-password"
              value={passphraseConfirm}
              onChange={(e) => setPassphraseConfirm(e.target.value)}
              placeholder="confirm"
              style={{ ...inputStyle, marginTop: "var(--spacing-3)" }}
            />
            {error && (
              <p
                style={{
                  color: "var(--color-danger)",
                  margin: 0,
                  marginTop: "var(--spacing-3)",
                  fontSize: "var(--text-caption)",
                }}
              >
                {error}
              </p>
            )}
            <button
              onClick={doSavePassphrase}
              disabled={saving}
              style={{
                ...btnStyle,
                marginTop: "var(--spacing-6)",
                opacity: saving ? 0.5 : 1,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Set passphrase"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "var(--spacing-3) var(--spacing-6)",
  border: "1px solid var(--color-hairline-strong)",
  background: "transparent",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-body)",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--spacing-3) var(--spacing-4)",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--color-hairline)",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-body)",
  outline: "none",
};
