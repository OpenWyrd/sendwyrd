/**
 * My Wyrds page integration — empty state, live, burned, recovered-without-key.
 *
 * Mocks:
 *   - next/navigation router + pathname
 *   - global fetch (replies endpoint stub — empty replies set per row)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockReplace = vi.fn();
const mockPush = vi.fn();
// IMPORTANT: returning a fresh object from useRouter on every render would
// cause an infinite re-render loop because the page's useEffect deps on router.
// Stable singleton avoids that.
const stableRouter = { push: mockPush, replace: mockReplace };
vi.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  usePathname: () => "/wyrds",
}));

import WyrdsPage from "@/app/wyrds/page";
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
  // Seed a fake open seed so the page doesn't redirect.
  const seed = new Uint8Array(64);
  seed.fill(0x99);
  storeOpenSeed({ seed, counter: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("My Wyrds — empty state", () => {
  it("renders empty-state copy when no history exists", async () => {
    render(<WyrdsPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/No wyrds yet\. Compose one to begin\./i),
      ).toBeInTheDocument();
    });
  });

  it("redirects to /onboarding when no seed exists", () => {
    forgetSeed();
    render(<WyrdsPage />);
    expect(mockReplace).toHaveBeenCalledWith("/onboarding");
  });
});

describe("My Wyrds — live wyrd", () => {
  it("renders a live wyrd with status pill = 'live'", async () => {
    addHistoryEntry(
      makeEntry({
        handle: "live000000000aaa",
        published_at: Date.now() - 1000,
        expires_at: Date.now() + 86_400_000,
      }),
    );
    render(<WyrdsPage />);
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

describe("My Wyrds — burned wyrd", () => {
  it("renders status pill = 'burned' and applies tombstone styling", async () => {
    addHistoryEntry(
      makeEntry({
        handle: "burn00000000burn",
        gone_at: Date.now() - 1000,
        gone_reason: "burned",
      }),
    );
    render(<WyrdsPage />);
    await waitFor(() => {
      expect(screen.getByText("burned")).toBeInTheDocument();
    });
    // The handle anchor gets line-through when burned.
    const link = screen.getByText("burn00000000burn") as HTMLAnchorElement;
    expect(link.style.textDecoration).toContain("line-through");
  });
});

describe("My Wyrds — recovered without k_read_b64u", () => {
  it("renders a metadata-only line, no clickable URL", async () => {
    addHistoryEntry(
      makeEntry({
        handle: "rec0recoveredrec",
        k_read_b64u: undefined,
        recovered: true,
      }),
    );
    render(<WyrdsPage />);
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

describe("My Wyrds — filter pills", () => {
  it("renders 'all' / 'live' / 'gone' segmented control", async () => {
    addHistoryEntry(makeEntry({ handle: "any00000000any00" }));
    render(<WyrdsPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/all/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/live/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^gone$/i)).toBeInTheDocument();
  });
});

describe("My Wyrds — authorship attestation", () => {
  it("renders the 'attest authorship' action on live entries", async () => {
    addHistoryEntry(
      makeEntry({
        handle: "live000000000aaa",
        published_at: Date.now() - 1000,
        expires_at: Date.now() + 86_400_000,
      }),
    );
    render(<WyrdsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /attest authorship/i }),
      ).toBeInTheDocument();
    });
  });

  it("does NOT render the action on burned/expired entries", async () => {
    addHistoryEntry(
      makeEntry({
        handle: "burn00000000burn",
        gone_at: Date.now() - 1000,
        gone_reason: "burned",
      }),
    );
    render(<WyrdsPage />);
    await waitFor(() => {
      expect(screen.getByText("burn00000000burn")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /attest authorship/i }),
    ).not.toBeInTheDocument();
  });

  it("publishes an attestation and shows the URL on success", async () => {
    const user = userEvent.setup();
    // Override fetch with a publish-aware mock that captures the POST.
    const captured: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        captured.push({ url, init });
        // Publish endpoint: return a success-shaped envelope.
        if (
          typeof url === "string" &&
          url.includes("/api/v1/wyrds") &&
          init?.method === "POST"
        ) {
          return new Response(
            JSON.stringify({
              handle: "attestPublished0",
              published_at: 1_700_000_000_000,
              expires_at: 253_402_300_799_000,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        // Default: empty replies set (matches the global stub).
        return new Response(JSON.stringify({ handle: "x", replies: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    addHistoryEntry(
      makeEntry({
        handle: "AAAAAAAAAAAAAAAA",
        n: 0,
        published_at: Date.now() - 1000,
        expires_at: Date.now() + 86_400_000,
      }),
    );
    render(<WyrdsPage />);

    const attestBtn = await screen.findByRole("button", {
      name: /attest authorship/i,
    });
    await user.click(attestBtn);

    const publishBtn = await screen.findByRole("button", {
      name: /publish attestation/i,
    });
    await user.click(publishBtn);

    // Success state surfaces a "copy URL" affordance and the published URL.
    await waitFor(
      () => {
        expect(
          screen.getByRole("button", { name: /copy url/i }),
        ).toBeInTheDocument();
      },
      { timeout: 5_000 },
    );

    // Confirm the publish endpoint was actually hit.
    const publishCalls = captured.filter(
      (c) =>
        typeof c.url === "string" &&
        c.url.includes("/api/v1/wyrds") &&
        c.init?.method === "POST",
    );
    expect(publishCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe("My Wyrds — outbox|inbox toggle", () => {
  it("defaults to outbox view; inbox toggle is present", async () => {
    addHistoryEntry(
      makeEntry({
        handle: "live000000000aaa",
        published_at: Date.now() - 1000,
        expires_at: Date.now() + 86_400_000,
      }),
    );
    render(<WyrdsPage />);
    await waitFor(() => {
      // Outbox content is visible by default
      expect(screen.getByText(/wyrds? on this device/i)).toBeInTheDocument();
    });
    // Inbox toggle is present
    expect(
      screen.getByRole("radio", { name: /inbox/i }),
    ).toBeInTheDocument();
  });

  it("inbox view shows empty state when no inbox entries exist", async () => {
    const user = userEvent.setup();
    render(<WyrdsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("radio", { name: /inbox/i }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: /inbox/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/0 wyrds opened in this browser/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/When you open a wyrd URL, it'll appear here/i),
    ).toBeInTheDocument();
  });

  it("inbox view renders entries from wyrdInbox localStorage with liveness fetch", async () => {
    const user = userEvent.setup();
    // Seed the inbox directly via localStorage (bypassing the
    // FragmentClient auto-record path).
    localStorage.setItem(
      "sendwyrd:inbox:v1",
      JSON.stringify([
        {
          handle: "inbox000000aaaaa",
          k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
          first_seen_at: Date.now() - 60_000,
          last_viewed_at: Date.now() - 60_000,
        },
      ]),
    );
    // Override fetch: when the inbox liveness check hits /api/v1/wyrds/{handle},
    // return a live envelope.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (
          typeof url === "string" &&
          url.includes("/api/v1/wyrds/inbox000000aaaaa")
        ) {
          return new Response(
            JSON.stringify({
              handle: "inbox000000aaaaa",
              envelope: "x",
              k_origin_pub: "y",
              ttl_seconds: 86400,
              replies_enabled: false,
              publish_signature: "z",
              published_at: Date.now() - 1000,
              expires_at: Date.now() + 86_400_000,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }),
    );

    render(<WyrdsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("radio", { name: /inbox/i }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: /inbox/i }));

    await waitFor(() => {
      expect(screen.getByText("inbox000000aaaaa")).toBeInTheDocument();
    });
    // Liveness label appears once the fetch resolves
    await waitFor(() => {
      expect(screen.getByText(/^live$/i)).toBeInTheDocument();
    });
  });

  it("inbox liveness shows 'burned' for tombstoned entries", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "sendwyrd:inbox:v1",
      JSON.stringify([
        {
          handle: "burnedinbox00aaa",
          k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
          first_seen_at: Date.now() - 120_000,
          last_viewed_at: Date.now() - 120_000,
        },
      ]),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (
          typeof url === "string" &&
          url.includes("/api/v1/wyrds/burnedinbox00aaa")
        ) {
          return new Response(
            JSON.stringify({
              reason: "burned",
              gone_at: new Date(Date.now() - 30_000).toISOString(),
            }),
            { status: 410, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }),
    );

    render(<WyrdsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("radio", { name: /inbox/i }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: /inbox/i }));

    await waitFor(() => {
      expect(screen.getByText(/^burned$/i)).toBeInTheDocument();
    });
  });

  it("remove button drops an entry from the inbox", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "sendwyrd:inbox:v1",
      JSON.stringify([
        {
          handle: "removable00aaaaa",
          k_read_b64u: "k_read_43_chars_padding_padding_padding_pad",
          first_seen_at: Date.now(),
          last_viewed_at: Date.now(),
        },
      ]),
    );
    render(<WyrdsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("radio", { name: /inbox/i }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("radio", { name: /inbox/i }));
    await waitFor(() => {
      expect(screen.getByText("removable00aaaaa")).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: /Remove removable00aaaaa from inbox/i }),
    );
    await waitFor(() => {
      expect(screen.queryByText("removable00aaaaa")).not.toBeInTheDocument();
    });
    // Empty-state copy returns
    expect(
      screen.getByText(/0 wyrds opened in this browser/i),
    ).toBeInTheDocument();
  });
});

afterEach(() => {
  localStorage.clear();
});
