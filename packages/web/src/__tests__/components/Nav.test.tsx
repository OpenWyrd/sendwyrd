/**
 * Nav — minimal top navigation. Wordmark + four links (compose / my wyrds /
 * about / settings). Active route is visually marked via inline style.
 *
 * Mocks `next/navigation`'s usePathname so we can drive route highlighting
 * deterministically.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

let mockPathname = "/compose";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { Nav } from "@/components/Nav";

function setPathname(p: string) {
  mockPathname = p;
}

describe("Nav", () => {
  it("renders the SendWyrd wordmark", () => {
    setPathname("/compose");
    render(<Nav />);
    const wordmark = screen.getByRole("link", { name: "SendWyrd" });
    expect(wordmark).toBeInTheDocument();
    expect(wordmark).toHaveAttribute("href", "/compose");
  });

  it("renders compose / my wyrds / about / settings links", () => {
    setPathname("/compose");
    render(<Nav />);
    expect(screen.getByRole("link", { name: "compose" })).toHaveAttribute(
      "href",
      "/compose",
    );
    expect(screen.getByRole("link", { name: "my wyrds" })).toHaveAttribute(
      "href",
      "/wyrds",
    );
    expect(screen.getByRole("link", { name: "about" })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.getByRole("link", { name: "settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("highlights the active route via underline border", () => {
    setPathname("/wyrds");
    render(<Nav />);
    const wyrdsLink = screen.getByRole("link", { name: "my wyrds" });
    // Active route gets a 1px solid var(--color-ink) bottom border.
    expect(wyrdsLink.style.borderBottom).toContain("var(--color-ink)");
    const composeLink = screen.getByRole("link", { name: "compose" });
    // Inactive route gets a transparent bottom border.
    expect(composeLink.style.borderBottom).toContain("transparent");
  });

  it("highlights settings when on /settings", () => {
    setPathname("/settings");
    cleanup();
    render(<Nav />);
    const settings = screen.getByRole("link", { name: "settings" });
    expect(settings.style.borderBottom).toContain("var(--color-ink)");
  });
});
