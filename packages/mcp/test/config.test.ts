import { describe, it, expect, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

const ENV_KEYS = [
  "SENDWYRD_ORIGIN",
  "SENDWYRD_PASSPHRASE",
  "SENDWYRD_PASSPHRASE_CMD",
  "XDG_CONFIG_HOME",
];
const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
    delete saved[k];
  }
});

function setEnv(k: string, v: string | undefined) {
  saved[k] = process.env[k];
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}

describe("config", () => {
  it("origin defaults to https://sendwyrd.com", () => {
    setEnv("SENDWYRD_ORIGIN", undefined);
    expect(loadConfig().origin).toBe("https://sendwyrd.com");
  });

  it("origin is overridable and trailing slashes stripped", () => {
    setEnv("SENDWYRD_ORIGIN", "https://staging.sendwyrd.com//");
    expect(loadConfig().origin).toBe("https://staging.sendwyrd.com");
  });

  it("config dir uses XDG_CONFIG_HOME if set", () => {
    setEnv("XDG_CONFIG_HOME", "/tmp/xdg-test");
    expect(loadConfig().configDir).toBe("/tmp/xdg-test/sendwyrd");
  });

  it("passphrase from SENDWYRD_PASSPHRASE", () => {
    setEnv("SENDWYRD_PASSPHRASE", "hunter2");
    setEnv("SENDWYRD_PASSPHRASE_CMD", undefined);
    expect(loadConfig().passphrase).toBe("hunter2");
  });

  it("passphrase from SENDWYRD_PASSPHRASE_CMD via echo", () => {
    setEnv("SENDWYRD_PASSPHRASE", undefined);
    setEnv("SENDWYRD_PASSPHRASE_CMD", "printf secret-from-cmd");
    expect(loadConfig().passphrase).toBe("secret-from-cmd");
  });

  it("CMD wins over direct passphrase", () => {
    setEnv("SENDWYRD_PASSPHRASE", "fallback");
    setEnv("SENDWYRD_PASSPHRASE_CMD", "printf from-cmd");
    expect(loadConfig().passphrase).toBe("from-cmd");
  });

  it("CMD failure falls through to null (no shell injection)", () => {
    setEnv("SENDWYRD_PASSPHRASE_CMD", "nonexistent-binary-xyzzy");
    setEnv("SENDWYRD_PASSPHRASE", undefined);
    expect(loadConfig().passphrase).toBe(null);
  });
});
