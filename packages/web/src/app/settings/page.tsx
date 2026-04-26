"use client";

/**
 * Settings per visual_direction_v1.md §10.8.
 *
 * Sections:
 *   - theme (system / dark / light)
 *   - install (PWA install affordance — Chromium prompt or iOS instructions)
 *   - passphrase (open ↔ protected mode promotion/demotion)
 *   - backup mnemonic (reveal-on-confirm)
 *   - storage (persistence state + quota estimate)
 *   - about
 *   - danger (forget seed)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  hasSeed,
  forgetSeed,
  getSeedMode,
  isUnlocked,
  unlockSeed,
  getMnemonic,
  getSeedBackupString,
  protectWithPassphrase,
  unprotectSeed,
  regenerateSeed,
  installRecoveredSeed,
  type SeedMode,
} from "@/lib/seedClient";
import { generateSeed, isValidMnemonic, mnemonicToSeed } from "@sendwyrd/core";
import { mergeHistoryEntries } from "@/lib/wyrdHistory";
import { sweepFromMnemonic, type SweepProgress } from "@/lib/recovery";
import { Segmented } from "@/components/Segmented";
import { Nav } from "@/components/Nav";
import { MnemonicInput } from "@/components/MnemonicInput";
import { useInstallState, triggerInstall } from "@/lib/installPrompt";
import {
  getPersistenceState,
  getStorageEstimate,
  formatBytes,
  type StorageEstimate,
} from "@/lib/persistentStorage";

type Theme = "system" | "dark" | "light";
const THEME_KEY = "sendwyrd:theme";

export default function SettingsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("system");
  const [seedMode, setSeedModeState] = useState<SeedMode>(null);
  const [, setUnlockedState] = useState(false);

  // Passphrase form state
  const [pp, setPp] = useState("");
  const [ppConfirm, setPpConfirm] = useState("");
  const [unlockPp, setUnlockPp] = useState("");
  const [ppMessage, setPpMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  // Mnemonic reveal state
  const [mnemonicShown, setMnemonicShown] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);

  // Recovery state
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryMnemonic, setRecoveryMnemonic] = useState("");
  const [recoveryWordCount, setRecoveryWordCount] = useState<12 | 24>(12);
  const [recoveryStoragePassphrase, setRecoveryStoragePassphrase] =
    useState("");
  const [
    recoveryStoragePassphraseConfirm,
    setRecoveryStoragePassphraseConfirm,
  ] = useState("");
  const [recoveryProgress, setRecoveryProgress] =
    useState<SweepProgress | null>(null);
  const [recoveryRunning, setRecoveryRunning] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  // Install prompt state (deferred beforeinstallprompt + iOS detection)
  const install = useInstallState();
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  // Storage state
  const [persistGranted, setPersistGranted] = useState<boolean | null>(null);
  const [persistAsked, setPersistAsked] = useState(false);
  const [persistSupported, setPersistSupported] = useState(true);
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);

  useEffect(() => {
    const stored =
      (localStorage.getItem(THEME_KEY) as Theme | null) ?? "system";
    setTheme(stored);
    applyTheme(stored);
    setSeedModeState(getSeedMode());
    setUnlockedState(isUnlocked());
    setMnemonic(getMnemonic());
    void (async () => {
      const ps = await getPersistenceState();
      setPersistSupported(ps.supported);
      setPersistGranted(ps.granted);
      setPersistAsked(ps.asked);
      setEstimate(await getStorageEstimate());
    })();
  }, []);

  function changeTheme(next: Theme) {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  function refreshState() {
    setSeedModeState(getSeedMode());
    setUnlockedState(isUnlocked());
    setMnemonic(getMnemonic());
  }

  async function handleAddPassphrase(e: React.FormEvent) {
    e.preventDefault();
    setPpMessage(null);
    if (pp.length < 8) {
      setPpMessage({
        kind: "err",
        text: "Passphrase must be at least 8 characters.",
      });
      return;
    }
    if (pp !== ppConfirm) {
      setPpMessage({ kind: "err", text: "Passphrases don't match." });
      return;
    }
    try {
      await protectWithPassphrase(pp);
      setPp("");
      setPpConfirm("");
      setPpMessage({
        kind: "ok",
        text: "Passphrase added. Seed is now encrypted at rest.",
      });
      refreshState();
    } catch (e: any) {
      setPpMessage({
        kind: "err",
        text: e?.message ?? "Failed to set passphrase.",
      });
    }
  }

  async function handleRemovePassphrase(e: React.FormEvent) {
    e.preventDefault();
    setPpMessage(null);
    try {
      await unlockSeed(unlockPp);
      unprotectSeed();
      setUnlockPp("");
      setPpMessage({
        kind: "ok",
        text: "Passphrase removed. Seed is now in plain localStorage.",
      });
      refreshState();
    } catch {
      setPpMessage({ kind: "err", text: "Wrong passphrase." });
    }
  }

  async function handleRevealMnemonic() {
    if (seedMode === "protected" && !isUnlocked()) {
      const pp = window.prompt("Enter passphrase to reveal mnemonic");
      if (!pp) return;
      try {
        const data = await unlockSeed(pp);
        setMnemonic(data.mnemonic ?? null);
        setUnlockedState(true);
      } catch {
        alert("Wrong passphrase.");
        return;
      }
    } else {
      setMnemonic(getMnemonic());
    }
    setMnemonicShown(true);
  }

  async function handleRecoverFromMnemonic(e: React.FormEvent) {
    e.preventDefault();
    setRecoveryMessage(null);
    const phrase = recoveryMnemonic.trim().replace(/\s+/g, " ");
    if (!isValidMnemonic(phrase)) {
      setRecoveryMessage({
        kind: "err",
        text: "Invalid mnemonic — check spelling and word count (12 or 24).",
      });
      return;
    }
    if (recoveryStoragePassphrase) {
      if (recoveryStoragePassphrase.length < 8) {
        setRecoveryMessage({
          kind: "err",
          text: "Storage passphrase must be at least 8 characters (or leave blank for open mode).",
        });
        return;
      }
      if (recoveryStoragePassphrase !== recoveryStoragePassphraseConfirm) {
        setRecoveryMessage({
          kind: "err",
          text: "Storage passphrases don't match.",
        });
        return;
      }
    }
    setRecoveryRunning(true);
    setRecoveryProgress({ kind: "starting" });
    try {
      const sweep = await sweepFromMnemonic({
        mnemonic: phrase,
        onProgress: (p) => setRecoveryProgress(p),
      });
      const seedBytes = mnemonicToSeed(phrase);
      await installRecoveredSeed({
        seed: seedBytes,
        mnemonic: phrase,
        counter: sweep.nextN,
        storagePassphrase: recoveryStoragePassphrase || undefined,
      });
      const added = mergeHistoryEntries(sweep.entries);
      const word = sweep.foundHandles === 1 ? "wyrd" : "wyrds";
      const note =
        sweep.foundHandles === 0
          ? "No wyrds found for this mnemonic."
          : `Recovered ${sweep.foundHandles} ${word} (${added} new). Burn / replies will work; body decryption requires the original share URLs.`;
      setRecoveryMessage({ kind: "ok", text: note });
      setRecoveryMnemonic("");
      setRecoveryStoragePassphrase("");
      setRecoveryStoragePassphraseConfirm("");
      refreshState();
    } catch (e: unknown) {
      const swe = (
        e as { sweepError?: { kind: string; detail?: string; n?: number } }
      ).sweepError;
      let msg = "Recovery failed.";
      if (swe?.kind === "invalid_mnemonic") msg = "Invalid mnemonic.";
      else if (swe?.kind === "network")
        msg = `Network error during sweep: ${swe.detail ?? "unknown"}.`;
      else if (swe?.kind === "signature_mismatch")
        msg = `Signature mismatch at index ${swe.n} — host rejected proof-of-possession (unexpected; please retry).`;
      else if (e instanceof Error) msg = `Recovery failed: ${e.message}`;
      setRecoveryMessage({ kind: "err", text: msg });
    } finally {
      setRecoveryRunning(false);
      setRecoveryProgress(null);
    }
  }

  function doForgetSeed() {
    if (
      !confirm(
        "Forget the seed on this device? You will need your mnemonic to recover.",
      )
    )
      return;
    if (!confirm("Are you sure? This is final.")) return;
    forgetSeed();
    setSeedModeState(null);
    router.push("/");
  }

  return (
    <main style={pageStyle}>
      <Nav />

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

        <h2 style={sectionStyle}>Install</h2>
        {install.installed && (
          <p style={{ ...metaStyle, marginBottom: "var(--spacing-12)" }}>
            Installed. SendWyrd runs as a standalone app on this device.
          </p>
        )}
        {!install.installed && install.canPrompt && (
          <>
            <p style={{ ...metaStyle, marginBottom: "var(--spacing-4)" }}>
              Install SendWyrd as an app. Standalone window, home-screen icon.
              Same code, no native shell.
            </p>
            <button
              onClick={async () => {
                await triggerInstall();
              }}
              style={btnStyle}
            >
              Install SendWyrd
            </button>
          </>
        )}
        {!install.installed && !install.canPrompt && install.ios && (
          <>
            <p style={{ ...metaStyle, marginBottom: "var(--spacing-4)" }}>
              On iOS: tap Share, then Add to Home Screen.
            </p>
            <button onClick={() => setIosHelpOpen((v) => !v)} style={btnStyle}>
              {iosHelpOpen ? "Hide steps" : "Show steps"}
            </button>
            {iosHelpOpen && (
              <ol
                style={{
                  margin: 0,
                  marginTop: "var(--spacing-4)",
                  paddingLeft: "var(--spacing-6)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-caption)",
                  color: "var(--color-ink-muted)",
                  lineHeight: 1.6,
                }}
              >
                <li>Tap the Share button (square with arrow up).</li>
                <li>Scroll down. Tap Add to Home Screen.</li>
                <li>Confirm. The wyrd sigil appears on your home screen.</li>
              </ol>
            )}
          </>
        )}
        {!install.installed && !install.canPrompt && !install.ios && (
          <p style={{ ...metaStyle, marginBottom: "var(--spacing-4)" }}>
            Browser install not offered. Use your browser&apos;s menu: look for
            &ldquo;Install SendWyrd&rdquo; or &ldquo;Add to Home Screen&rdquo;.
          </p>
        )}
        <div style={{ marginBottom: "var(--spacing-12)" }} />

        <h2 style={sectionStyle}>Passphrase</h2>
        {seedMode === null && (
          <p style={metaStyle}>
            No seed on this device yet. Compose a wyrd to generate one.
          </p>
        )}
        {seedMode === "open" && (
          <>
            <p style={{ ...metaStyle, marginBottom: "var(--spacing-4)" }}>
              Your seed is currently stored in plain localStorage on this
              device. Add a passphrase to encrypt it at rest
              (PBKDF2-AES-256-GCM, 600k iterations).
            </p>
            <form onSubmit={handleAddPassphrase}>
              <input
                type="password"
                autoComplete="new-password"
                value={pp}
                onChange={(e) => setPp(e.target.value)}
                placeholder="passphrase"
                style={inputStyle}
              />
              <input
                type="password"
                autoComplete="new-password"
                value={ppConfirm}
                onChange={(e) => setPpConfirm(e.target.value)}
                placeholder="confirm"
                style={{ ...inputStyle, marginTop: "var(--spacing-3)" }}
              />
              <button
                type="submit"
                style={{ ...btnStyle, marginTop: "var(--spacing-4)" }}
              >
                Set passphrase
              </button>
            </form>
          </>
        )}
        {seedMode === "protected" && (
          <>
            <p style={{ ...metaStyle, marginBottom: "var(--spacing-4)" }}>
              Your seed is encrypted with a passphrase. To remove it (and store
              the seed in plain localStorage), enter your current passphrase.
            </p>
            <form onSubmit={handleRemovePassphrase}>
              <input
                type="password"
                autoComplete="current-password"
                value={unlockPp}
                onChange={(e) => setUnlockPp(e.target.value)}
                placeholder="current passphrase"
                style={inputStyle}
              />
              <button
                type="submit"
                style={{ ...btnStyle, marginTop: "var(--spacing-4)" }}
              >
                Remove passphrase
              </button>
            </form>
          </>
        )}
        {ppMessage && (
          <p
            style={{
              margin: 0,
              marginTop: "var(--spacing-3)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-microcaption)",
              color:
                ppMessage.kind === "ok"
                  ? "var(--color-mark-sealed)"
                  : "var(--color-danger)",
            }}
          >
            {ppMessage.text}
          </p>
        )}
        <div style={{ marginBottom: "var(--spacing-12)" }} />

        <h2 style={sectionStyle}>Backup mnemonic</h2>
        {!seedMode && <p style={metaStyle}>No seed yet.</p>}
        {seedMode && !mnemonicShown && (
          <>
            <p style={{ ...metaStyle, marginBottom: "var(--spacing-4)" }}>
              Your 12-word recovery phrase. Write it down somewhere offline.
              SendWyrd stores your seed locally — back up your mnemonic. If
              local storage clears or this device fails, your sealed wyrds
              vanish; the mnemonic is the only path back to your authorship.
            </p>
            <button onClick={handleRevealMnemonic} style={btnStyle}>
              Reveal mnemonic
            </button>
          </>
        )}
        {seedMode && mnemonicShown && mnemonic && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "var(--spacing-3)",
                padding: "var(--spacing-6)",
                border: "1px solid var(--color-hairline)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-caption)",
                marginBottom: "var(--spacing-3)",
              }}
            >
              {mnemonic.split(" ").map((word, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: "var(--spacing-2)" }}
                >
                  <span
                    style={{ color: "var(--color-ink-subtle)", minWidth: 20 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{word}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setMnemonicShown(false)} style={btnStyle}>
              Hide
            </button>
          </>
        )}
        {seedMode && mnemonicShown && !mnemonic && (
          <NoMnemonicHelp
            onRegenerate={async () => {
              if (
                !confirm(
                  "Generate a new seed? This invalidates the current seed — wyrds you've already published can't be burned or have their replies fetched after this. The new seed will have a mnemonic backup.",
                )
              )
                return;
              if (!confirm("Last chance — really replace?")) return;
              try {
                const { seed, mnemonic } = generateSeed(12);
                let pp: string | undefined;
                if (seedMode === "protected") {
                  pp =
                    window.prompt(
                      "Enter your current passphrase to re-encrypt the new seed",
                    ) ?? undefined;
                  if (!pp) return;
                  await unlockSeed(pp);
                }
                await regenerateSeed({
                  newSeed: seed,
                  newMnemonic: mnemonic,
                  passphraseIfProtected: pp,
                });
                refreshState();
                setMnemonicShown(false);
                alert(
                  "New seed generated. Click 'Reveal mnemonic' again to see your fresh 12 words.",
                );
              } catch (e: any) {
                alert(`Regenerate failed: ${e?.message ?? "unknown"}`);
              }
            }}
            onExportRaw={() => {
              const raw = getSeedBackupString();
              if (!raw) return;
              window.prompt(
                "Raw seed (base64url) — copy this somewhere safe. Not a standard BIP-39 phrase.",
                raw,
              );
            }}
          />
        )}
        <div style={{ marginBottom: "var(--spacing-12)" }} />

        <h2 style={sectionStyle}>Recover from mnemonic</h2>
        <p style={{ ...metaStyle, marginBottom: "var(--spacing-4)" }}>
          Have a 12- or 24-word phrase from another device? Sweep the host for
          wyrds derived from this seed. Burn / fetch-replies will work on
          recovered wyrds; body decryption requires the original share URLs
          (read keys aren&apos;t derived from the seed).
        </p>
        {!recoveryOpen && (
          <button
            onClick={() => {
              setRecoveryOpen(true);
              setRecoveryMessage(null);
            }}
            style={btnStyle}
          >
            Recover from mnemonic
          </button>
        )}
        {recoveryOpen && (
          <form onSubmit={handleRecoverFromMnemonic}>
            <div style={{ marginBottom: "var(--spacing-4)" }}>
              <Segmented
                name="recovery-word-count"
                value={String(recoveryWordCount)}
                onChange={(v) => setRecoveryWordCount(Number(v) as 12 | 24)}
                size="sm"
                ariaLabel="Word count"
                options={[
                  { value: "12", label: "12 words" },
                  { value: "24", label: "24 words" },
                ]}
              />
            </div>
            <MnemonicInput
              value={recoveryMnemonic}
              onChange={setRecoveryMnemonic}
              wordCount={recoveryWordCount}
              disabled={recoveryRunning}
            />
            <p
              style={{
                ...metaStyle,
                marginTop: "var(--spacing-4)",
                marginBottom: "var(--spacing-3)",
              }}
            >
              Optional — set a passphrase to encrypt the recovered seed at rest.
              Leave blank for open mode.
            </p>
            <input
              type="password"
              autoComplete="new-password"
              value={recoveryStoragePassphrase}
              onChange={(e) => setRecoveryStoragePassphrase(e.target.value)}
              placeholder="passphrase (optional)"
              disabled={recoveryRunning}
              style={inputStyle}
            />
            {recoveryStoragePassphrase && (
              <input
                type="password"
                autoComplete="new-password"
                value={recoveryStoragePassphraseConfirm}
                onChange={(e) =>
                  setRecoveryStoragePassphraseConfirm(e.target.value)
                }
                placeholder="confirm"
                disabled={recoveryRunning}
                style={{ ...inputStyle, marginTop: "var(--spacing-3)" }}
              />
            )}
            <div
              style={{
                display: "flex",
                gap: "var(--spacing-3)",
                marginTop: "var(--spacing-4)",
                flexWrap: "wrap",
              }}
            >
              <button type="submit" style={btnStyle} disabled={recoveryRunning}>
                {recoveryRunning ? "Sweeping…" : "Begin sweep"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecoveryOpen(false);
                  setRecoveryMnemonic("");
                  setRecoveryStoragePassphrase("");
                  setRecoveryStoragePassphraseConfirm("");
                  setRecoveryMessage(null);
                }}
                disabled={recoveryRunning}
                style={btnStyle}
              >
                Cancel
              </button>
            </div>
            {recoveryProgress && recoveryProgress.kind === "deriving" && (
              <p
                style={{
                  ...metaStyle,
                  marginTop: "var(--spacing-3)",
                  color: "var(--color-ink-subtle)",
                }}
              >
                Sweeping index {recoveryProgress.n} (gap {recoveryProgress.gap}
                /20) — {recoveryProgress.foundHandles} found
              </p>
            )}
            {recoveryProgress && recoveryProgress.kind === "starting" && (
              <p
                style={{
                  ...metaStyle,
                  marginTop: "var(--spacing-3)",
                  color: "var(--color-ink-subtle)",
                }}
              >
                Deriving keys…
              </p>
            )}
          </form>
        )}
        {recoveryMessage && (
          <p
            style={{
              margin: 0,
              marginTop: "var(--spacing-3)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-microcaption)",
              color:
                recoveryMessage.kind === "ok"
                  ? "var(--color-mark-sealed)"
                  : "var(--color-danger)",
              lineHeight: 1.6,
            }}
          >
            {recoveryMessage.text}
            {recoveryMessage.kind === "ok" && (
              <>
                {" "}
                <a href="/inbox" style={linkStyle}>
                  View inbox →
                </a>
              </>
            )}
          </p>
        )}
        <div style={{ marginBottom: "var(--spacing-12)" }} />

        <h2 style={sectionStyle}>Storage</h2>
        {!persistSupported && (
          <p style={{ ...metaStyle, marginBottom: "var(--spacing-12)" }}>
            This browser doesn&apos;t expose persistent-storage APIs. Local data
            may be evicted under storage pressure. Keep your mnemonic backed up.
          </p>
        )}
        {persistSupported && persistGranted === true && (
          <p style={{ ...metaStyle, marginBottom: "var(--spacing-4)" }}>
            Persistent storage granted. The browser is committed to keeping your
            seed across sessions.
          </p>
        )}
        {persistSupported && persistGranted === false && persistAsked && (
          <p style={{ ...metaStyle, marginBottom: "var(--spacing-4)" }}>
            Browser hasn&apos;t granted persistent storage. Your seed may be
            evicted under storage pressure or after long inactivity. Back up
            your mnemonic.
          </p>
        )}
        {persistSupported && persistGranted === false && !persistAsked && (
          <p style={{ ...metaStyle, marginBottom: "var(--spacing-4)" }}>
            Persistent storage not yet requested. SendWyrd asks on first save.
          </p>
        )}
        {estimate && (
          <p
            style={{
              margin: 0,
              marginTop: "var(--spacing-2)",
              marginBottom: "var(--spacing-12)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-microcaption)",
              color: "var(--color-ink-subtle)",
            }}
          >
            using {formatBytes(estimate.usage)} of {formatBytes(estimate.quota)}{" "}
            ({estimate.percent.toFixed(2)}%)
          </p>
        )}
        {!estimate && persistSupported && (
          <div style={{ marginBottom: "var(--spacing-12)" }} />
        )}

        <h2 style={sectionStyle}>About</h2>
        <p style={{ ...metaStyle, marginBottom: "var(--spacing-12)" }}>
          SendWyrd v0.1 · MOP protocol v1
          <br />
          By{" "}
          <a
            href="https://x.com/deltaclimbs"
            style={linkStyle}
            rel="noreferrer"
          >
            @deltaclimbs
          </a>
        </p>

        <h2 style={{ ...sectionStyle, color: "var(--color-danger)" }}>
          Danger
        </h2>
        <button
          onClick={doForgetSeed}
          disabled={!hasSeed()}
          style={{
            padding: "var(--spacing-3) var(--spacing-6)",
            border: "1px solid var(--color-danger)",
            background: "transparent",
            color: "var(--color-danger)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-caption)",
            cursor: hasSeed() ? "pointer" : "not-allowed",
            opacity: hasSeed() ? 1 : 0.4,
          }}
        >
          Forget seed on this device
        </button>
      </section>
    </main>
  );
}

function NoMnemonicHelp({
  onRegenerate,
  onExportRaw,
}: {
  onRegenerate: () => void;
  onExportRaw: () => void;
}) {
  return (
    <div>
      <p style={{ ...metaStyleLocal, marginBottom: "var(--spacing-3)" }}>
        This seed was created before the mnemonic was being persisted. The
        mnemonic existed for one moment at generation; it&apos;s mathematically
        impossible to recover the words from the seed bytes (BIP-39 PBKDF2 is
        one-way).
      </p>
      <p style={{ ...metaStyleLocal, marginBottom: "var(--spacing-4)" }}>
        Two options:
      </p>
      <div
        style={{ display: "flex", gap: "var(--spacing-3)", flexWrap: "wrap" }}
      >
        <button onClick={onRegenerate} style={btnStyleLocal}>
          Regenerate seed
        </button>
        <button onClick={onExportRaw} style={btnStyleLocal}>
          Export raw seed (non-standard backup)
        </button>
      </div>
      <p
        style={{
          ...metaStyleLocal,
          marginTop: "var(--spacing-3)",
          color: "var(--color-ink-subtle)",
        }}
      >
        Regenerating creates a fresh BIP-39-backed seed. The downside: any wyrds
        you&apos;ve already published become unsigned-deletable and unfetchable
        for replies (the author key changes). For most early testing,
        regenerating is the right move.
      </p>
    </div>
  );
}

const metaStyleLocal: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  color: "var(--color-ink-muted)",
  lineHeight: 1.6,
};
const btnStyleLocal: React.CSSProperties = {
  padding: "var(--spacing-2) var(--spacing-5)",
  border: "1px solid var(--color-hairline-strong)",
  background: "transparent",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  cursor: "pointer",
};

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  html.classList.remove("dark", "light");
  if (theme === "dark") html.classList.add("dark");
  else if (theme === "light") html.classList.add("light");
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "var(--spacing-12) var(--spacing-6)",
  gap: "var(--spacing-12)",
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
const btnStyle: React.CSSProperties = {
  padding: "var(--spacing-3) var(--spacing-6)",
  border: "1px solid var(--color-hairline-strong)",
  background: "transparent",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
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
const linkStyle: React.CSSProperties = {
  color: "var(--color-accent)",
  textDecoration: "none",
};
