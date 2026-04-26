import { describe, expect, it } from "vitest";
import { buildFragmentUrl, parseWyrdUrl } from "../src/url.js";
import { HANDLE_CHARS, K_READ_CHARS } from "../src/types.js";

const HANDLE = "abcdefghij012345"; // 16 chars
const KREAD = "k".padEnd(K_READ_CHARS, "K"); // 43 chars

describe("url — parseWyrdUrl: fragment form", () => {
  it("parses canonical fragment URL", () => {
    const u = `https://sendwyrd.com/w/${HANDLE}#${KREAD}`;
    const r = parseWyrdUrl(u);
    expect(r).toEqual({ form: "fragment", handle: HANDLE, k_read: KREAD });
  });

  it("works with sendwyrd.app mirror host (host is irrelevant — pathname-driven)", () => {
    const u = `https://sendwyrd.app/w/${HANDLE}#${KREAD}`;
    const r = parseWyrdUrl(u);
    expect(r).toEqual({ form: "fragment", handle: HANDLE, k_read: KREAD });
  });

  it("rejects fragment URL with missing fragment", () => {
    const u = `https://sendwyrd.com/w/${HANDLE}`;
    const r = parseWyrdUrl(u);
    expect(r.form).toBe("invalid");
  });

  it("rejects fragment URL with too-short fragment", () => {
    const u = `https://sendwyrd.com/w/${HANDLE}#shortkey`;
    const r = parseWyrdUrl(u);
    expect(r.form).toBe("invalid");
  });

  it("rejects fragment URL with too-long fragment", () => {
    const u = `https://sendwyrd.com/w/${HANDLE}#${KREAD}xx`;
    const r = parseWyrdUrl(u);
    expect(r.form).toBe("invalid");
  });

  it("rejects fragment URL with non-base64url chars in fragment", () => {
    // Build a 43-char fragment that contains a '!' which is not in [A-Za-z0-9_-]
    const bad = "!".padEnd(K_READ_CHARS, "x");
    const u = `https://sendwyrd.com/w/${HANDLE}#${bad}`;
    const r = parseWyrdUrl(u);
    expect(r.form).toBe("invalid");
    if (r.form === "invalid") {
      expect(r.reason).toMatch(/fragment_not_base64url/);
    }
  });
});

describe("url — parseWyrdUrl: legacy public path form", () => {
  it("parses legacy /w/{handle}/k/{k_read} URL", () => {
    const u = `https://sendwyrd.com/w/${HANDLE}/k/${KREAD}`;
    const r = parseWyrdUrl(u);
    expect(r).toEqual({ form: "public", handle: HANDLE, k_read: KREAD });
  });

  it("rejects legacy URL with too-short k_read segment", () => {
    const u = `https://sendwyrd.com/w/${HANDLE}/k/short`;
    const r = parseWyrdUrl(u);
    expect(r.form).toBe("invalid");
  });
});

describe("url — parseWyrdUrl: malformed input", () => {
  it("rejects non-URL input", () => {
    const r = parseWyrdUrl("not even a url");
    expect(r.form).toBe("invalid");
    if (r.form === "invalid") {
      expect(r.reason).toBe("not_a_url");
    }
  });

  it("rejects URL with no /w/ path", () => {
    const r = parseWyrdUrl("https://sendwyrd.com/some/other/path");
    expect(r.form).toBe("invalid");
  });

  it("rejects URL with too-short handle", () => {
    const u = `https://sendwyrd.com/w/short#${KREAD}`;
    const r = parseWyrdUrl(u);
    expect(r.form).toBe("invalid");
  });

  it("rejects URL with too-long handle", () => {
    const longHandle = "a".repeat(HANDLE_CHARS + 5);
    const u = `https://sendwyrd.com/w/${longHandle}#${KREAD}`;
    const r = parseWyrdUrl(u);
    expect(r.form).toBe("invalid");
  });

  it("rejects URL with non-base64url chars in handle", () => {
    const u = `https://sendwyrd.com/w/!!!!!!!!!!!!!!!!#${KREAD}`;
    const r = parseWyrdUrl(u);
    expect(r.form).toBe("invalid");
  });

  it("returns invalid for empty string", () => {
    const r = parseWyrdUrl("");
    expect(r.form).toBe("invalid");
  });
});

describe("url — buildFragmentUrl", () => {
  it("produces the expected canonical string", () => {
    const u = buildFragmentUrl("https://sendwyrd.com", HANDLE, KREAD);
    expect(u).toBe(`https://sendwyrd.com/w/${HANDLE}#${KREAD}`);
  });

  it("works with arbitrary origin", () => {
    const u = buildFragmentUrl("http://localhost:3000", HANDLE, KREAD);
    expect(u).toBe(`http://localhost:3000/w/${HANDLE}#${KREAD}`);
  });
});

describe("url — round-trip", () => {
  it("parseWyrdUrl(buildFragmentUrl(...)) is an identity for fragment form", () => {
    const u = buildFragmentUrl("https://sendwyrd.com", HANDLE, KREAD);
    const r = parseWyrdUrl(u);
    expect(r).toEqual({ form: "fragment", handle: HANDLE, k_read: KREAD });
  });

  it("round-trips many distinct (handle, k_read) pairs", () => {
    for (let i = 0; i < 5; i++) {
      // Construct synthetic 16-char handle + 43-char k_read deterministically.
      const handle = `abcdefghijklmnop`
        .split("")
        .map((c, j) => (j === i ? "_" : c))
        .join("");
      const kread = "X".repeat(K_READ_CHARS - 1) + (i % 10).toString();
      expect(handle.length).toBe(HANDLE_CHARS);
      expect(kread.length).toBe(K_READ_CHARS);
      const u = buildFragmentUrl("https://sendwyrd.com", handle, kread);
      const r = parseWyrdUrl(u);
      expect(r).toEqual({ form: "fragment", handle, k_read: kread });
    }
  });
});
