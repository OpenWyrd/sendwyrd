/**
 * PrivacyIndicator — monomorphic sealed-glyph indicator.
 *
 * Per ADR-019/021: every wyrd is sealed. The indicator should render the
 * lock SVG with an aria-label of "Sealed", a tooltip mentioning "Sealed",
 * and color tokenized to --color-mark-sealed.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrivacyIndicator, SealedGlyph } from "@/components/PrivacyIndicator";

describe("PrivacyIndicator", () => {
  it("renders the SealedGlyph SVG with role=img", () => {
    render(<PrivacyIndicator />);
    const svgs = screen.getAllByRole("img", { name: /sealed/i });
    // Wrapper span gets aria-label too; svg gets role=img + aria-label.
    expect(svgs.length).toBeGreaterThanOrEqual(1);
    const svg = svgs.find((el) => el.tagName.toLowerCase() === "svg");
    expect(svg).toBeInTheDocument();
  });

  it("has tooltip text containing 'Sealed'", () => {
    const { container } = render(<PrivacyIndicator />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.getAttribute("title")).toMatch(/Sealed/);
  });

  it("has aria-label of 'Sealed' on the wrapper", () => {
    const { container } = render(<PrivacyIndicator />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute("aria-label")).toBe("Sealed");
  });

  it("color is set to var(--color-mark-sealed)", () => {
    const { container } = render(<PrivacyIndicator />);
    const wrapper = container.firstElementChild as HTMLElement;
    // jsdom preserves the inline style string verbatim.
    expect(wrapper.style.color).toContain("--color-mark-sealed");
  });
});

describe("SealedGlyph", () => {
  it("respects custom size prop", () => {
    const { container } = render(<SealedGlyph size={32} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });

  it("falls back to size=18 by default", () => {
    const { container } = render(<SealedGlyph />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("18");
  });

  it("renders shackle path + body rect", () => {
    const { container } = render(<SealedGlyph />);
    const svg = container.querySelector("svg")!;
    expect(svg.querySelector("path")).not.toBeNull();
    expect(svg.querySelector("rect")).not.toBeNull();
  });
});
