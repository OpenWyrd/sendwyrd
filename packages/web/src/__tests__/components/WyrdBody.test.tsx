/**
 * WyrdBody — body renderer per spec §6.2 + §8.1.
 *
 * Covers: plain text, https links, image / video / audio auto-embed,
 * sendwyrd:// transitive references against a populated ResolutionMap,
 * and missing/error/gone fallback states.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WyrdBody } from "@/components/WyrdBody";
import type { ResolutionMap } from "@/lib/resolveBody";

describe("WyrdBody — plain text", () => {
  it("renders plain text body verbatim", () => {
    render(<WyrdBody body="hello world" />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("preserves whitespace + multi-line text", () => {
    const { container } = render(<WyrdBody body={"line one\nline two"} />);
    expect(container.textContent).toContain("line one");
    expect(container.textContent).toContain("line two");
  });
});

describe("WyrdBody — https links", () => {
  it("renders an https URL as an anchor", () => {
    render(<WyrdBody body="see https://example.com for more" />);
    const link = screen.getByRole("link", { name: "https://example.com" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });
});

describe("WyrdBody — media auto-embed", () => {
  it("renders an image URL as an inline <img>", () => {
    const { container } = render(
      <WyrdBody body="here it is https://example.com/cat.jpg" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/cat.jpg");
    // hostname caption appears under the embed.
    expect(container.textContent).toContain("example.com");
  });

  it("renders a video URL as an inline <video> with <source>", () => {
    const { container } = render(
      <WyrdBody body="watch https://example.com/clip.mp4" />,
    );
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    const source = video?.querySelector("source");
    expect(source?.getAttribute("src")).toBe("https://example.com/clip.mp4");
  });

  it("renders an audio URL as an inline <audio>", () => {
    const { container } = render(
      <WyrdBody body="listen https://example.com/talk.mp3" />,
    );
    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
  });
});

describe("WyrdBody — sendwyrd:// transitive references", () => {
  const SENDWYRD_URL = "https://sendwyrd.com/w/AAAAAAAAAAAAAAAA";
  const SENDWYRD_HANDLE = "AAAAAAAAAAAAAAAA";

  it("renders an inline preview card when resolution is ready", () => {
    const transitives: ResolutionMap = {
      [SENDWYRD_URL]: {
        kind: "ready",
        handle: SENDWYRD_HANDLE,
        body: "the referenced wyrd body",
        published_at: 1_700_000_000_000,
        expires_at: 1_710_000_000_000,
      },
    };
    render(<WyrdBody body={`see ${SENDWYRD_URL}`} transitives={transitives} />);
    // Caption + body preview should both render.
    expect(screen.getByText(`wyrd · ${SENDWYRD_HANDLE}`)).toBeInTheDocument();
    expect(screen.getByText("the referenced wyrd body")).toBeInTheDocument();
  });

  it("truncates body preview at 100 codepoints with ellipsis", () => {
    const longBody = "a".repeat(150);
    const transitives: ResolutionMap = {
      [SENDWYRD_URL]: {
        kind: "ready",
        handle: SENDWYRD_HANDLE,
        body: longBody,
        published_at: 0,
        expires_at: 0,
      },
    };
    const { container } = render(
      <WyrdBody body={`see ${SENDWYRD_URL}`} transitives={transitives} />,
    );
    expect(container.textContent).toContain("a".repeat(100) + "…");
    expect(container.textContent).not.toContain("a".repeat(101));
  });

  it("renders 'gone' fallback when reference is burned", () => {
    const transitives: ResolutionMap = {
      [SENDWYRD_URL]: {
        kind: "gone",
        handle: SENDWYRD_HANDLE,
        reason: "burned",
        gone_at: "2026-01-01T00:00:00Z",
      },
    };
    render(<WyrdBody body={`see ${SENDWYRD_URL}`} transitives={transitives} />);
    expect(screen.getByText(/withdrawn by its author/i)).toBeInTheDocument();
  });

  it("renders expired-style 'gone' fallback for non-burned reason", () => {
    const transitives: ResolutionMap = {
      [SENDWYRD_URL]: {
        kind: "gone",
        handle: SENDWYRD_HANDLE,
        reason: "expired",
        gone_at: "2026-01-01T00:00:00Z",
      },
    };
    render(<WyrdBody body={`see ${SENDWYRD_URL}`} transitives={transitives} />);
    expect(screen.getByText(/time is up/i)).toBeInTheDocument();
  });

  it("renders 'unavailable' link fallback when resolution is missing", () => {
    const transitives: ResolutionMap = {
      [SENDWYRD_URL]: { kind: "missing", handle: SENDWYRD_HANDLE },
    };
    render(<WyrdBody body={`see ${SENDWYRD_URL}`} transitives={transitives} />);
    const link = screen.getByRole("link");
    expect(link.textContent).toMatch(/unavailable/i);
  });

  it("renders 'unavailable' link fallback when resolution errored", () => {
    const transitives: ResolutionMap = {
      [SENDWYRD_URL]: { kind: "error", handle: SENDWYRD_HANDLE },
    };
    render(<WyrdBody body={`see ${SENDWYRD_URL}`} transitives={transitives} />);
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it("renders bare link when resolution map has no entry (loading)", () => {
    render(<WyrdBody body={`see ${SENDWYRD_URL}`} transitives={{}} />);
    // Should still render an anchor; no preview card markup.
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]?.textContent).toBe(SENDWYRD_URL);
  });
});
