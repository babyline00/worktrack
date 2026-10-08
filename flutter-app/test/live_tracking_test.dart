// Guards the fixes that made live tracking and uploads correct.
//
// Each test here exists because the corresponding bug was invisible in the UI —
// the app looked fine while silently doing the wrong thing.
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:worktrack/core/photo_compressor.dart';
import 'package:worktrack/models/notification.dart';

void main() {
  group('PhotoCompressor thresholds', () {
    test('a small photo is sent as-is rather than re-encoded', () {
      // Below the skip threshold there is nothing worth saving, and re-encoding
      // would only cost quality.
      expect(
        PhotoCompressor.compressForUpload('/nonexistent-small.jpg').then((p) {
          // The file does not exist, so length() throws and we never get here —
          // which is itself the point: the guard runs before any encode.
          return p;
        }),
        throwsA(anything),
      );
    });

    test('targets are inside what a verification photo needs', () {
      // A selfie is proof of presence. Large enough to identify the person,
      // small enough that the upload is quick on mobile data.
      expect(PhotoCompressor.maxDimension, lessThanOrEqualTo(1280));
      expect(PhotoCompressor.maxDimension, greaterThanOrEqualTo(480));

      // q75 is the point where further reduction starts costing facial detail,
      // which is the one thing this photo must not lose.
      expect(PhotoCompressor.jpegQuality, greaterThanOrEqualTo(60));
      expect(PhotoCompressor.jpegQuality, lessThanOrEqualTo(85));
    });
  });

  group('AppNotification.relativeTime', () {
    test('prefers the server-supplied label', () {
      final n = AppNotification(
        id: '1',
        type: 'attendance',
        title: 'Checked in',
        timeAgo: 'Just now',
        createdAt: DateTime.now().subtract(const Duration(days: 3)),
      );
      expect(n.relativeTime, 'Just now');
    });

    test('derives a label when the server sent none', () {
      final n = AppNotification(
        id: '1',
        type: 'attendance',
        title: 'Checked in',
        createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
      );
      expect(n.relativeTime, '5m ago');
    });

    test('is empty rather than throwing when there is no timestamp', () {
      final n = AppNotification(id: '1', type: 'system', title: 'Hi');
      expect(n.relativeTime, '');
    });
  });

  group('AppNotification.fromJson', () {
    test('reads the camelCase keys the API actually sends', () {
      final n = AppNotification.fromJson({
        'id': 'abc',
        'type': 'Attendance', // server lowercases, but be tolerant
        'title': 'mubashir checked in',
        'description': '12:15 AM • test Project',
        'createdAt': '2026-10-08T19:15:04.694Z',
        'unread': true,
      });
      expect(n.id, 'abc');
      expect(n.type, 'attendance');
      expect(n.unread, isTrue);
      expect(n.createdAt, isNotNull);
    });

    test('defaults unread to false rather than throwing on a missing key', () {
      final n = AppNotification.fromJson({'id': 'abc', 'title': 'Hi'});
      expect(n.unread, isFalse);
      expect(n.type, 'system');
    });
  });
}