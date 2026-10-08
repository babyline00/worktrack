// Photo compression for attendance uploads.
//
// The app used to upload the camera's full-resolution JPEG straight to
// `/mobile/attendance/check-in`. On a mid-range Android phone that preset
// produces a 1.5-4 MB file, and the bytes go over a mobile connection into a
// LONGBLOB in MySQL — so a check-in sat on a spinner for many seconds for
// several hundred kilobytes of actual detail.
//
// Downscaling and re-encoding before upload cuts the payload by roughly an order
// of magnitude. The server's `looksLikeImage` magic-byte check only cares that
// the bytes really are an image, so a re-encoded JPEG is fully compatible.
import 'dart:io';

import 'package:flutter_image_compress/flutter_image_compress.dart';

class PhotoCompressor {
  PhotoCompressor._();

  /// Target longest edge, in pixels.
  ///
  /// A selfie is proof of presence, not a portrait print. 720px is enough for
  /// an admin to identify the person and for the web dashboard to render a
  /// thumbnail.
  static const int maxDimension = 720;

  /// JPEG quality. 75 is the point where further reduction is clearly visible in
  /// the image and starts costing facial detail, which is the one thing a
  /// verification photo must not lose.
  static const int jpegQuality = 75;

  /// Files at or below this size are already cheap to send and re-encoding them
  /// would only lose quality for no meaningful saving.
  static const int _skipBelowBytes = 250 * 1024;

  /// Returns a path to an upload-ready copy of [path], or [path] itself when
  /// compressing is unnecessary or fails.
  ///
  /// Compression is best-effort by design: a failure must never block a
  /// check-in, so the original is returned and the upload proceeds.
  static Future<String> compressForUpload(String path) async {
    final file = File(path);
    final originalSize = await file.length();

    if (originalSize <= _skipBelowBytes) return path;

    final tempPath = '$path.compressed.jpg';

    try {
      final bytes = await FlutterImageCompress.compressAndGetFile(
        path,
        tempPath,
        minWidth: maxDimension,
        minHeight: maxDimension,
        // Keeps the JPEG container, so the server still sees image/jpeg.
        format: CompressFormat.jpeg,
        quality: jpegQuality,
      );

      if (bytes == null) return path;

      final compressedSize = await File(tempPath).length();
      // Re-encoding made it bigger — keep the original rather than uploading
      // the worse of the two.
      if (compressedSize >= originalSize) {
        await _deleteQuietly(tempPath);
        return path;
      }

      // Swap the capture over to the compressed copy so the preview shows what
      // was actually uploaded, and so the retake path cleans up the right file.
      await _deleteQuietly(path);
      return tempPath;
    } catch (_) {
      await _deleteQuietly(tempPath);
      return path;
    }
  }

  static Future<void> _deleteQuietly(String path) async {
    try {
      await File(path).delete();
    } catch (_) {
      // best-effort cleanup
    }
  }
}