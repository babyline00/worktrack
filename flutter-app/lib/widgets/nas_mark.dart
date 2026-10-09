// NAS International brand marks.
//
// Uses the client's own artwork, keyed to transparency and trimmed by
// scripts/build-brand-assets.mjs into assets/brand/. The source is JPEG on
// flat white, which cannot be shown on the dark login hero without a white box,
// so [NasLockup] takes `onDark` to place it on a white card.
//
// This replaced a CustomPainter that reproduced the logo as vector strokes. The
// vector stayed crisp at any size and needed no asset decode, but it was a
// hand-drawn approximation — the real artwork is now used everywhere instead.
import 'package:flutter/material.dart';

/// Asset paths, produced by scripts/build-brand-assets.mjs.
class NasAssets {
  NasAssets._();
  static const lockup = 'assets/brand/nas-lockup.png';
  static const icon = 'assets/brand/nas-icon.png';

  /// Intrinsic aspect ratio of the trimmed lockup (1250 x 461).
  static const double lockupRatio = 1250 / 461;
}

/// Brand colours, taken from the artwork's dark green.
class NasColors {
  NasColors._();
  static const green = Color(0xFF0E3B28);
}

/// The full NAS / INTERNATIONAL lockup.
///
/// The artwork is inherently wide, so it stops being legible below roughly
/// 200px — at 72px the wordmark is unreadable texture and only the big "NAS"
/// reads. Do not scale it into small chrome.
class NasLockup extends StatelessWidget {
  final double width;

  /// Place on a white card. Required on dark backgrounds, since the logo is
  /// dark ink.
  final bool onDark;

  const NasLockup({super.key, this.width = 220, this.onDark = false});

  @override
  Widget build(BuildContext context) {
    final logo = Image.asset(
      NasAssets.lockup,
      width: width,
      height: width / NasAssets.lockupRatio,
      fit: BoxFit.contain,
      // A plain <img> equivalent: asset loading has no intrinsic size in
      // release, so callers must size it, and errors should not throw.
      errorBuilder: (_, __, ___) => SizedBox(width: width, height: width / NasAssets.lockupRatio),
    );

    if (!onDark) return logo;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: logo,
    );
  }
}

/// Square icon version, for places that genuinely need a tile-sized mark.
class NasIcon extends StatelessWidget {
  final double size;

  const NasIcon({super.key, this.size = 32});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      NasAssets.icon,
      width: size,
      height: size,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => SizedBox(width: size, height: size),
    );
  }
}
