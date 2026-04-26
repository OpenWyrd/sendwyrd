"use client";

/**
 * Minimal top navigation: wordmark + three links.
 * Used on compose / view / inbox / settings. Landing and onboarding omit.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WyrdSigil } from "@/components/WyrdSigil";

const ITEMS: Array<{ href: string; label: string }> = [
  { href: "/compose", label: "compose" },
  { href: "/inbox", label: "inbox" },
  { href: "/settings", label: "settings" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        width: "100%",
        maxWidth: "var(--max-page)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--spacing-4)",
        paddingTop: "var(--spacing-6)",
        paddingBottom: "var(--spacing-6)",
        borderBottom: "1px solid var(--color-hairline)",
        marginBottom: "var(--spacing-8)",
      }}
    >
      <Link
        href="/compose"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-2)",
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-h3)",
          fontWeight: 600,
          color: "var(--color-ink)",
          textDecoration: "none",
          letterSpacing: "-0.01em",
        }}
      >
        <span aria-hidden="true" style={{ display: "inline-flex" }}>
          <WyrdSigil size={24} ariaLabel="" />
        </span>
        SendWyrd
      </Link>
      <ul
        style={{
          display: "flex",
          gap: "var(--spacing-6)",
          margin: 0,
          padding: 0,
          listStyle: "none",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption)",
        }}
      >
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                style={{
                  color: active ? "var(--color-ink)" : "var(--color-ink-muted)",
                  textDecoration: "none",
                  borderBottom: active
                    ? "1px solid var(--color-ink)"
                    : "1px solid transparent",
                  paddingBottom: 1,
                  transition: "color 120ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
