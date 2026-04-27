/**
 * WyrdBody — body renderer per spec §6.2 + §8.1.
 *
 * Covers: plain text, https links, image / video / audio auto-embed,
 * sendwyrd:// transitive references against a populated ResolutionMap,
 * and missing/error/gone fallback states.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("WyrdBody — lightning chips", () => {
  it("renders a BOLT11 invoice as a labelled chip with copy + lightning: link", () => {
    const invoice =
      "lnbc1500n1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w";
    render(<WyrdBody body={`tip: ${invoice}`} />);
    const link = screen.getByRole("link", { name: "BOLT11 invoice" });
    expect(link).toHaveAttribute("href", `lightning:${invoice}`);
    expect(
      screen.getByRole("button", { name: /copy BOLT11/i }),
    ).toBeInTheDocument();
  });

  it("renders an LNURL chip with the LNURL label", () => {
    const lnurl =
      "lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns";
    render(<WyrdBody body={`pay: ${lnurl}`} />);
    expect(
      screen.getByRole("link", { name: "LNURL" }),
    ).toBeInTheDocument();
  });

  it("renders an allowlisted Lightning address as a chip", () => {
    render(<WyrdBody body="tip mike@getalby.com please" />);
    const link = screen.getByRole("link", { name: "lightning address" });
    expect(link).toHaveAttribute("href", "lightning:mike@getalby.com");
  });

  it("renders a bare BTC bech32 address as a chip", () => {
    const addr = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
    render(<WyrdBody body={`donate ${addr} thanks`} />);
    const link = screen.getByRole("link", { name: "BTC address" });
    expect(link).toHaveAttribute("href", `bitcoin:${addr}`);
  });

  it("toggles inline QR rendering on chip click", async () => {
    const user = userEvent.setup();
    const addr = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
    const { container } = render(<WyrdBody body={addr} />);
    // QR button visible; QR SVG not yet rendered
    const qrBtn = screen.getByRole("button", { name: /show QR for BTC/i });
    expect(container.querySelector("svg")).toBeNull();
    await user.click(qrBtn);
    // After click, an SVG appears in the DOM
    expect(container.querySelector("svg")).not.toBeNull();
    // Toggle back
    expect(
      screen.getByRole("button", { name: /hide QR for BTC/i }),
    ).toBeInTheDocument();
  });
});
