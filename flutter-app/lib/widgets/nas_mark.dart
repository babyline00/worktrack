// The NAS International monogram.
//
// Painted rather than loaded as an image so it stays crisp at every size, needs
// no bundled asset, and avoids adding flutter_svg just for a logo. The geometry
// matches /public/nas-mark.svg exactly — the two must be changed together.
import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Brand colours, mirroring the web app's `--nas-*` tokens.
class NasColors {
  NasColors._();
  static const greenLight = Color(0xFF1B5E3F);
  static const greenDark = Color(0xFF0E3B28);
  static const goldLight = Color(0xFFF5BB4A);
  static const goldDark = Color(0xFFC88A2A);
  static const goldArc = Color(0xFFF2B441);
  static const tagline = Color(0xFF1F3A33);
}

/// Design-space size the geometry below is authored in. Everything is scaled
/// from this to the requested widget size.
const double _kDesign = 160;

class NasMark extends StatelessWidget {
  final double size;

  const NasMark({super.key, this.size = 40});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _NasMarkPainter()),
    );
  }
}

class _NasMarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide / _kDesign;
    canvas.save();
    canvas.scale(s);

    final tile = RRect.fromRectAndRadius(
      const Rect.fromLTWH(0, 0, _kDesign, _kDesign),
      const Radius.circular(30),
    );

    // Tile: diagonal green gradient, matching the SVG's nas-rim.
    canvas.drawRRect(
      tile,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [NasColors.greenLight, NasColors.greenDark],
        ).createShader(const Rect.fromLTWH(0, 0, _kDesign, _kDesign)),
    );

    // The gold arc that sweeps through the logo.
    final arc = Path()
      ..moveTo(18, 128)
      ..cubicTo(54, 114, 108, 113, 143, 130);
    canvas.drawPath(
      arc,
      Paint()
        ..color = NasColors.goldArc.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4.5
        ..strokeCap = StrokeCap.round,
    );

    // The monogram leans forward. Reproduced with a shear about the centre so
    // the stroke weight stays even across all three letters.
    canvas.save();
    canvas.translate(_kDesign / 2, _kDesign / 2);
    canvas.transform(Matrix4.skewX(-8 * math.pi / 180).storage);
    canvas.translate(-_kDesign / 2, -_kDesign / 2);

    final gold = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [NasColors.goldLight, NasColors.goldDark],
      ).createShader(const Rect.fromLTWH(60, 45, 40, 70))
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.butt
      ..strokeJoin = StrokeJoin.miter;

    final white = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.butt
      ..strokeJoin = StrokeJoin.miter;

    // N
    final n = Path()
      ..moveTo(22, 108)
      ..lineTo(22, 52)
      ..lineTo(52, 108)
      ..lineTo(52, 52);
    canvas.drawPath(n, white..strokeWidth = 14);

    // A, with a crossbar so it reads as a letter and not a peak.
    final a = Path()
      ..moveTo(64, 108)
      ..lineTo(80, 52)
      ..lineTo(96, 108);
    canvas.drawPath(a, gold..strokeWidth = 14);
    canvas.drawPath(
      Path()
        ..moveTo(70.5, 86)
        ..lineTo(89.5, 86),
      gold..strokeWidth = 9,
    );

    // S
    final sPath = Path()
      ..moveTo(140, 64)
      ..cubicTo(136, 55, 128, 50, 120, 51)
      ..cubicTo(109, 53, 106, 63, 114, 71)
      ..cubicTo(121, 78, 133, 80, 137, 89)
      ..cubicTo(142, 99, 135, 109, 124, 109)
      ..cubicTo(115, 109, 109, 105, 106, 99);
    canvas.drawPath(
      sPath,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 14
        ..strokeCap = StrokeCap.round,
    );

    canvas.restore();
    canvas.restore();
  }

  @override
  bool shouldRepaint(_NasMarkPainter oldDelegate) => false;
}