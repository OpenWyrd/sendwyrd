"use client";

/**
 * Permanent bottom-anchored Compose CTA for mobile / installed PWA.
 *
 * Fixed full-width bar at the bottom of the viewport, always reachable
 * with the thumb regardless of scroll position. Renders only at
 * max-width: 640px (see .mobile-compose-bar in globals.css). Skipped on
 * surfaces where it would be redundant or out of place: /compose itself,
 * the landing page (its own large CTA), onboarding/recover ceremonies,
 * and the operator surfaces.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function MobileComposeBar() {
  const pathname = usePathname() ?? "";
  const hide =
    pathname === "/" ||
    pathname === "/compose" ||
    pathname === "/onboarding" ||
    pathname === "/recover" ||
    pathname.startsWith("/ops");

  // Toggle a body class so pages that DO render the bar pad their bottom
  // (under the bar). Hidden surfaces don't get the class — so /compose
  // and the landing page don't carry empty bar-height space at the bottom.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (hide) return;
    document.body.classList.add("has-mobile-compose-bar");
    return () => document.body.classList.remove("has-mobile-compose-bar");
  }, [hide]);

  if (hide) return null;

  return (
    <Link href="/compose" className="mobile-compose-bar">
      compose
    </Link>
  );
}
