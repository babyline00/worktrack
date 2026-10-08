// Unit tests for pure app helpers that don't need network or timers.
//
// Note: `AppTheme` is intentionally not covered here — it resolves Google Fonts
// over the network, which `flutter test` cannot reach.
import 'package:flutter_test/flutter_test.dart';
import 'package:worktrack/core/constants.dart';

void main() {
  test('resolvePhotoUrl expands root-relative photo paths', () {
    expect(resolvePhotoUrl(null), '');
    expect(resolvePhotoUrl(''), '');
    expect(resolvePhotoUrl('https://cdn.example.com/a.jpg'),
        'https://cdn.example.com/a.jpg');
    expect(resolvePhotoUrl('/uploads/a.jpg'), '$apiOrigin/uploads/a.jpg');
  });

  test('apiOrigin strips the versioned API path', () {
    expect(apiOrigin, startsWith('http'));
    expect(apiOrigin, isNot(contains('/api/v1')));
  });
}