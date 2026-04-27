/**
 * Resolved runtime configuration: paths, origin, passphrase source.
 *
 * Defaults:
 *   - origin = SENDWYRD_ORIGIN env var, else https://sendwyrd.com
 *   - config dir = $XDG_CONFIG_HOME/sendwyrd or ~/.config/sendwyrd
 *   - passphrase = SENDWYRD_PASSPHRASE env var if set, else null (open mode)
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

export interface McpConfig {
  origin: string;
  configDir: string;
  configFile: string;
  openSeedFile: string;
  protectedSeedFile: string;
  historyFile: string;
  passphrase: string | null;
}

export function loadConfig(): McpConfig {
  const origin = (process.env.SENDWYRD_ORIGIN ?? "https://sendwyrd.com").replace(
    /\/+$/,
    "",
  );

  const xdg = process.env.XDG_CONFIG_HOME;
  const configDir = xdg
    ? join(xdg, "sendwyrd")
    : join(homedir(), ".config", "sendwyrd");

  return {
    origin,
    configDir,
    configFile: join(configDir, "config.json"),
    openSeedFile: join(configDir, "seed.open.json"),
    protectedSeedFile: join(configDir, "seed.enc"),
    historyFile: join(configDir, "history.json"),
    passphrase: resolvePassphrase(),
  };
}

/**
 * Two ways to provide a passphrase out-of-band so the agent never has to ask:
 *   - SENDWYRD_PASSPHRASE — direct value (simplest, less secure)
 *   - SENDWYRD_PASSPHRASE_CMD — shell-free command spec; first whitespace-
 *     separated token is the executable, rest are argv. Stdout (trimmed) is
 *     the passphrase. Designed for `pass sendwyrd` / `gpg ...` integrations.
 *
 * No shell expansion, no interpolation. If both are set, _CMD wins.
 */
function resolvePassphrase(): string | null {
  const cmd = process.env.SENDWYRD_PASSPHRASE_CMD;
  if (cmd && cmd.trim().length > 0) {
    const parts = cmd.trim().split(/\s+/);
    const exe = parts[0]!;
    const args = parts.slice(1);
    try {
      const out = execFileSync(exe, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10_000,
      });
      const trimmed = out.replace(/\r?\n$/, "");
      return trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }
  const direct = process.env.SENDWYRD_PASSPHRASE;
  return direct && direct.length > 0 ? direct : null;
}
