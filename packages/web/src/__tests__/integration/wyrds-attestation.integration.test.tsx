/**
 * My Wyrds attest-authorship affordance — happy path, body shape, signature
 * round-trip, success URL surfacing, publish-error UX.
 *
 * Mocks:
 *   - next/navigation router + pathname
 *   - global fetch         (replies endpoint stub — empty per row)
 *   - `@/lib/api`          (intercepts publishWyrd; captures payload shape)
 *
 * Real:
 *   - seedClient (open mode + counter), wyrdHistory, persistentStorage,
 *     core compose / sign / envelope primitives — these run for real
 *     against jsdom's WebCrypto.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockReplace = vi.fn();
const mockPush = vi.fn();
// Stable singleton — see note in wyrds.integration.test.tsx.
const stableRouter = { push: mockPush, replace: mockReplace };
vi.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  usePathname: () => "/wyrds",
}));

// Stub publishWyrd so we can capture the publish_payload (and therefore the
// envelope) without making a network call. Default success response — tests
// override per-case.
const publishMock = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    publishWyrd: (...args: unknown[]) => publishMock(...args),
  };
});

import {
  authorshipAttestationMessage,
  b64uDecode,
  b64uEncode,
  decryptFromBase64Url,
  deriveOriginKey,
  parseAttestationBody,
  PERMANENT_EXPIRES_AT_MS,
  schnorrVerify,
  verifyAuthorshipAttestation,
} from "@sendwyrd/core";

import WyrdsPage from "@/app/wyrds/page";
import { storeOpenSeed, forgetSeed } from "@/lib/seedClient";
import {
  addHistoryEntry,
  clearHistory,
  listHistory,
  type HistoryEntry,
} from "@/lib/wyrdHistory";

// 16-char base64url handle (12 bytes), valid for b64uDecode.
const TARGET_HANDLE = "AAAAAAAAAAAAAAAA";
const TARGET_N = 3;
const SEED_FILL = 0x77;
const SEED_COUNTER = 5; // attest will consume this index for the new wyrd

function makeLiveEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    handle: TARGET_HANDLE,
    n: TARGET_N,
    k_origin_pub_b64u: "k_origin_pub_b64u",
    k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
    published_at: 1_700_000_000_000,
    expires_at: Date.now() + 86_400_000, // live: well in the future
    replies_enabled: false, // skip auto-replies fetch
    ...overrides,
  };
}

beforeEach(() => {
  forgetSeed();
  clearHistory();
  publishMock.mockReset();
  publishMock.mockResolvedValue({
    handle: "ATTESTHANDLE0000",
    published_at: 1_700_000_001_000,
    expires_at: 1_710_000_000_000,
  });
  mockReplace.mockReset();
  // Replies endpoint stub — the page auto-fetches replies for live rows that
  // have replies_enabled. Our seeded entry has replies disabled, but keep
  // the stub in place to fail loud if any unexpected fetch lands.
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ handle: "x", replies: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    ),
  );
  // Real seed in open mode at a known counter so consumeNextIndex returns
  // SEED_COUNTER as the n for the published attestation wyrd.
  const seed = new Uint8Array(64);
  seed.fill(SEED_FILL);
  storeOpenSeed({ seed, counter: SEED_COUNTER });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("My Wyrds — attest authorship (happy path)", () => {
  it("publishes a strict three-line attestation body whose signature round-trips against the target's K_origin_pub", async () => {
    const user = userEvent.setup();
    addHistoryEntry(makeLiveEntry());
    render(<WyrdsPage />);

    // Click the "attest authorship" affordance on the live row.
    const attestBtn = await screen.findByRole("button", {
      name: /Attest authorship of/i,
    });
    await user.click(attestBtn);

    // Confirm panel surfaces; click the inner "publish attestation" button.
    const publishBtn = await screen.findByRole("button", {
      name: /^publish attestation$/,
    });
    await user.click(publishBtn);

    await waitFor(() => {
      expect(publishMock).toHaveBeenCalledOnce();
    });

    const payload = publishMock.mock.calls[0]![0] as Record<string, unknown>;
    // Payload contract: see core/src/compose.ts PublishPayload.
    expect(payload).toHaveProperty("handle");
    expect(payload).toHaveProperty("envelope");
    expect(payload).toHaveProperty("k_origin_pub");
    expect(payload).toHaveProperty("ttl_seconds");
    expect(payload).toHaveProperty("replies_enabled");
    expect(payload).toHaveProperty("publish_signature");
    expect(payload).toHaveProperty("publish_timestamp_ms");
    // Attestations are permanent (ttl_seconds === 0 sentinel) and never accept replies.
    expect(payload.ttl_seconds).toBe(0);
    expect(payload.replies_enabled).toBe(false);

    // Decrypt the published envelope using the read key recorded in history
    // for the new attestation wyrd (added by the handler post-publish).
    const newEntry = listHistory().find(
      (e) => e.handle === (payload.handle as string),
    );
    expect(newEntry).toBeDefined();
    expect(newEntry!.k_read_b64u).toBeDefined();

    const handleBytes = b64uDecode(payload.handle as string);
    const k_read = b64uDecode(newEntry!.k_read_b64u!);
    const plaintext = await decryptFromBase64Url(payload.envelope as string, {
      k_read,
      handle: handleBytes,
      // ttl=0 sentinel → AAD is bound to PERMANENT_EXPIRES_AT_MS (per
      // composeWyrd), independent of whatever expires_at the host echoes
      // back in the publish response.
      expires_at_ms: PERMANENT_EXPIRES_AT_MS,
      replies_enabled: false,
    });

    // Strict three-line shape: header / target=… / sig=…
    const lines = plaintext.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("sendwyrd-attestation/v1");
    expect(lines[1]).toBe(`target=${TARGET_HANDLE}`);
    expect(lines[2]).toMatch(/^sig=[A-Za-z0-9_-]{86}$/);

    const parts = parseAttestationBody(plaintext);
    expect(parts).not.toBeNull();
    expect(parts!.target_handle).toBe(TARGET_HANDLE);

    // Signature round-trips against the target's K_origin derived from seed
    // at the ORIGINAL index (TARGET_N), not the new attestation wyrd's n.
    const seed = new Uint8Array(64);
    seed.fill(SEED_FILL);
    const targetKey = deriveOriginKey(seed, TARGET_N);
    const verified = verifyAuthorshipAttestation({
      target_handle_b64u: TARGET_HANDLE,
      target_k_origin_pub_b64u: payload.k_origin_pub as string,
      sig_b64u: parts!.sig_b64u,
    });
    // The publish_payload's k_origin_pub is the NEW wyrd's K_origin, not the
    // target's — so it must NOT verify the attestation sig. (The renderer
    // fetches the target's K_origin_pub separately via /api/v1/wyrds/{handle}.)
    expect(verified).toBe(false);

    // Against the target's K_origin_pub: must verify.
    const verifiedAgainstTarget = verifyAuthorshipAttestation({
      target_handle_b64u: TARGET_HANDLE,
      target_k_origin_pub_b64u: b64uEncode(targetKey.k_origin_pub),
      sig_b64u: parts!.sig_b64u,
    });
    expect(verifiedAgainstTarget).toBe(true);

    // Explicit message-binding check: the signature is over
    // authorshipAttestationMessage({ target_handle }), not some other message.
    // Independent verify path using schnorrVerify directly.
    const expectedMessage = authorshipAttestationMessage({
      target_handle: b64uDecode(TARGET_HANDLE),
    });
    const sigBytes = b64uDecode(parts!.sig_b64u);
    expect(schnorrVerify(sigBytes, expectedMessage, targetKey.k_origin_xpub)).toBe(true);
    // Sanity: the same sig MUST NOT verify against a different message
    // (e.g., the publish_message would have a different hash).
    const wrongMessage = authorshipAttestationMessage({
      target_handle: b64uDecode("BBBBBBBBBBBBBBBB"),
    });
    expect(schnorrVerify(sigBytes, wrongMessage, targetKey.k_origin_xpub)).toBe(false);
  });

  it("surfaces the new wyrd's share URL with copy/done affordances on success", async () => {
    const user = userEvent.setup();
    addHistoryEntry(makeLiveEntry());
    render(<WyrdsPage />);

    const attestBtn = await screen.findByRole("button", {
      name: /Attest authorship of/i,
    });
    await user.click(attestBtn);
    const publishBtn = await screen.findByRole("button", {
      name: /^publish attestation$/,
    });
    await user.click(publishBtn);

    await waitFor(() => {
      expect(publishMock).toHaveBeenCalledOnce();
    });

    // Success copy surfaces.
    await waitFor(() => {
      expect(
        screen.getByText(/Attestation published\. Share alongside the original:/i),
      ).toBeInTheDocument();
    });

    // The handler builds `${origin}/w/${handle}#${k_read}` — the new wyrd's
    // handle came from composeWyrd (random), so we look for the shape rather
    // than an exact URL.
    const shareLink = screen
      .getAllByRole("link")
      .find((a) => /\/w\/[A-Za-z0-9_-]{16}#[A-Za-z0-9_-]{43}$/.test(
        (a as HTMLAnchorElement).href,
      )) as HTMLAnchorElement | undefined;
    expect(shareLink).toBeDefined();

    // Copy + done buttons rendered in the success panel.
    expect(
      screen.getByRole("button", { name: /^copy URL$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^done$/ })).toBeInTheDocument();
  });
});

describe("My Wyrds — attest authorship (error path)", () => {
  it("does not lie about success when publishWyrd returns an error response", async () => {
    publishMock.mockResolvedValue({ error: "rate_limited" });
    const user = userEvent.setup();
    addHistoryEntry(makeLiveEntry());
    render(<WyrdsPage />);

    const attestBtn = await screen.findByRole("button", {
      name: /Attest authorship of/i,
    });
    await user.click(attestBtn);
    const publishBtn = await screen.findByRole("button", {
      name: /^publish attestation$/,
    });
    await user.click(publishBtn);

    await waitFor(() => {
      expect(publishMock).toHaveBeenCalledOnce();
    });

    // Error surfaces with the host's reason verbatim — no spurious success copy.
    await waitFor(() => {
      expect(
        screen.getByText(/Publish failed: rate_limited/),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Attestation published\. Share alongside the original:/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^copy URL$/ }),
    ).not.toBeInTheDocument();
    // The attestation wyrd MUST NOT land in local history when publish failed.
    // (Pre-existing target row remains; nothing else added.)
    expect(listHistory()).toHaveLength(1);
  });
});
