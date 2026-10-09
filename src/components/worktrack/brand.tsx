// NAS International brand marks.
//
// The artwork is the client's own file, keyed to transparency and trimmed by
// scripts/build-brand-assets.mjs. It is JPEG-on-white originally, which cannot
// be dropped into a launcher or onto the dark login hero without a white box —
// so every asset here is derived, never the raw file.
//
// In-app marks use the real artwork rather than a hand-drawn vector. The one
// thing to know: it is a *dark* logo. On the dark login hero it sits on a white
// card (see NasLockup), because the ink would otherwise vanish.
import Image from "next/image";

/** Brand constants. Change these, not the call sites. */
export const BRAND = {
  name: "NAS International",
  /** Compact form for tight headers. */
  shortName: "NAS",
  tagline: "Delivering Today • Connecting Tomorrow",
  /** What the product does — used where a descriptor is needed, not the name. */
  descriptor: "Workforce Management",
} as const;

/** Intrinsic aspect ratios of the trimmed assets, used to reserve layout space. */
const LOCKUP_RATIO = 1250 / 461;
const MONOGRAM_RATIO = 1246 / 304;

/**
 * The full NAS / INTERNATIONAL lockup.
 *
 * The artwork is inherently wide (roughly 2.7:1), so below ~200px the wordmark
 * stops being legible. In the sidebar the name is rendered as text alongside it
 * for exactly that reason.
 */
export function NasLockup({
  width = 280,
  className = "",
  /** Put the logo on a white card. Needed on dark backgrounds. */
  onDark = false,
}: {
  width?: number;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <Image
      src="/brand/nas-lockup.png"
      alt={`${BRAND.name} logo`}
      width={width}
      height={Math.round(width / LOCKUP_RATIO)}
      className={onDark ? `rounded-lg bg-white px-4 py-3 ${className}` : className}
    />
  );
}

/**
 * The big "NAS" alone.
 *
 * This is what compact chrome should use. The full lockup is roughly 2.7:1, so
 * below ~200px its "INTERNATIONAL" strip turns into an unreadable smudge — and in
 * the sidebar it would also just repeat the name rendered next to it.
 */
export function NasMonogram({ width = 32, className = "" }: { width?: number; className?: string }) {
  return (
    <Image
      src="/brand/nas-monogram.png"
      alt={`${BRAND.name} logo`}
      width={width}
      height={Math.round(width / MONOGRAM_RATIO)}
      className={className}
    />
  );
}
