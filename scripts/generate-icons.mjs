// Generates every app icon from one source image.
//
// Run with: npm run icons
//
// The files in public/ are OUTPUTS of this script, not sources. Editing one by
// hand is what caused the bug an earlier version of this script was written to
// fix: only apple-touch-icon.png was replaced, and Android and the browser tab
// went on showing the previous logo.
//
// ## The source
//
// `assets/logo-source.svg` — the owner's Stitch logo (design/stitch/…/applogo,
// 2026-09-23): a 512×512 squircle with the maritime gradient, a compass star,
// the route arc and the "MyTrip" wordmark. It replaced a raster PNG, and being
// vector is what lets each size below be rendered from the artwork itself
// rather than downscaled from one bitmap.
//
// The wordmark names Rubik, which librsvg (inside sharp) does not have; it
// falls back to the system sans in heavy weight, which is close enough at icon
// sizes and needs no font file in the repo.
//
// ## Why each platform gets a different shape
//
//   square    — apple-touch-icon.png. Full-bleed, fully opaque, no rounding of
//               its own. iOS composites transparency onto black (a blue square
//               on a black tile) and applies its own squircle mask, so rounded
//               artwork would be rounded twice. The base rect loses its `rx`.
//   rounded   — icon-192.png, icon-512.png. Shown as-is by browsers and by the
//               install prompt, so they keep the artwork's own corners.
//   maskable  — icon-maskable-512.png. Android crops to its launcher's shape,
//               so the marks sit inside the middle 80% and only the gradient
//               reaches the edge.
//   favicon   — favicon-32.png. Square and without the wordmark: at 32px the
//               letters are a grey smear, and the star is the mark.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const SOURCE = path.join(ROOT, "assets", "logo-source.svg");

// Full colour, not a palette. A 256-colour palette was used for the raster
// logo this replaced, and on this artwork it broke the diagonal gradient into
// a visible slab of the wrong blue in the dark corner. Full colour costs a few
// tens of KB at 512px, which is fine for a file an OS fetches once.
const PNG = { compressionLevel: 9, adaptiveFiltering: true };

// The artwork's base, the one element every variant edits.
const BASE = /<rect width="512" height="512" rx="112" fill="url\(#bg-grad\)"\/>/;

function variant(svg, { square = false, wordmark = true, inset = 1 } = {}) {
  if (!BASE.test(svg)) {
    throw new Error("logo-source.svg: the 512×512 base rect was not found");
  }
  let out = svg;
  if (!wordmark) out = out.replace(/<text[\s\S]*?<\/text>/, "");
  if (inset !== 1) {
    // Everything after the base rect moves into the safe zone; the gradient
    // itself stays full-bleed.
    const pad = (512 * (1 - inset)) / 2;
    out = out
      .replace(BASE, (base) => `${base}<g transform="translate(${pad} ${pad}) scale(${inset})">`)
      .replace(/<\/svg>\s*$/, "</g></svg>");
  }
  if (square) out = out.replace(BASE, (base) => base.replace(' rx="112"', ""));
  return Buffer.from(out);
}

// Rendered at a density that puts the 512 viewBox well above the target size,
// then resized down — librsvg's own rasterising at small sizes is softer.
function render(svg, size) {
  return sharp(svg, { density: Math.max(72, (72 * size * 2) / 512) }).resize(
    size,
    size,
  );
}

async function main() {
  const svg = await readFile(SOURCE, "utf8");

  await render(variant(svg, { square: true }), 180)
    .flatten({ background: "#0369a1" })
    .png(PNG)
    .toFile(path.join(PUBLIC, "apple-touch-icon.png"));
  console.log("  apple-touch-icon.png (180x180, square, opaque)");

  for (const size of [192, 512]) {
    await render(variant(svg), size)
      .png(PNG)
      .toFile(path.join(PUBLIC, `icon-${size}.png`));
    console.log(`  icon-${size}.png (${size}x${size}, rounded)`);
  }

  await render(variant(svg, { square: true, inset: 0.8 }), 512)
    .flatten({ background: "#0369a1" })
    .png(PNG)
    .toFile(path.join(PUBLIC, "icon-maskable-512.png"));
  console.log("  icon-maskable-512.png (512x512, marks at 80%)");

  await render(variant(svg, { square: true, wordmark: false }), 32)
    .flatten({ background: "#0369a1" })
    .png(PNG)
    .toFile(path.join(PUBLIC, "favicon-32.png"));
  console.log("  favicon-32.png (32x32, square, no wordmark)");

  console.log("done");
}

await main();
