# @sendwyrd/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes SendWyrd as agent-callable verbs over stdio.

The web app is for humans. This is the surface for agents.

## Why

SendWyrd is an identity-less, ephemeral, capability-URL relay primitive. It refuses to be a feed, a platform, or an algorithmic public square. What's left is a substrate of capsules with no native discovery layer — and the natural follow-up question is _then how does anyone find anything?_

The answer is that **routing becomes personal infrastructure, not platform infrastructure**: per-user agents do the connective work that an algorithmic agora used to. This MCP server is the binding that lets every Claude Code, Claude Desktop, Cursor, or Zed user's agent speak SendWyrd by default.

It exposes only **verbs**. There are no subscriptions, no polling tools, no auto-reply, by design — that would push SendWyrd toward the conversation-hosting layer it was designed to refuse.

## Install

Live on npm:

```bash
npx -y @sendwyrd/mcp
```

For Claude Code, add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "sendwyrd": {
      "command": "npx",
      "args": ["-y", "@sendwyrd/mcp"]
    }
  }
}
```

Restart Claude Code. The 13 tools (`sendwyrd_compose`, `sendwyrd_view`, etc.) appear in the model's tool list. First call should be `sendwyrd_status`, then `sendwyrd_init` to generate a mnemonic.

For Claude Desktop, Cursor, or Zed, the same JSON shape goes in their respective MCP-server config files.

### Workspace dev

To run from a clone of the SendWyrd monorepo (e.g. for development):

```bash
cd packages/mcp
pnpm install && pnpm build
```

Then point your MCP client at `node /absolute/path/to/packages/mcp/dist/index.js`.

## Configuration

Environment variables:

| Var                       | Default                | Purpose                                                                              |
| ------------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| `SENDWYRD_ORIGIN`         | `https://sendwyrd.com` | Override origin (dev / staging)                                                      |
| `SENDWYRD_PASSPHRASE`     | _(unset)_              | Direct passphrase for protected-mode seed                                            |
| `SENDWYRD_PASSPHRASE_CMD` | _(unset)_              | Command whose stdout is the passphrase. No shell expansion. Example: `pass sendwyrd` |
| `XDG_CONFIG_HOME`         | `~/.config`            | Config root; the server uses `$XDG_CONFIG_HOME/sendwyrd/`                            |

If both `SENDWYRD_PASSPHRASE` and `SENDWYRD_PASSPHRASE_CMD` are set, `_CMD` wins.

## State on disk

Stored under `$XDG_CONFIG_HOME/sendwyrd/`:

- `seed.open.json` — open-mode seed (no passphrase). Mode `0600`.
- `seed.enc` — passphrase-protected seed record (PBKDF2-AES-GCM, same format as the web app's `sendwyrd:seed:v1`). Mode `0600`.
- `history.json` — local wyrd history (handles, HD indices, K_origin pubkeys, K_read for wyrds you composed locally). Mode `0600`.

Open mode is the default to match the web app's zero-friction flow. Promote to protected mode at any time by re-running `sendwyrd_init` with a passphrase against an empty config dir, or by setting `SENDWYRD_PASSPHRASE` before first init.

## Tools

| Tool               | Purpose                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `sendwyrd_status`  | Report origin, seed mode, unlocked-or-not, history count                                  |
| `sendwyrd_init`    | Generate or import a BIP-39 mnemonic                                                      |
| `sendwyrd_unlock`  | Decrypt a protected seed and cache for the process                                        |
| `sendwyrd_lock`    | Clear cached seed                                                                         |
| `sendwyrd_forget`  | Wipe all on-disk state (destructive; requires confirm token)                              |
| `sendwyrd_compose` | Publish a wyrd; returns the canonical fragment URL                                        |
| `sendwyrd_view`    | Fetch + decrypt a wyrd by URL; verifies attestations                                      |
| `sendwyrd_burn`    | Schnorr-signed DELETE for a wyrd you authored                                             |
| `sendwyrd_reply`   | Send an ECIES one-shot reply to a wyrd's author                                           |
| `sendwyrd_attest`  | Re-derive K_origin_priv at index n, sign target_handle, publish a 3-line attestation wyrd |
| `sendwyrd_history` | List local wyrd history (no network)                                                      |
| `sendwyrd_inbox`   | Fetch + decrypt replies for own wyrds (one-shot read)                                     |
| `sendwyrd_recover` | HD sweep via presence-check; rebuild history from a mnemonic                              |

## Smoke test

End-to-end against the live origin:

```bash
node scripts/smoke.mjs
```

Spawns the bundled server in a tmpdir XDG home, runs init → compose → view → burn → view-after-burn → history, and exits non-zero on any mismatch. Composes a real wyrd against the configured origin (default production); the test burns it within seconds.

## Philosophy notes

- **Verbs only.** The architecture absorbs agent volume because there is no discovery surface. Agents that want routing must build it on streams the human has already opted into.
- **Local stdio default; no remote MCP in v1.** Remote SSE would require server-side seed handling, which violates the host-blind posture.
- **Open mode is the zero-friction default.** Passphrase is opt-in, not assumed.
- **Subscriptions, watches, auto-reply are not implemented and will not be.** SendWyrd is a relay primitive, not a chat host.
