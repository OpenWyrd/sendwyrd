/**
 * Inbox page integration — empty state, live, burned, recovered-without-key.
 *
 * Mocks:
 *   - next/navigation router + pathname
 *   - global fetch (replies endpoint stub — empty replies set per row)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockReplace = vi.fn();
const mockPush = vi.fn();
// IMPORTANT: returning a fresh object from useRouter on every render would
// cause an infinite re-render loop because Inbox's useEffect deps on router.
// Stable singleton avoids that.
const stableRouter = { push: mockPush, replace: mockReplace };
vi.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  usePathname: () => "/inbox",
}));

import InboxPage from "@/app/inbox/page";
import { storeOpenSeed, forgetSeed } from "@/lib/seedClient";
import {
  addHistoryEntry,
  clearHistory,
  type HistoryEntry,
} from "@/lib/wyrdHistory";

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    handle: "AAAAAAAAAAAAAAAA",
    n: 0,
    k_origin_pub_b64u: "k_origin_pub_b64u",
    k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
    published_at: 1_700_000_000_000,
    expires_at: 1_710_000_000_000,
    replies_enabled: false, // default: no reply auto-fetch
    ...overrides,
  };
}

beforeEach(() => {
  forgetSeed();
  clearHistory();
  mockReplace.mockReset();
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
  // Seed a fake open seed so inbox doesn't redirect.
  const seed = new Uint8Array(64);
  seed.fill(0x99);
  storeOpenSeed({ seed, counter: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Inbox — empty state", () => {
  it("renders empty-state copy when no history exists", async () => {
    render(<InboxPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/No wyrds yet\. Compose one to begin\./i),
      ).toBeInTheDocument();
    });
  });

  it("redirects to /onboarding when no seed exists", () => {
    forgetSeed();
    render(<InboxPage />);
    expect(mockReplace).toHaveBeenCalledWith("/onboarding");
  });
});

describe("Inbox — live wyrd", () => {
  it("renders a live wyrd with status pill = 'live'", async () => {
    addHistoryEntry(
      makeEntry({
        handle: "live000000000aaa",
        published_at: Date.now() - 1000,
        expires_at: Date.now() + 86_400_000,
      }),
    );
    render(<InboxPage />);
    // Handle text rendered as a link — wait for it to appear first.
    await waitFor(() => {
      expect(screen.getByText("live000000000aaa")).toBeInTheDocument();
    });
    // The status pill's "live" text shares its label with the filter button,
    // so we look for it via the colored span styling instead.
    const liveLabels = screen.getAllByText("live");
    // One is the filter (a label/input), one is the status pill (a span).
    const pills = liveLabels.filter(
      (el) => el.tagName.toLowerCase() === "span",
    );
    expect(pills.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Inbox — burned wyrd", () => {
  it("renders status pill = 'burned' and applies tombstone styling", async () => {
    addHistoryEntry(
      makeEntry({
        handle: "burn00000000burn",
        gone_at: Date.now() - 1000,
        gone_reason: "burned",
      }),
    );
    render(<InboxPage />);
    await waitFor(() => {
      expect(screen.getByText("burned")).toBeInTheDocument();
    });
    // The handle anchor gets line-through when burned.
    const link = screen.getByText("burn00000000burn") as HTMLAnchorElement;
    expect(link.style.textDecoration).toContain("line-through");
  });
});

describe("Inbox — recovered without k_read_b64u", () => {
  it("renders a metadata-only line, no clickable URL", async () => {
    addHistoryEntry(
      makeEntry({
        handle: "rec0recoveredrec",
        k_read_b64u: undefined,
        recovered: true,
      }),
    );
    render(<InboxPage />);
    await waitFor(() => {
      expect(screen.getByText("rec0recoveredrec")).toBeInTheDocument();
    });
    // The handle should NOT be a link when k_read_b64u is missing.
    const handleEl = screen.getByText("rec0recoveredrec");
    expect(handleEl.tagName.toLowerCase()).toBe("span");
    // Recovered marker surfaces in the meta line.
    expect(screen.getByText(/recovered \(no read key\)/i)).toBeInTheDocument();
  });
});

describe("Inbox — filter pills", () => {
  it("renders 'all' / 'live' / 'gone' segmented control", async () => {
    addHistoryEntry(makeEntry({ handle: "any00000000any00" }));
    render(<InboxPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/all/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/live/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^gone$/i)).toBeInTheDocument();
  });
});
