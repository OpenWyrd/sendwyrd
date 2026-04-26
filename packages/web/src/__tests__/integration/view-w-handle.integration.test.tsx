/**
 * View page (`/w/[handle]`) integration — fragment-form decrypt path.
 *
 * Mocks:
 *   - next/navigation        (useParams returns the test handle)
 *   - @/lib/api              (fetchWyrd / burnWyrd stubs we drive per-test)
 *   - @/lib/resolveBody      (no transitive resolution noise in tests)
 *   - global fetch           (any stray fetch falls through to jsdom)
 *
 * Real:
 *   - core composeWyrd, decryptFromBase64Url, deriveOriginKey — we generate
 *     a real envelope at test setup so the decrypt path exercises real
 *     crypto, not a mock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableRouter = { push: vi.fn(), replace: vi.fn() };
const mockUseParams = vi.fn(() => ({ handle: "" }));

vi.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
  useRouter: () => stableRouter,
  usePathname: () => "/w/test",
}));

const fetchWyrdMock = vi.fn();
const burnWyrdMock = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>(
    "@/lib/api",
  );
  return {
    ...actual,
    fetchWyrd: (...args: unknown[]) => fetchWyrdMock(...args),
    burnWyrd: (...args: unknown[]) => burnWyrdMock(...args),
  };
});

// Skip transitive resolution; we don't need its network calls here.
vi.mock("@/lib/resolveBody", () => ({
  resolveTransitives: vi.fn(() => Promise.resolve({})),
}));

import { b64uEncode, composeWyrd, generateSeed } from "@sendwyrd/core";
import FragmentView from "@/app/w/[handle]/page";
import { storeOpenSeed, forgetSeed } from "@/lib/seedClient";
import {
  addHistoryEntry,
  clearHistory,
  type HistoryEntry,
} from "@/lib/wyrdHistory";

interface ComposedFixture {
  handle: string;
  k_read_b64u: string;
  k_origin_pub_b64u: string;
  envelope_b64u: string;
  body: string;
  expires_at: number;
  published_at: number;
  replies_enabled: boolean;
  seed: Uint8Array;
}

async function composeFixture(body = "the secret body"): Promise<ComposedFixture> {
  const { seed } = generateSeed(12);
  const result = await composeWyrd({
    plaintext: body,
    seed,
    n: 0,
    ttl_seconds: 86_400,
    replies_enabled: true,
  });
  // Use the EXACT expires_at_ms / publish_timestamp_ms returned by compose;
  // they're bound into the AAD and any drift breaks decryption.
  return {
    seed,
    handle: result.handle,
    k_read_b64u: result.k_read_b64u,
    k_origin_pub_b64u: b64uEncode(result.k_origin.k_origin_pub),
    envelope_b64u: result.publish_payload.envelope,
    body,
    expires_at: result.expires_at_ms,
    published_at: result.publish_timestamp_ms,
    replies_enabled: true,
  };
}

function setHashFragment(k_read_b64u: string) {
  window.history.replaceState(null, "", `/w/${"X".repeat(16)}#${k_read_b64u}`);
}

beforeEach(() => {
  forgetSeed();
  clearHistory();
  fetchWyrdMock.mockReset();
  burnWyrdMock.mockReset();
  mockUseParams.mockReset();
  // Default route param — individual tests override.
  mockUseParams.mockReturnValue({ handle: "AAAAAAAAAAAAAAAA" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("View page — happy path (decrypt + render)", () => {
  it("loads, decrypts via K_read from fragment, renders body", async () => {
    const fx = await composeFixture("hello sealed body");
    mockUseParams.mockReturnValue({ handle: fx.handle });
    setHashFragment(fx.k_read_b64u);
    fetchWyrdMock.mockResolvedValue({
      kind: "live",
      data: {
        handle: fx.handle,
        envelope: fx.envelope_b64u,
        k_origin_pub: fx.k_origin_pub_b64u,
        published_at: fx.published_at,
        expires_at: fx.expires_at,
        replies_enabled: fx.replies_enabled,
      },
    });

    render(<FragmentView />);

    await waitFor(() => {
      expect(screen.getByText("hello sealed body")).toBeInTheDocument();
    });
  });
});

describe("View page — gone tombstone", () => {
  it("renders the tombstone copy and not the body", async () => {
    mockUseParams.mockReturnValue({ handle: "BBBBBBBBBBBBBBBB" });
    setHashFragment("a".repeat(43));
    fetchWyrdMock.mockResolvedValue({
      kind: "gone",
      data: {
        status: "gone" as const,
        reason: "burned",
        gone_at: "2026-01-01T00:00:00.000Z",
      },
    });

    render(<FragmentView />);

    await waitFor(() => {
      expect(
        screen.getByText(/withdrawn by its author/i),
      ).toBeInTheDocument();
    });
  });
});

describe("View page — network error", () => {
  it("renders the network-error fallback", async () => {
    mockUseParams.mockReturnValue({ handle: "CCCCCCCCCCCCCCCC" });
    setHashFragment("b".repeat(43));
    fetchWyrdMock.mockResolvedValue({
      kind: "error",
      status: 500,
      body: { error: "server" },
    });

    render(<FragmentView />);

    await waitFor(() => {
      expect(
        screen.getByText(/couldn.t be fetched/i),
      ).toBeInTheDocument();
    });
  });
});

describe("View page — author-only burn affordance", () => {
  it("renders BurnAffordance when historyEntry matches K_origin_pub", async () => {
    const fx = await composeFixture("body");
    mockUseParams.mockReturnValue({ handle: fx.handle });
    setHashFragment(fx.k_read_b64u);
    storeOpenSeed({ seed: fx.seed, counter: 1 });
    const entry: HistoryEntry = {
      handle: fx.handle,
      n: 0,
      k_origin_pub_b64u: fx.k_origin_pub_b64u,
      k_read_b64u: fx.k_read_b64u,
      published_at: fx.published_at,
      expires_at: fx.expires_at,
      replies_enabled: true,
    };
    addHistoryEntry(entry);
    fetchWyrdMock.mockResolvedValue({
      kind: "live",
      data: {
        handle: fx.handle,
        envelope: fx.envelope_b64u,
        k_origin_pub: fx.k_origin_pub_b64u,
        published_at: fx.published_at,
        expires_at: fx.expires_at,
        replies_enabled: fx.replies_enabled,
      },
    });

    render(<FragmentView />);

    await waitFor(() => {
      expect(screen.getByText("body")).toBeInTheDocument();
    });
    // The trigger row sits at the bottom of the article.
    const burnTrigger = await screen.findByRole("button", { name: /^burn$/ });
    expect(burnTrigger).toBeInTheDocument();
  });

  it("does NOT render BurnAffordance when K_origin_pub mismatches", async () => {
    const fx = await composeFixture("body");
    mockUseParams.mockReturnValue({ handle: fx.handle });
    setHashFragment(fx.k_read_b64u);
    storeOpenSeed({ seed: fx.seed, counter: 1 });
    addHistoryEntry({
      handle: fx.handle,
      n: 0,
      // Mismatched k_origin_pub — different author.
      k_origin_pub_b64u: "this_does_not_match_the_envelope_author",
      k_read_b64u: fx.k_read_b64u,
      published_at: fx.published_at,
      expires_at: fx.expires_at,
      replies_enabled: true,
    });
    fetchWyrdMock.mockResolvedValue({
      kind: "live",
      data: {
        handle: fx.handle,
        envelope: fx.envelope_b64u,
        k_origin_pub: fx.k_origin_pub_b64u,
        published_at: fx.published_at,
        expires_at: fx.expires_at,
        replies_enabled: fx.replies_enabled,
      },
    });

    render(<FragmentView />);

    await waitFor(() => {
      expect(screen.getByText("body")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /^burn$/ })).toBeNull();
  });

  it("burn flow: click → confirm → submit → tombstone state", async () => {
    const fx = await composeFixture("body");
    mockUseParams.mockReturnValue({ handle: fx.handle });
    setHashFragment(fx.k_read_b64u);
    storeOpenSeed({ seed: fx.seed, counter: 1 });
    addHistoryEntry({
      handle: fx.handle,
      n: 0,
      k_origin_pub_b64u: fx.k_origin_pub_b64u,
      k_read_b64u: fx.k_read_b64u,
      published_at: fx.published_at,
      expires_at: fx.expires_at,
      replies_enabled: true,
    });
    fetchWyrdMock.mockResolvedValue({
      kind: "live",
      data: {
        handle: fx.handle,
        envelope: fx.envelope_b64u,
        k_origin_pub: fx.k_origin_pub_b64u,
        published_at: fx.published_at,
        expires_at: fx.expires_at,
        replies_enabled: fx.replies_enabled,
      },
    });
    const goneAt = Date.now();
    burnWyrdMock.mockResolvedValue({
      kind: "burned",
      data: { gone_at: goneAt },
    });

    const user = userEvent.setup();
    render(<FragmentView />);

    await waitFor(() => {
      expect(screen.getByText("body")).toBeInTheDocument();
    });
    // Stage 1: click the muted burn trigger.
    const trigger = screen.getByRole("button", { name: /^burn$/ });
    await user.click(trigger);
    // Stage 2: confirm.
    const confirm = await screen.findByRole("button", { name: /^burn$/ });
    await user.click(confirm);
    // Tombstone state after success.
    await waitFor(() => {
      expect(burnWyrdMock).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(
        screen.getByText(/withdrawn by its author/i),
      ).toBeInTheDocument();
    });
  });
});

describe("View page — missing key in fragment", () => {
  it("renders the 'missing read key' message when fragment is empty", async () => {
    mockUseParams.mockReturnValue({ handle: "DDDDDDDDDDDDDDDD" });
    // No fragment.
    window.history.replaceState(null, "", "/w/DDDDDDDDDDDDDDDD");
    render(<FragmentView />);
    await waitFor(() => {
      expect(
        screen.getByText(/missing its read key/i),
      ).toBeInTheDocument();
    });
  });
});
