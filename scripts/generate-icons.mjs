// Generates every app icon from one source image.
//
// Run with: npm run icons
//
// The files in public/ are OUTPUTS of this script, not sources. Editing one by
// hand is what caused the bug this version exists to fix — see below.
//
// ## The source
//
// `assets/logo-source.png`, the artwork as supplied: a blue rounded square with
// white travel marks, on a transparent canvas with a wide transparent margin.
// Both of those properties are wrong for an app icon and are corrected here
// rather than in the artwork, so the original stays editable.
//
// ## What went wrong before, and why each platform gets a different shape
//
// A previous change replaced `public/apple-touch-icon.png` directly with the
// artwork above. Two consequences, and the first is the one that was reported:
//
//   1. **iOS composites a transparent icon onto black.** 65% of that file was
//      not fully opaque, so the home screen showed a blue square floating on a
//      black tile. An apple-touch-icon must be fully opaque, edge to edge.
//   2. **It was pre-rounded.** iOS applies its own squircle mask, so rounded
//      artwork is masked twice and loses its corners into dark wedges.
//
// And because only that one file was replaced, the other icons still carried
// the previous design — Android and the browser tab showed a different logo
// from the iOS home screen. Deriving all of them from one source is what stops
// that recurring.
//
//   square    — apple-touch-icon.png. Full-bleed, fully opaque, no rounding of
//               its own. iOS rounds it.
//   rounded   — icon-192.png, icon-512.png. Shown as-is by browsers and by the
//               install prompt, so it keeps the artwork's own rounded corners
//               and the transparency outside them.
//   maskable  — icon-maskable-512.png. Android crops to whatever shape the
//               launcher uses, so the artwork sits inside the middle 80% and
//               only the background reaches the edge. Fully opaque.

import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const SOURCE = path.join(ROOT, "assets", "logo-source.png");

// The source is a detailed raster, not flat vector art, so the default PNG
// encoder produced a 358KB 512px icon. A palette cuts that by roughly 4x with
// no visible loss on artwork that uses a handful of flat colours — and these
// files are fetched by an operating system on a phone.
const PNG = { compressionLevel: 9, palette: true, quality: 90 };

// The artwork's own background, sampled rather than hard-coded so a new source
// image does not silently keep the old colour. Used to fill the transparency:
// blue on blue makes the rounded corners disappear, which is exactly what
// "full-bleed" means here.
async function backgroundColour(image) {
  const { data, info } = await image
    .clone()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const counts = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    // Fully opaque pixels only: a semi-transparent edge pixel is a blend of the
    // background with nothing, and would drag the average toward white.
    if (info.channels > 3 && data[i + 3] < 255) continue;
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const [r, g, b] = best.split(",").map(Number);
  return { r, g, b };
}

// The artwork with its transparent margin removed — the rounded square itself,
// filling the frame.
function artwork() {
  return sharp(SOURCE).trim();
}

async function main() {
  const trimmed = await artwork().toBuffer({ resolveWithObject: true });
  const background = await backgroundColour(sharp(trimmed.data));

  const hex = `#${[background.r, background.g, background.b]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
  console.log(`source ${trimmed.info.width}x${trimmed.info.height}, background ${hex}`);

  // --- iOS: opaque, full-bleed, unrounded ---------------------------------
  // `flatten` is what fixes the black tile: it replaces the alpha channel with
  // the background colour, so the rounded corners fill in and nothing is left
  // for iOS to composite onto black.
  //
  // 180x180 to match the size declared in app/layout.tsx. It was previously
  // 1024x1024 and 525KB, which every iOS device downloaded and downscaled.
  await sharp(trimmed.data)
    .resize(180, 180)
    .flatten({ background })
    .png(PNG)
    .toFile(path.join(PUBLIC, "apple-touch-icon.png"));
  console.log("  apple-touch-icon.png (180x180, opaque)");

  // --- Browsers and the install prompt: keep the artwork's own shape -------
  for (const size of [192, 512]) {
    await sharp(trimmed.data)
      .resize(size, size)
      .png(PNG)
      .toFile(path.join(PUBLIC, `icon-${size}.png`));
    console.log(`  icon-${size}.png (${size}x${size}, rounded)`);
  }

  // --- Android maskable: artwork in the middle 80%, background to the edge --
  const SAFE = 0.8;
  const inner = Math.round(512 * SAFE);
  const pad = Math.round((512 - inner) / 2);

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { ...background, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(trimmed.data).resize(inner, inner).png().toBuffer(),
        top: pad,
        left: pad,
      },
    ])
    .png(PNG)
    .toFile(path.join(PUBLIC, "icon-maskable-512.png"));
  console.log(`  icon-maskable-512.png (512x512, artwork at ${SAFE * 100}%)`);

  // --- Browser tab --------------------------------------------------------
  // The tab icon used to be create-next-app's default favicon.ico, untouched
  // since the project was scaffolded, while the home screen showed the real
  // logo — three different marks in one app.
  //
  // PNG rather than .ico: every browser in use supports it, and a
  // multi-resolution .ico cannot be written by sharp, which is part of why the
  // stale one survived so long. Opaque, because a tab strip can be dark.
  //
  // 32 only: a 180px favicon came out byte-identical to apple-touch-icon.png,
  // which is the same image at the same size for a different purpose.
  for (const size of [32]) {
    await sharp(trimmed.data)
      .resize(size, size)
      .flatten({ background })
      .png(PNG)
      .toFile(path.join(PUBLIC, `favicon-${size}.png`));
    console.log(`  favicon-${size}.png (${size}x${size}, opaque)`);
  }

  console.log("done");
}

await main();
