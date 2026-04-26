/**
 * Compose page integration — typing → counter → submit → share URL.
 *
 * Mocks:
 *   - `next/navigation`   (router stub)
 *   - global fetch        (intercepts POST /api/v1/wyrds)
 *   - `@/lib/api`         (shape-checks the publish payload)
 *
 * Real:
 *   - seedClient (open mode + counter), wyrdHistory, persistentStorage,
 *     core compose primitive — these run for real against jsdom.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/compose",
}));

// Stub publishWyrd to avoid network calls and capture the payload shape.
const publishMock = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    publishWyrd: (...args: unknown[]) => publishMock(...args),
  };
});

import ComposePage from "@/app/compose/page";
import { forgetSeed, hasSeed } from "@/lib/seedClient";
import { listHistory, clearHistory } from "@/lib/wyrdHistory";

beforeEach(() => {
  forgetSeed();
  clearHistory();
  publishMock.mockReset();
  // Default success response — individual tests may override.
  publishMock.mockResolvedValue({
    handle: "AAAAAAAAAAAAAAAA",
    published_at: 1_700_000_000_000,
    expires_at: 1_710_000_000_000,
  });
  // Reset URL params jsdom carries between tests.
  window.history.replaceState(null, "", "/compose");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Compose — auto-generated seed (zero-friction default)", () => {
  it("auto-generates a seed silently on first visit", async () => {
    expect(hasSeed()).toBe(false);
    render(<ComposePage />);
    // Wait for the textarea to appear (post-effect mount).
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/A wyrd…/)).toBeInTheDocument();
    });
    // Seed should now exist in open mode.
    expect(hasSeed()).toBe(true);
  });
});

describe("Compose — counter + over-cap", () => {
  it("updates the codepoint counter as the user types", async () => {
    const user = userEvent.setup();
    render(<ComposePage />);
    const textarea = await screen.findByPlaceholderText(/A wyrd…/);
    await user.type(textarea, "hello");
    expect(screen.getByText(/5 \/ 300/)).toBeInTheDocument();
  });

  it("disables Compose when body is empty", async () => {
    render(<ComposePage />);
    const send = await screen.findByRole("button", { name: /^Compose$/ });
    expect(send).toBeDisabled();
  });

  it("enables Compose when body has content", async () => {
    const user = userEvent.setup();
    render(<ComposePage />);
    const textarea = await screen.findByPlaceholderText(/A wyrd…/);
    await user.type(textarea, "ok");
    const send = await screen.findByRole("button", { name: /^Compose$/ });
    expect(send).not.toBeDisabled();
  });
});

describe("Compose — successful publish", () => {
  it("invokes publishWyrd with a properly-shaped payload and renders share URL + Copy", async () => {
    const user = userEvent.setup();
    render(<ComposePage />);
    const textarea = await screen.findByPlaceholderText(/A wyrd…/);
    await user.type(textarea, "the wyrd body");
    const send = await screen.findByRole("button", { name: /^Compose$/ });
    await user.click(send);

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
    expect(typeof payload.handle).toBe("string");

    // Share URL surfaces with a Copy button.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Copy share URL/ }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/Sent\. Share this URL/)).toBeInTheDocument();

    // The wyrd lands in local history.
    expect(listHistory()).toHaveLength(1);
  });

  it("surfaces an inline error if publishWyrd rejects with { error }", async () => {
    publishMock.mockResolvedValue({ error: "rate_limited" });
    const user = userEvent.setup();
    render(<ComposePage />);
    const textarea = await screen.findByPlaceholderText(/A wyrd…/);
    await user.type(textarea, "x");
    const send = await screen.findByRole("button", { name: /^Compose$/ });
    await user.click(send);
    await waitFor(() => {
      expect(screen.getByText(/Publish failed: rate_limited/)).toBeInTheDocument();
    });
  });
});

describe("Compose — Web Share Target prefill", () => {
  it("prefills body from ?text=foo&url=bar", async () => {
    window.history.replaceState(
      null,
      "",
      "/compose?text=hello&url=https%3A%2F%2Fexample.com",
    );
    render(<ComposePage />);
    const textarea = (await screen.findByPlaceholderText(
      /A wyrd…/,
    )) as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toContain("hello");
      expect(textarea.value).toContain("https://example.com");
    });
  });

  it("prefills with title + text + url joined by newlines", async () => {
    window.history.replaceState(
      null,
      "",
      "/compose?title=T&text=B&url=https%3A%2F%2Fz.com",
    );
    render(<ComposePage />);
    const textarea = (await screen.findByPlaceholderText(
      /A wyrd…/,
    )) as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe("T\nB\nhttps://z.com");
    });
  });
});
