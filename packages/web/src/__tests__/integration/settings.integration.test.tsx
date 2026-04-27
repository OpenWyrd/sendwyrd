/**
 * Settings page integration — recovery flow + persistent-storage section.
 *
 * Covers the spec: invalid-mnemonic error, valid-mnemonic + presence-check
 * stub returning 1 handle, and tri-state copy for persistent-storage UI.
 *
 * Mocks:
 *   - next/navigation router (stable singleton — see wyrds notes)
 *   - global fetch (presence-check stub)
 *   - lib/persistentStorage (so we can drive the tri-state)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableRouter = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  usePathname: () => "/settings",
}));

// Drive the persistent-storage section deterministically.
const persistenceState = {
  supported: true,
  granted: null as boolean | null,
  asked: false,
};
vi.mock("@/lib/persistentStorage", () => ({
  getPersistenceState: vi.fn(() => Promise.resolve({ ...persistenceState })),
  getStorageEstimate: vi.fn(() =>
    Promise.resolve({ usage: 1024, quota: 10_240, percent: 10 }),
  ),
  formatBytes: (n: number) => `${n}B`,
  requestPersistence: vi.fn(() =>
    Promise.resolve({ supported: true, granted: true, asked: true }),
  ),
}));

import SettingsPage from "@/app/settings/page";
import { storeOpenSeed, forgetSeed } from "@/lib/seedClient";

// A known-valid 12-word BIP-39 phrase.
const VALID_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

beforeEach(() => {
  forgetSeed();
  // Default presence-check stub: empty handle list (so sweep terminates fast
  // without recovering anything). Specific tests override.
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ handles: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    ),
  );
  // Provide a baseline seed so the page renders all sections.
  const seed = new Uint8Array(64);
  seed.fill(0x44);
  storeOpenSeed({ seed, counter: 0, mnemonic: "m1 m2 m3" });
  // Reset persistence-state defaults each test.
  persistenceState.supported = true;
  persistenceState.granted = null;
  persistenceState.asked = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Settings — recovery flow", () => {
  it("rejects an invalid mnemonic with a clear error", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const recoverBtn = await screen.findByRole("button", {
      name: /Recover from mnemonic/,
    });
    await user.click(recoverBtn);
    // Paste a plausible-but-checksum-invalid 12-word phrase into the first box.
    // The MnemonicInput distributes across boxes on multi-word paste.
    const allTextboxes = await screen.findAllByRole("textbox");
    const firstBox = allTextboxes[0]!;
    await user.click(firstBox);
    await user.paste(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon",
    );
    const begin = screen.getByRole("button", { name: /Begin sweep/ });
    await user.click(begin);
    await waitFor(() => {
      expect(screen.getByText(/Invalid mnemonic/i)).toBeInTheDocument();
    });
  });

  it("runs the sweep with a valid mnemonic and reports results", async () => {
    // First presence-check returns 1 handle, then empties for the gap-limit.
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        callCount += 1;
        const body =
          callCount === 1
            ? {
                handles: [
                  {
                    handle: "AAAAAAAAAAAAAAAA",
                    published_at: 1_700_000_000_000,
                    expires_at: 1_710_000_000_000,
                    replies_enabled: true,
                  },
                ],
              }
            : { handles: [] };
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }),
    );

    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(
      await screen.findByRole("button", { name: /Recover from mnemonic/ }),
    );
    const allTextboxes = await screen.findAllByRole("textbox");
    const firstBox = allTextboxes[0]!;
    await user.click(firstBox);
    await user.paste(VALID_MNEMONIC);
    await user.click(screen.getByRole("button", { name: /Begin sweep/ }));

    // Sweep takes a few presence-check rounds (gap-limit = 20). Wait for the
    // result message.
    await waitFor(
      () => {
        expect(screen.getByText(/Recovered 1 wyrd/i)).toBeInTheDocument();
      },
      { timeout: 8000 },
    );
  }, 12_000);
});

describe("Settings — persistent-storage tri-state copy", () => {
  it("renders 'granted' copy when storage is granted", async () => {
    persistenceState.granted = true;
    persistenceState.asked = true;
    render(<SettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/Persistent storage granted/),
      ).toBeInTheDocument();
    });
  });

  it("renders 'denied after asking' copy when granted=false + asked=true", async () => {
    persistenceState.granted = false;
    persistenceState.asked = true;
    render(<SettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/hasn.t granted persistent storage/i),
      ).toBeInTheDocument();
    });
  });

  it("renders 'not asked yet' copy when granted=false + asked=false", async () => {
    persistenceState.granted = false;
    persistenceState.asked = false;
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText(/not yet requested/i)).toBeInTheDocument();
    });
  });

  it("renders unsupported copy when StorageManager API is missing", async () => {
    persistenceState.supported = false;
    persistenceState.granted = null;
    persistenceState.asked = false;
    render(<SettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/doesn.t expose persistent-storage APIs/),
      ).toBeInTheDocument();
    });
  });
});
