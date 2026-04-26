/**
 * rateLimit helper — exercised through a tiny Hono app so the Context
 * shape is real, not mocked. Each test installs its own RateLimit binding
 * (or omits one) and asserts on the Response that comes back.
 */

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { rateLimit, clientIp } from "../src/rateLimit.js";
import type { Env, RateLimit } from "../src/env.js";

type App = Hono<{ Bindings: Env }>;

function app(bucket: keyof Env): App {
  const a = new Hono<{ Bindings: Env }>();
  a.get("/", async (c) => {
    const rl = await rateLimit(
      c,
      bucket as Parameters<typeof rateLimit>[1],
      clientIp(c),
    );
    return rl ?? c.text("ok");
  });
  return a;
}

function fakeLimiter(success: boolean): RateLimit {
  return { limit: vi.fn().mockResolvedValue({ success }) };
}

function envWith(overrides: Partial<Env> = {}): Env {
  return {
    BLOBS: {} as Env["BLOBS"],
    PROTOCOL_VERSION: "1",
    WEB_ORIGIN: "https://sendwyrd.com",
    DATABASE_URL: "",
    ...overrides,
  };
}

describe("clientIp", () => {
  it("returns CF-Connecting-IP when present", async () => {
    const a = new Hono<{ Bindings: Env }>();
    let captured: string | undefined;
    a.get("/", (c) => {
      captured = clientIp(c);
      return c.text("ok");
    });
    await a.fetch(
      new Request("http://t/", {
        headers: { "CF-Connecting-IP": "203.0.113.7" },
      }),
      envWith(),
    );
    expect(captured).toBe("203.0.113.7");
  });

  it('falls back to "unknown" when header is absent', async () => {
    const a = new Hono<{ Bindings: Env }>();
    let captured: string | undefined;
    a.get("/", (c) => {
      captured = clientIp(c);
      return c.text("ok");
    });
    await a.fetch(new Request("http://t/"), envWith());
    expect(captured).toBe("unknown");
  });
});

describe("rateLimit", () => {
  it("fails open when binding is undefined (local dev / tests)", async () => {
    const res = await app("RL_WRITE").fetch(
      new Request("http://t/"),
      envWith(/* no RL_WRITE */),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("passes through when limiter says success", async () => {
    const limiter = fakeLimiter(true);
    const res = await app("RL_WRITE").fetch(
      new Request("http://t/", { headers: { "CF-Connecting-IP": "1.2.3.4" } }),
      envWith({ RL_WRITE: limiter }),
    );
    expect(res.status).toBe(200);
    expect(limiter.limit).toHaveBeenCalledWith({ key: "1.2.3.4" });
  });

  it("returns 429 + Retry-After when over limit", async () => {
    const res = await app("RL_WRITE").fetch(
      new Request("http://t/", { headers: { "CF-Connecting-IP": "1.2.3.4" } }),
      envWith({ RL_WRITE: fakeLimiter(false) }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });

  it("fails open when limiter throws (defense against flaky binding)", async () => {
    const limiter: RateLimit = {
      limit: vi.fn().mockRejectedValue(new Error("binding broke")),
    };
    const res = await app("RL_WRITE").fetch(
      new Request("http://t/", { headers: { "CF-Connecting-IP": "1.2.3.4" } }),
      envWith({ RL_WRITE: limiter }),
    );
    expect(res.status).toBe(200);
    expect(limiter.limit).toHaveBeenCalled();
  });

  it("uses the supplied key (e.g., handle) regardless of IP", async () => {
    const limiter = fakeLimiter(true);
    const a = new Hono<{ Bindings: Env }>();
    a.get("/", async (c) => {
      const rl = await rateLimit(c, "RL_REPLY_HANDLE", "wXyZ-handle");
      return rl ?? c.text("ok");
    });
    await a.fetch(
      new Request("http://t/"),
      envWith({ RL_REPLY_HANDLE: limiter }),
    );
    expect(limiter.limit).toHaveBeenCalledWith({ key: "wXyZ-handle" });
  });
});
