// NAS International brand marks.
//
// The assets live in /public so they can be fetched directly (favicon, app
// icon, Flutter). This component wraps the monogram for in-app placement so the
// sidebar, the login hero and the employee portal cannot drift apart — the
// placeholders they replaced were three different hand-drawn SVGs.
//
// The full lockup is rendered as an <img> rather than inlined, because it relies
// on text metrics and stays legible only above roughly 200px wide.
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

/**
 * The NAS monogram in a rounded green tile.
 *
 * Inlined rather than an <img> so it inherits crisp rendering at any size and
 * needs no network round trip on first paint.
 */
export function NasMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      className={className}
      role="img"
      aria-label={`${BRAND.name} logo`}
      // Decorative by default: every call site sits next to the brand name as
      // text, so announcing it again would be noise for screen readers.
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="nasMarkGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5BB4A" />
          <stop offset="100%" stopColor="#C88A2A" />
        </linearGradient>
        <linearGradient id="nasMarkGreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1B5E3F" />
          <stop offset="100%" stopColor="#0E3B28" />
        </linearGradient>
        {/* Gradient ids are document-global, so two marks on one page would
            otherwise collide and both resolve to whichever was defined last. */}
        <clipPath id="nasMarkClip">
          <rect x="0" y="0" width="160" height="160" rx="30" />
        </clipPath>
      </defs>

      <g clipPath="url(#nasMarkClip)">
        <rect width="160" height="160" fill="url(#nasMarkGreen)" />
        <path
          d="M18 128 C 54 114, 108 113, 143 130"
          fill="none"
          stroke="#F2B441"
          strokeWidth="4.5"
          strokeLinecap="round"
          opacity="0.55"
        />
      </g>

      <g
        transform="translate(80 80) skewX(-8) translate(-80 -80)"
        fill="none"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      >
        <path d="M22 108 L22 52 L52 108 L52 52" stroke="#FFFFFF" strokeWidth="14" />
        <path d="M64 108 L80 52 L96 108" stroke="url(#nasMarkGold)" strokeWidth="14" />
        <path d="M70.5 86 L89.5 86" stroke="url(#nasMarkGold)" strokeWidth="9" />
        <path
          d="M140 64 C136 55 128 50 120 51 C109 53 106 63 114 71
             C121 78 133 80 137 89 C142 99 135 109 124 109
             C115 109 109 105 106 99"
          stroke="#FFFFFF"
          strokeWidth="14"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * The full lockup — mark, wordmark and tagline.
 *
 * Only for placements with real room. The wordmark uses `textLength` inside the
 * SVG, which stretches the glyphs to a fixed width — below about 180px the
 * letters visibly distort, so prefer [NasMark] plus a text label in compact
 * chrome.
 */
export function NasLockup({ width = 280, className = "" }: { width?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/nas-logo.svg"
      alt={`${BRAND.name} — ${BRAND.tagline}`}
      width={width}
      height={Math.round((width * 170) / 620)}
      className={className}
    />
  );
}