"use client";

/**
 * Legacy public-form redirect.
 *
 * Per ADR-021, the public-form addressing path was removed in favor of
 * single-form (fragment) addressing. This route exists only to preserve
 * URLs already shared in the wild: it client-side redirects
 *   /w/{handle}/k/{k_read}  →  /w/{handle}#{k_read}
 *
 * The K_read briefly transits the host's logs at redirect time (since it
 * was always in the path for this URL form). After redirect, K_read lives
 * in the fragment and is never sent to the server again. This is no worse
 * than the original public-form contract; legacy URLs continue to resolve.
 */

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function PublicFormRedirect() {
  const params = useParams<{ handle: string; k_read: string }>();
  useEffect(() => {
    if (!params.handle || !params.k_read) return;
    window.location.replace(`/w/${params.handle}#${params.k_read}`);
  }, [params.handle, params.k_read]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--spacing-12) var(--spacing-6)",
        fontFamily: "var(--font-mono)",
        color: "var(--color-ink-muted)",
        fontSize: "var(--text-caption)",
      }}
    >
      <noscript>
        This URL form is no longer supported. Enable JavaScript, or replace
        <code> /k/&lt;key&gt;</code> with <code>#&lt;key&gt;</code> in the URL.
      </noscript>
    </main>
  );
}
