// Derives publishable brand assets from the supplied NAS International artwork.
//
// The source files are JPEG on flat white with no alpha, which cannot be used
// for a launcher icon or on the dark login hero — both would show a white box.
// This keys the near-white background out to transparency with a soft edge, so
// JPEG ringing does not leave a halo.
//
// Usage: node scripts/build-brand-assets.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "public/brand";

// JPEG background never reaches a true 255 — it samples 252..255 with ringing
// noise around the artwork. Keying on 255 alone left a translucent white film
// over the whole canvas (measured alpha 22 in the corner). These bounds clear
// the real background range while keeping the soft edge.
const FADE_FROM = 248;
const OPAQUE_BELOW = 225;

/** Keys the near-white background out to an alpha channel. */
async function keyOutWhite(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    // Darkest channel. A pixel is "background" only when *all* channels are
    // near-white, so a pale gold or pale green pixel in the artwork is kept.
    const darkest = Math.min(data[i], data[i + 1], data[i + 2]);

    let alpha = 255;
    if (darkest >= FADE_FROM) alpha = 0;
    else if (darkest > OPAQUE_BELOW) {
      const t = (darkest - OPAQUE_BELOW) / (FADE_FROM - OPAQUE_BELOW);
      alpha = Math.round(255 * (1 - t));
    }
    data[i + 3] = alpha;
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

/** Trims to the artwork's bounding box and returns a buffer + size. */
async function trimmed(keyed) {
  // Round-trip to PNG first so trim sees the alpha channel, then trim on alpha.
  const keyedPng = await keyed.png().toBuffer();
  const buf = await sharp(keyedPng)
    .trim({ threshold: 1, alpha: true })
    .png()
    .toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, width: meta.width, height: meta.height };
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // ---------------------------------------------------------------- lockup
  // The wide NAS / INTERNATIONAL lockup, for in-app marks.
  const lockup = await trimmed(await keyOutWhite("public/nas-logo.jpeg"));
  console.log(
    `  lockup       ${lockup.width}x${lockup.height}  ` +
      `${(lockup.buf.length / 1024).toFixed(0)} KB`,
  );
  await sharp(lockup.buf)
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/nas-lockup.png`);

  // ---------------------------------------------------------------- icon
  // Square canvas with the lockup fitted inside, for launcher icons and the
  // favicon. Padding is generous because Android applies its own mask/shrink.
  const PAD = 0.14;
  const inner = Math.round(Math.min(lockup.width, lockup.height) * 0) || null; // placeholder
  const box = Math.round(Math.max(lockup.width, lockup.height));
  const artW = Math.round(box * (1 - PAD * 2));
  const artH = Math.round(lockup.height * (artW / lockup.width));

  const iconBase = await sharp({
    create: {
      width: box,
      height: box,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp(lockup.buf)
          .resize(artW, artH, { fit: "fill" })
          .png()
          .toBuffer(),
        left: Math.round((box - artW) / 2),
        top: Math.round((box - artH) / 2),
      },
    ])
    .png()
    .toBuffer();

  console.log(`  icon canvas  ${box}x${box}`);

  // ---------------------------------------------------------------- monogram
  // The big "NAS" alone, cropped from the top of the lockup.
  //
  // The full lockup is ~2.7:1, so below ~200px the "INTERNATIONAL" strip
  // degrades into an unreadable smudge. Compact chrome (the sidebar, the mobile
  // header) uses this instead.
  const MONO_CROP = 0.66; // fraction of the lockup height that is the "NAS"
  //
  // Crop from the *trimmed* lockup, not from a fresh read of the source. The
  // source is 1600x639 while the trimmed lockup is 1250x461, so extracting
  // lockup-sized coordinates from the source silently sliced off the right of
  // the artwork and cut the letters off at the bottom.
  const monoCrop = await sharp(lockup.buf)
    .extract({
      left: 0,
      top: 0,
      width: lockup.width,
      height: Math.round(lockup.height * MONO_CROP),
    })
    .png()
    .toBuffer();
  const monoBuf = await sharp(monoCrop)
    .trim({ threshold: 1, alpha: true })
    .png()
    .toBuffer();
  const monoMeta = await sharp(monoBuf).metadata();
  const mono = { buf: monoBuf, width: monoMeta.width, height: monoMeta.height };
  console.log(`  monogram     ${mono.width}x${mono.height}`);
  await sharp(mono.buf).png({ compressionLevel: 9 }).toFile(`${OUT}/nas-monogram.png`);

  // ---------------------------------------------------------------- outputs
  // Android launcher icons.
  const android = {
    mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192,
  };
  for (const [density, px] of Object.entries(android)) {
    await sharp(iconBase)
      .resize(px, px, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toFile(
        `flutter-app/android/app/src/main/res/mipmap-${density}/ic_launcher.png`,
      );
    console.log(`  android ${density.padEnd(8)} ${px}x${px}`);
  }

  // Web icons.
  await sharp(iconBase)
    .resize(512, 512, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/nas-icon-512.png`);
  await sharp(iconBase)
    .resize(180, 180, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile("src/app/apple-icon.png");
  // Next.js App Router picks up src/app/icon.* as the favicon. The old
  // src/app/icon.svg is a hand-drawn vector and is removed in favour of this.
  await sharp(iconBase)
    .resize(64, 64, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile("src/app/icon.png");
  console.log("  web          src/app/icon.png, src/app/apple-icon.png");

  // Flutter asset bundle.
  await sharp(lockup.buf)
    .resize({ width: 900 })
    .png({ compressionLevel: 9 })
    .toFile("flutter-app/assets/brand/nas-lockup.png");
  await sharp(mono.buf)
    .resize({ width: 600 })
    .png({ compressionLevel: 9 })
    .toFile("flutter-app/assets/brand/nas-monogram.png");
  await sharp(iconBase)
    .resize(512, 512, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile("flutter-app/assets/brand/nas-icon.png");
  console.log("  flutter      assets/brand/");

  void inner;
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});