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

  it("excludes BOLT11 invoices from the codepoint count", () => {
    const invoice =
      "lnbc1500n1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w";
    const body = `tip me here: ${invoice} thanks`;
    // text: "tip me here: " (13) + " thanks" (7) = 20
    expect(countCountableCodepoints(body)).toBe(20);
    const segs = parseBody(body);
    const ln = segs.find((s) => s.kind === "lightning");
    expect(ln).toBeDefined();
    if (ln && ln.kind === "lightning") {
      expect(ln.type).toBe("bolt11");
      expect(ln.payload).toBe(invoice);
    }
  });

  it("excludes BOLT12 offers from the codepoint count", () => {
    // synthetic but well-formed bech32 prefix + 60 chars of valid charset
    const offer =
      "lno1qcp4256ypqpq86q2pucnq42ngssx2an9wfujqerp0yg069nfm2zlqqqsyqcyq5rqwzqfqqq";
    const body = `pay this offer ${offer} please`;
    expect(countCountableCodepoints(body)).toBe("pay this offer  please".length);
    const segs = parseBody(body);
    const ln = segs.find((s) => s.kind === "lightning");
    expect(ln).toBeDefined();
    if (ln && ln.kind === "lightning") {
      expect(ln.type).toBe("bolt12");
    }
  });

  it("excludes LNURL strings from the codepoint count", () => {
    const lnurl =
      "lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns";
    const body = `here: ${lnurl}`;
    expect(countCountableCodepoints(body)).toBe("here: ".length);
    const segs = parseBody(body);
    const ln = segs.find((s) => s.kind === "lightning");
    expect(ln && ln.kind === "lightning" && ln.type).toBe("lnurl");
  });

  it("recognizes the lightning: URI scheme as a single token", () => {
    const uri = "lightning:lnbc1pvjluez";
    const body = `pay ${uri} now`;
    const segs = parseBody(body);
    const ln = segs.find((s) => s.kind === "lightning");
    expect(ln && ln.kind === "lightning" && ln.type).toBe("uri");
    if (ln && ln.kind === "lightning") {
      expect(ln.href).toBe(uri);
    }
    // text: "pay " (4) + " now" (4) = 8
    expect(countCountableCodepoints(body)).toBe(8);
  });

  it("does not collide with bare-domain detection (lnbc... has no dots)", () => {
    const body =
      "lnbc500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqyq";
    const segs = parseBody(body);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.kind).toBe("lightning");
  });

  it("detects allowlisted Lightning addresses (getalby.com)", () => {
    const body = "tip me at mike@getalby.com please";
    const segs = parseBody(body);
    const ln = segs.find((s) => s.kind === "lightning");
    expect(ln && ln.kind === "lightning" && ln.type).toBe("address");
    if (ln && ln.kind === "lightning") {
      expect(ln.payload).toBe("mike@getalby.com");
      expect(ln.href).toBe("lightning:mike@getalby.com");
    }
    expect(countCountableCodepoints(body)).toBe(
      "tip me at  please".length, // 17
    );
  });

  it("detects all dominant LN address providers", () => {
    const providers = [
      "user@getalby.com",
      "user@walletofsatoshi.com",
      "user@strike.me",
      "user@coinos.io",
      "user@mutinywallet.com",
      "user@blink.sv",
      "user@phoenix.acinq.co",
      "user@sats.mobi",
      "user@bitnob.com",
      "user@primal.net",
    ];
    for (const p of providers) {
      const segs = parseBody(p);
      const ln = segs.find((s) => s.kind === "lightning");
      expect(
        ln && ln.kind === "lightning" && ln.type === "address",
        `expected lightning address for ${p}`,
      ).toBe(true);
    }
  });

  it("does NOT detect off-allowlist email-shape strings as Lightning", () => {
    const body = "email me at alice@gmail.com or bob@example.org";
    const segs = parseBody(body);
    expect(segs.find((s) => s.kind === "lightning")).toBeUndefined();
    // alice@gmail.com isn't a URL either (negative-lookbehind on @ blocks
    // bare-domain match). Whole body should be a single text segment.
    expect(segs).toHaveLength(1);
    expect(segs[0]?.kind).toBe("text");
  });

  it("detects bare email + lightning: prefix as a Lightning URI (off-list opt-in)", () => {
    const body = "tip lightning:alice@my-self-hosted.example.com here";
    const segs = parseBody(body);
    const ln = segs.find((s) => s.kind === "lightning");
    expect(ln && ln.kind === "lightning" && ln.type).toBe("uri");
  });
});

describe("body — Bitcoin detection", () => {
  it("detects bech32 native segwit addresses (bc1q...)", () => {
    const addr = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
    const body = `pay to ${addr} please`;
    const segs = parseBody(body);
    const btc = segs.find((s) => s.kind === "bitcoin");
    expect(btc && btc.kind === "bitcoin" && btc.type).toBe("bech32");
    if (btc && btc.kind === "bitcoin") {
      expect(btc.payload).toBe(addr);
      expect(btc.href).toBe(`bitcoin:${addr}`);
    }
    expect(countCountableCodepoints(body)).toBe("pay to  please".length);
  });

  it("detects bech32m taproot addresses (bc1p...)", () => {
    const addr =
      "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0";
    const segs = parseBody(addr);
    const btc = segs.find((s) => s.kind === "bitcoin");
    expect(btc && btc.kind === "bitcoin" && btc.type === "bech32").toBe(true);
  });

  it("detects testnet (tb1...) addresses", () => {
    const addr = "tb1q0sqzfp3zj42u0perxr6jahhu4y03uw4dypk6sc";
    const segs = parseBody(addr);
    const btc = segs.find((s) => s.kind === "bitcoin");
    expect(btc && btc.kind === "bitcoin" && btc.type === "bech32").toBe(true);
  });

  it("detects bare legacy P2PKH addresses (1...)", () => {
    const addr = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
    const segs = parseBody(`donate ${addr} thanks`);
    const btc = segs.find((s) => s.kind === "bitcoin");
    expect(btc && btc.kind === "bitcoin" && btc.type).toBe("legacy");
  });

  it("detects bare legacy P2SH addresses (3...)", () => {
    const addr = "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy";
    const segs = parseBody(addr);
    const btc = segs.find((s) => s.kind === "bitcoin");
    expect(btc && btc.kind === "bitcoin" && btc.type === "legacy").toBe(true);
  });

  it("detects the bitcoin: URI scheme with BIP-21 query params", () => {
    const uri = "bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.001&label=tip";
    const segs = parseBody(`pay ${uri}`);
    const btc = segs.find((s) => s.kind === "bitcoin");
    expect(btc && btc.kind === "bitcoin" && btc.type).toBe("uri");
    if (btc && btc.kind === "bitcoin") {
      expect(btc.href).toBe(uri); // URI passed through unchanged
      expect(btc.address).toBe("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
      expect(btc.amount).toBe("0.001");
      expect(btc.label).toBe("tip");
    }
  });

  it("parses BIP-21 message param (URL-decoded)", () => {
    const uri = "bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.5&message=coffee%20fund";
    const segs = parseBody(uri);
    const btc = segs.find((s) => s.kind === "bitcoin");
    if (btc && btc.kind === "bitcoin") {
      expect(btc.amount).toBe("0.5");
      expect(btc.message).toBe("coffee fund");
    }
  });

  it("bare bech32 address has address === payload, no params", () => {
    const addr = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
    const segs = parseBody(addr);
    const btc = segs.find((s) => s.kind === "bitcoin");
    if (btc && btc.kind === "bitcoin") {
      expect(btc.address).toBe(addr);
      expect(btc.amount).toBeUndefined();
      expect(btc.label).toBeUndefined();
    }
  });

  it("bitcoin: URI without query string still parses (no params)", () => {
    const uri = "bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
    const segs = parseBody(uri);
    const btc = segs.find((s) => s.kind === "bitcoin");
    if (btc && btc.kind === "bitcoin") {
      expect(btc.address).toBe("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
      expect(btc.amount).toBeUndefined();
    }
  });

  it("excludes Bitcoin tokens from the codepoint count", () => {
    const addr = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
    const body = `tip ${addr} thanks`;
    expect(countCountableCodepoints(body)).toBe("tip  thanks".length); // 11
  });

  it("does not collide with prose words (3-letter words don't match legacy)", () => {
    const segs = parseBody("the cat ate 3 fish");
    expect(segs.find((s) => s.kind === "bitcoin")).toBeUndefined();
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
