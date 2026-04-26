"use client";

/**
 * Segmented control — replaces native radios/checkboxes with hairline-bordered
 * pill segments. Modern minimal-aesthetic, matches visual_direction_v1.md
 * tokens. Native input is preserved off-screen for accessibility (keyboard +
 * screen readers).
 */

import type { ReactNode } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional accent color override for the selected pill text. */
  accent?: string;
}

interface SegmentedProps<T extends string> {
  name: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Layout: "row" (default) or "wrap" for many options on mobile. */
  layout?: "row" | "wrap";
  size?: "sm" | "md";
  /** ARIA label for the radio group. */
  ariaLabel?: string;
}

export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  layout = "row",
  size = "md",
  ariaLabel,
}: SegmentedProps<T>) {
  const padY = size === "sm" ? "var(--spacing-2)" : "var(--spacing-3)";
  const padX = size === "sm" ? "var(--spacing-3)" : "var(--spacing-4)";
  const fontSize =
    size === "sm" ? "var(--text-microcaption)" : "var(--text-caption)";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        flexWrap: layout === "wrap" ? "wrap" : "nowrap",
        gap: "-1px", // collapse adjacent borders
        border: "1px solid var(--color-hairline)",
        padding: 0,
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <label
            key={opt.value}
            style={{
              flex: layout === "wrap" ? "0 0 auto" : "1 1 auto",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              style={SR_ONLY}
            />
            <span
              style={{
                display: "block",
                padding: `${padY} ${padX}`,
                fontFamily: "var(--font-mono)",
                fontSize,
                lineHeight: 1.4,
                textAlign: "center",
                color: selected
                  ? (opt.accent ?? "var(--color-ink)")
                  : "var(--color-ink-muted)",
                background: selected ? "var(--color-surface)" : "transparent",
                borderRight:
                  i < options.length - 1
                    ? "1px solid var(--color-hairline)"
                    : "none",
                transition: "color 120ms cubic-bezier(0.4, 0, 0.2, 1)",
                whiteSpace: "nowrap",
              }}
            >
              {opt.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

interface ToggleProps {
  name: string;
  value: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
}

/** Boolean toggle styled like a 2-segment Segmented. "on" is default-left. */
export function Toggle({ name, value, onChange, ariaLabel }: ToggleProps) {
  return (
    <Segmented
      name={name}
      value={value ? "on" : "off"}
      options={[
        { value: "on", label: "on" },
        { value: "off", label: "off" },
      ]}
      onChange={(v) => onChange(v === "on")}
      size="sm"
      ariaLabel={ariaLabel}
    />
  );
}

const SR_ONLY: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};
