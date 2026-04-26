/**
 * vitest + jsdom global setup.
 *
 * - Wires `@testing-library/jest-dom` matchers onto vitest's `expect`.
 * - Resets DOM + storage + mocks between tests so suites can be order-
 *   independent.
 * - Provides minimal shims for browser globals jsdom misses
 *   (matchMedia, IntersectionObserver) — components touch them at mount.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library teardown — unmounts components, clears the document.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

beforeEach(() => {
  // Reset jsdom location.hash; some tests mutate it.
  if (window.location.hash) {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
});

// matchMedia — referenced by installPrompt.isInstalled() and theme handling.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// IntersectionObserver — Next/Link uses it under the hood.
if (!("IntersectionObserver" in window)) {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // @ts-expect-error - shimming missing global
  window.IntersectionObserver = IO;
}
