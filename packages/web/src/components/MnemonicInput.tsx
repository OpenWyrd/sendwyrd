"use client";

/**
 * Boxed mnemonic input with per-word autocomplete from the BIP-39 English
 * wordlist. Eliminates the comma/space brittleness of a single textarea:
 * each word lives in its own box, the user can type a prefix and pick from
 * the 2048-word vocabulary, and pastes of an entire phrase distribute
 * across boxes.
 *
 * Props.value is the joined "word1 word2 …" string, so the component is a
 * drop-in replacement for the textarea wherever a mnemonic is collected.
 *
 * Validation is per-box: empty → neutral, in-wordlist → quiet success,
 * non-empty + not-in-wordlist → danger underline. The parent decides
 * whether the full phrase is a valid mnemonic (checksum) — that's a
 * different question than per-word membership.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { BIP39_ENGLISH_WORDLIST } from "@sendwyrd/core";

interface Props {
  value: string;
  onChange: (value: string) => void;
  wordCount?: 12 | 24;
  disabled?: boolean;
}

const MAX_SUGGESTIONS = 8;

export function MnemonicInput({
  value,
  onChange,
  wordCount = 12,
  disabled = false,
}: Props) {
  const words = useMemo(() => splitToBoxes(value, wordCount), [value, wordCount]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [highlight, setHighlight] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const activeWord = activeIndex !== null ? words[activeIndex] ?? "" : "";
  const suggestions = useMemo(
    () => filterWordlist(activeWord),
    [activeWord],
  );

  // Reset the highlight cursor whenever the suggestion list changes.
  useEffect(() => {
    setHighlight(0);
  }, [activeIndex, activeWord]);

  function emit(next: string[]) {
    onChange(next.join(" ").replace(/ +$/g, ""));
  }

  function setWordAt(i: number, raw: string) {
    const cleaned = raw.toLowerCase().replace(/[^a-z]/g, "");
    const next = [...words];
    next[i] = cleaned;
    emit(next);
  }

  function commitSuggestion(i: number, suggestion: string) {
    const next = [...words];
    next[i] = suggestion;
    emit(next);
    // Advance focus to the next empty box, wrapping isn't useful.
    const target = inputRefs.current[i + 1];
    if (target) target.focus();
  }

  function handlePaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").trim();
    if (!text) return;
    const tokens = text
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((t) => /^[a-z]+$/.test(t));
    if (tokens.length <= 1) return; // single word: let default paste behavior fire
    e.preventDefault();
    const next = [...words];
    for (let k = 0; k < tokens.length && i + k < wordCount; k++) {
      next[i + k] = tokens[k] ?? "";
    }
    emit(next);
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if ((e.key === "Enter" || e.key === "Tab") && suggestions.length > 0 && words[i]) {
      // Auto-complete to the highlighted suggestion when the user has typed
      // something and a match exists. Tab also advances focus naturally.
      const pick = suggestions[highlight] ?? suggestions[0];
      if (pick && pick !== words[i]) {
        e.preventDefault();
        commitSuggestion(i, pick);
        return;
      }
    }
    if (e.key === "Backspace" && !words[i] && i > 0) {
      e.preventDefault();
      const target = inputRefs.current[i - 1];
      if (target) target.focus();
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "var(--spacing-3)",
      }}
      onBlur={(e) => {
        // Closing the dropdown when focus leaves the entire grid.
        const next = e.relatedTarget as Node | null;
        if (!next || !(e.currentTarget as Node).contains(next)) {
          setActiveIndex(null);
        }
      }}
    >
      {Array.from({ length: wordCount }, (_, i) => {
        const word = words[i] ?? "";
        const validity =
          word.length === 0
            ? "empty"
            : BIP39_ENGLISH_WORDLIST.includes(word)
              ? "valid"
              : "invalid";
        const showSuggestions =
          activeIndex === i && word.length > 0 && validity !== "valid";
        return (
          <div key={i} style={{ position: "relative" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "var(--spacing-2)",
                paddingBottom: "var(--spacing-1)",
                borderBottom: `1px solid ${borderForValidity(validity)}`,
                cursor: "text",
              }}
              onClick={() => inputRefs.current[i]?.focus()}
            >
              <span
                style={{
                  color: "var(--color-ink-subtle)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-microcaption)",
                  minWidth: 22,
                  fontVariantNumeric: "tabular-nums",
                  userSelect: "none",
                }}
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <input
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={disabled}
                value={word}
                onFocus={() => setActiveIndex(i)}
                onChange={(e) => setWordAt(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={(e) => handlePaste(i, e)}
                aria-label={`Word ${i + 1}`}
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--color-ink)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-body)",
                  padding: "var(--spacing-1) 0",
                }}
              />
            </div>
            {showSuggestions && (
              <ul
                role="listbox"
                aria-label={`Suggestions for word ${i + 1}`}
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  margin: 0,
                  marginTop: "var(--spacing-1)",
                  padding: 0,
                  listStyle: "none",
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-hairline-strong)",
                  maxHeight: 220,
                  overflowY: "auto",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-caption)",
                }}
              >
                {suggestions.map((s, k) => (
                  <li key={s}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={k === highlight}
                      onMouseDown={(e) => {
                        // mouseDown (not click) so we beat the input's blur.
                        e.preventDefault();
                        commitSuggestion(i, s);
                      }}
                      onMouseEnter={() => setHighlight(k)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding:
                          "var(--spacing-2) var(--spacing-3)",
                        background:
                          k === highlight
                            ? "var(--color-surface)"
                            : "transparent",
                        border: "none",
                        color: "var(--color-ink)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-caption)",
                        cursor: "pointer",
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function splitToBoxes(value: string, count: number): string[] {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  const out = new Array(count).fill("");
  for (let i = 0; i < Math.min(tokens.length, count); i++) {
    out[i] = tokens[i]!.toLowerCase();
  }
  return out;
}

function filterWordlist(prefix: string): string[] {
  if (!prefix) return [];
  const out: string[] = [];
  for (const word of BIP39_ENGLISH_WORDLIST) {
    if (word.startsWith(prefix)) {
      out.push(word);
      if (out.length >= MAX_SUGGESTIONS) break;
    }
  }
  return out;
}

function borderForValidity(v: "empty" | "valid" | "invalid"): string {
  if (v === "invalid") return "var(--color-danger)";
  if (v === "valid") return "var(--color-mark-sealed)";
  return "var(--color-hairline)";
}
