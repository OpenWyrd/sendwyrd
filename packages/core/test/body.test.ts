import { describe, expect, it } from "vitest";
import {
  countCountableCodepoints,
  parseBody,
  parseSendwyrdUrl,
} from "../src/body.js";
import { BODY_CODEPOINT_CAP } from "../src/types.js";

describe("body — parseBody segmentation", () => {
  it("returns a single text segment for plain prose with no URLs", () => {
    const segs = parseBody("hello world, no URLs here");
    expect(segs).toEqual([
      { kind: "text", value: "hello world, no URLs here" },
    ]);
  });

  it("returns no segments for an empty body", () => {
    const segs = parseBody("");
    expect(segs).toEqual([]);
  });

  it("classifies an https:// URL as 'link'", () => {
    const segs = parseBody("https://example.com/page");
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({
      kind: "url",
      url: "https://example.com/page",
      type: "link",
      hostname: "example.com",
    });
  });

  it("classifies image URLs by extension", () => {
    for (const ext of ["jpg", "jpeg", "png", "gif", "webp", "avif", "heic"]) {
      const segs = parseBody(`https://cdn.example.com/photo.${ext}`);
      expect(segs[0]).toMatchObject({ kind: "url", type: "image" });
    }
  });

  it("classifies video URLs by extension", () => {
    for (const ext of ["mp4", "webm", "mov"]) {
      const segs = parseBody(`https://cdn.example.com/clip.${ext}`);
      expect(segs[0]).toMatchObject({ kind: "url", type: "video" });
    }
  });

  it("classifies audio URLs by extension", () => {
    for (const ext of ["mp3", "wav", "ogg", "opus"]) {
      const segs = parseBody(`https://cdn.example.com/song.${ext}`);
      expect(segs[0]).toMatchObject({ kind: "url", type: "audio" });
    }
  });

  it("classifies sendwyrd:// URLs as 'sendwyrd'", () => {
    const u = "sendwyrd://w/abcdefghij012345";
    const segs = parseBody(u);
    expect(segs[0]).toMatchObject({ kind: "url", type: "sendwyrd" });
  });

  it("classifies https://sendwyrd.com/w/{handle}... as 'sendwyrd'", () => {
    const u = "https://sendwyrd.com/w/abcdefghij012345";
    const segs = parseBody(u);
    expect(segs[0]).toMatchObject({ kind: "url", type: "sendwyrd" });
  });

  it("classifies https://sendwyrd.app mirror similarly", () => {
    const u = "https://sendwyrd.app/w/abcdefghij012345";
    const segs = parseBody(u);
    expect(segs[0]).toMatchObject({ kind: "url", type: "sendwyrd" });
  });

  it("interleaves text and URL segments correctly", () => {
    const body = "hello https://example.com/foo and goodbye";
    const segs = parseBody(body);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ kind: "text", value: "hello " });
    expect(segs[1]).toMatchObject({
      kind: "url",
      url: "https://example.com/foo",
      hostname: "example.com",
    });
    expect(segs[2]).toEqual({ kind: "text", value: " and goodbye" });
  });

  it("strips trailing punctuation from a URL", () => {
    // The parser strips the trailing '.' from the URL itself; the punctuation
    // is left in the prose stream as a text segment after the URL.
    const segs = parseBody("see this: https://example.com/page.");
    const urlSegs = segs.filter((s) => s.kind === "url");
    expect(urlSegs).toHaveLength(1);
    expect(urlSegs[0]).toMatchObject({
      kind: "url",
      url: "https://example.com/page",
    });
    // Trailing '.' is preserved as text after the URL.
    const lastSeg = segs[segs.length - 1]!;
    expect(lastSeg.kind).toBe("text");
    if (lastSeg.kind === "text") {
      expect(lastSeg.value).toBe(".");
    }
  });

  it("emits multiple URLs in order", () => {
    const body = "first https://a.example.com second https://b.example.com end";
    const segs = parseBody(body);
    const urls = segs
      .filter((s) => s.kind === "url")
      .map((s) => (s as { url: string }).url);
    expect(urls).toEqual(["https://a.example.com", "https://b.example.com"]);
  });
});

describe("body — bare-domain detection (no scheme)", () => {
  it("recognizes a lowercase bare domain as a link", () => {
    const segs = parseBody("visit example.com soon");
    expect(segs).toHaveLength(3);
    expect(segs[1]).toMatchObject({
      kind: "url",
      url: "example.com",
      href: "https://example.com",
      type: "link",
      hostname: "example.com",
    });
  });

  it("recognizes a bare subdomain with path", () => {
    const segs = parseBody("at www.example.com/path/here right now");
    const urlSegs = segs.filter((s) => s.kind === "url");
    expect(urlSegs).toHaveLength(1);
    expect(urlSegs[0]).toMatchObject({
      url: "www.example.com/path/here",
      href: "https://www.example.com/path/here",
      hostname: "www.example.com",
    });
  });

  it("recognizes a bare multi-label TLD (e.g. .co.uk)", () => {
    const segs = parseBody("see example.co.uk for info");
    const urlSegs = segs.filter((s) => s.kind === "url");
    expect(urlSegs).toHaveLength(1);
    expect(urlSegs[0]).toMatchObject({
      url: "example.co.uk",
      href: "https://example.co.uk",
    });
  });

  it("does NOT match Mr.Smith (uppercase rules out bare-domain interpretation)", () => {
    const segs = parseBody("Mr.Smith said hello");
    const urlSegs = segs.filter((s) => s.kind === "url");
    expect(urlSegs).toHaveLength(0);
  });

  it("does NOT match an email-like local@host", () => {
    const segs = parseBody("contact alice@example.com about it");
    const urlSegs = segs.filter((s) => s.kind === "url");
    expect(urlSegs).toHaveLength(0);
  });

  it("does NOT match a sentence-end period followed by a word", () => {
    // "etc.com" would be valid bare-domain; we accept that as a corner case.
    // But "etc. Other" must NOT match because the period is a sentence break.
    const segs = parseBody("End of sentence. Other thing");
    const urlSegs = segs.filter((s) => s.kind === "url");
    expect(urlSegs).toHaveLength(0);
  });

  it("classifies a bare image URL by extension", () => {
    const segs = parseBody("see cdn.example.com/photo.jpg");
    const urlSegs = segs.filter((s) => s.kind === "url");
    expect(urlSegs[0]).toMatchObject({
      kind: "url",
      type: "image",
      hostname: "cdn.example.com",
    });
  });

  it("strips trailing punctuation from a bare domain", () => {
    const segs = parseBody("visit example.com.");
    const urlSegs = segs.filter((s) => s.kind === "url");
    expect(urlSegs).toHaveLength(1);
    expect(urlSegs[0]).toMatchObject({ url: "example.com" });
    const lastSeg = segs[segs.length - 1]!;
    expect(lastSeg.kind).toBe("text");
  });

  it("scheme-prefixed URL takes precedence over bare-domain match", () => {
    const segs = parseBody("https://example.com/path");
    const urlSegs = segs.filter((s) => s.kind === "url");
    expect(urlSegs).toHaveLength(1);
    expect(urlSegs[0]).toMatchObject({
      url: "https://example.com/path",
      href: "https://example.com/path",
    });
  });
});

describe("body — countCountableCodepoints", () => {
  it("returns 0 for empty string", () => {
    expect(countCountableCodepoints("")).toBe(0);
  });

  it("counts ASCII text by codepoint", () => {
    expect(countCountableCodepoints("hello")).toBe(5);
  });

  it("excludes URL chars from the count (URLs are 0 codepoints)", () => {
    const body = "see https://example.com/foo here";
    // text segments: "see " (4) + " here" (5) = 9 codepoints
    expect(countCountableCodepoints(body)).toBe(9);
  });

  it("returns 0 for body that is only a URL", () => {
    expect(countCountableCodepoints("https://example.com")).toBe(0);
  });

  it("counts emoji and CJK as one codepoint each (when single-codepoint)", () => {
    // 'a' (1) + emoji 👋 (1 codepoint, U+1F44B) + ' ' (1) + 你 (1) = 4
    expect(countCountableCodepoints("a👋 你")).toBe(4);
  });

  it("counts each codepoint in ZWJ-joined emoji separately (we count codepoints, not graphemes)", () => {
    // family emoji 👨‍👩‍👧 = man + ZWJ + woman + ZWJ + girl = 5 codepoints
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";
    expect(countCountableCodepoints(family)).toBe(5);
  });

  it("counts a body at exactly 300 codepoints (the cap)", () => {
    expect(countCountableCodepoints("a".repeat(BODY_CODEPOINT_CAP))).toBe(300);
  });

  it("BODY_CODEPOINT_CAP is 300 (per spec)", () => {
    expect(BODY_CODEPOINT_CAP).toBe(300);
  });

  it("does NOT enforce the cap in parseBody (parser is total, cap is enforced at compose-time)", () => {
    // 400 codepoints: parser still returns segments; no throw.
    const long = "a".repeat(400);
    const segs = parseBody(long);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ kind: "text", value: long });
    // The count exceeds the cap, but the parser doesn't reject it.
    expect(countCountableCodepoints(long)).toBe(400);
  });
});

describe("body — parseSendwyrdUrl", () => {
  const HANDLE = "abcdefghij012345";
  const KREAD = "k".padEnd(43, "K");

  it("parses sendwyrd:// fragment form", () => {
    const r = parseSendwyrdUrl(`sendwyrd://w/${HANDLE}#${KREAD}`);
    expect(r).toEqual({ handle: HANDLE, k_read: KREAD, form: "fragment" });
  });

  it("parses sendwyrd:// path form", () => {
    const r = parseSendwyrdUrl(`sendwyrd://w/${HANDLE}/k/${KREAD}`);
    expect(r).toEqual({ handle: HANDLE, k_read: KREAD, form: "public" });
  });

  it("parses https://sendwyrd.com fragment form", () => {
    const r = parseSendwyrdUrl(`https://sendwyrd.com/w/${HANDLE}#${KREAD}`);
    expect(r).toEqual({ handle: HANDLE, k_read: KREAD, form: "fragment" });
  });

  it("parses https://sendwyrd.com path form", () => {
    const r = parseSendwyrdUrl(`https://sendwyrd.com/w/${HANDLE}/k/${KREAD}`);
    expect(r).toEqual({ handle: HANDLE, k_read: KREAD, form: "public" });
  });

  it("parses https://sendwyrd.app mirror", () => {
    const r = parseSendwyrdUrl(`https://sendwyrd.app/w/${HANDLE}#${KREAD}`);
    expect(r).toEqual({ handle: HANDLE, k_read: KREAD, form: "fragment" });
  });

  it("returns null for unrelated host", () => {
    const r = parseSendwyrdUrl(`https://example.com/w/${HANDLE}#${KREAD}`);
    expect(r).toBe(null);
  });

  it("returns null for non-URL", () => {
    const r = parseSendwyrdUrl("not a url");
    expect(r).toBe(null);
  });

  it("returns null for invalid handle length", () => {
    const r = parseSendwyrdUrl(`sendwyrd://w/short#${KREAD}`);
    expect(r).toBe(null);
  });

  it("returns null when fragment k_read is wrong length", () => {
    const r = parseSendwyrdUrl(`sendwyrd://w/${HANDLE}#tooshort`);
    expect(r).toBe(null);
  });
});
