/**
 * One-off icon generator. Renders the wyrd sigil to PNG at PWA-required sizes.
 *
 * Usage: node packages/web/scripts/generate-icons.mjs
 *
 * Requires ImageMagick (`magick` CLI) on PATH. Pure stdlib otherwise — no
 * runtime dep added. Re-run only when the sigil geometry changes.
 *
 * Renders are written to packages/web/public/icons/.
 *
 * Sigil geometry (matches WyrdSigil.tsx, viewBox 32x32):
 *   stroke 1: M 5 5 L 16 18 L 11 27   (outer-left + descender)
 *   stroke 2: M 27 5 L 16 18 L 21 27  (outer-right + descender)
 *   stroke 3: M 16 5 L 16 18          (middle)
 *   knot:    circle (16, 18) r=1.25
 *
 * Color tokens (from globals.css):
 *   ground = #0a0a0a (dark theme canonical)
 *   ink    = #ededed
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/icons");
mkdirSync(OUT, { recursive: true });

const GROUND = "#0a0a0a";
const INK = "#ededed";

/**
 * Render the sigil at the given output size, with the given uniform padding
 * (in output pixels). Standard icons use ~12% padding; maskable uses ~22%
 * padding so the inner 80% safe zone preserves the mark under aggressive
 * masking (per https://www.w3.org/TR/appmanifest/#purpose-member).
 */
function renderSigil({ size, padding, outFile }) {
  // Native sigil viewBox is 32x32; the visible bounds are roughly (5,5)
  // to (27,27). For uniform centering we scale the full 32x32 box and
  // translate by `padding`.
  const inner = size - 2 * padding;
  const scale = inner / 32;
  const sw = Math.max(2, Math.round(scale * 1.5)); // stroke width

  // Translate sigil coords into the canvas.
  const t = (x, y) => [padding + x * scale, padding + y * scale];

  const [a1x, a1y] = t(5, 5);
  const [a2x, a2y] = t(16, 18);
  const [a3x, a3y] = t(11, 27);
  const [b1x, b1y] = t(27, 5);
  const [b3x, b3y] = t(21, 27);
  const [c1x, c1y] = t(16, 5);
  const [kx, ky] = t(16, 18);
  const knotR = Math.max(2, Math.round(scale * 1.25));

  const args = [
    "-size", `${size}x${size}`,
    `xc:${GROUND}`,
    "-stroke", INK, "-fill", "none",
    "-strokewidth", String(sw),
    "-draw", `stroke-linecap round stroke-linejoin round path 'M ${a1x},${a1y} L ${a2x},${a2y} L ${a3x},${a3y}'`,
    "-draw", `stroke-linecap round stroke-linejoin round path 'M ${b1x},${b1y} L ${a2x},${a2y} L ${b3x},${b3y}'`,
    "-draw", `stroke-linecap round path 'M ${c1x},${c1y} L ${a2x},${a2y}'`,
    "-fill", INK, "-stroke", "none",
    "-draw", `circle ${kx},${ky} ${kx},${ky + knotR}`,
    outFile,
  ];

  execFileSync("magick", args, { stdio: "inherit" });
  console.log(`wrote ${outFile}`);
}

// Standard icons: ~12% padding for tab/launcher chrome.
renderSigil({ size: 192, padding: 24, outFile: resolve(OUT, "icon-192.png") });
renderSigil({ size: 512, padding: 64, outFile: resolve(OUT, "icon-512.png") });

// Apple touch icon: 180x180, slightly smaller padding (iOS rounds the corners
// itself, so leave breathing room).
renderSigil({ size: 180, padding: 22, outFile: resolve(OUT, "apple-touch-icon.png") });

// Maskable icons: ~22% padding so the safe zone (inner 80%) fully contains
// the mark even after aggressive circular masking.
renderSigil({ size: 192, padding: 42, outFile: resolve(OUT, "icon-maskable-192.png") });
renderSigil({ size: 512, padding: 112, outFile: resolve(OUT, "icon-maskable-512.png") });
