// The dashboard cache is what makes the app open instantly instead of on a
// spinner — and what could silently show yesterday's "Not Checked In" as though
// it were live. These pin down the two properties that matter: a cache hit
// survives, and anything unreadable is a miss rather than a crash.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worktrack/core/local_cache.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    // LocalCache memoises its store, so the memo has to be dropped too or the
    // next case would read the previous case's values.
    LocalCache.instance.resetForTest();
  });

  test('round-trips a payload with its fetch time', () async {
    SharedPreferences.setMockInitialValues({});
    final cache = LocalCache.instance;

    final before = DateTime.now();
    await cache.write('dashboard', {'a': 1, 'b': 'two'});
    final hit = await cache.read<Map<String, dynamic>>(
      'dashboard',
      (d) => d as Map<String, dynamic>,
    );

    expect(hit, isNotNull);
    expect(hit!.data['b'], 'two');
    // The timestamp must be when it was fetched, not when read back.
    expect(hit.fetchedAt.isAfter(before.subtract(const Duration(seconds: 2))), isTrue);
    expect(hit.age.inSeconds.abs(), lessThan(5));
    expect(hit.isStale, isFalse);
  });

  test('a missing key is a miss, not an error', () async {
    SharedPreferences.setMockInitialValues({});
    final hit = await LocalCache.instance.read<Map<String, dynamic>>(
      'never-written',
      (d) => d as Map<String, dynamic>,
    );
    expect(hit, isNull);
  });

  test('a corrupt entry is discarded rather than thrown', () async {
    SharedPreferences.setMockInitialValues({
      'wt.cache.v1.dashboard': 'this is not json',
    });
    final hit = await LocalCache.instance.read<Map<String, dynamic>>(
      'dashboard',
      (d) => d as Map<String, dynamic>,
    );
    expect(hit, isNull, reason: 'an unreadable cache must never block startup');
  });

  test('an entry with no timestamp is rejected', () async {
    SharedPreferences.setMockInitialValues({
      'wt.cache.v1.dashboard': '{"data":{"a":1}}',
    });
    final hit = await LocalCache.instance.read<Map<String, dynamic>>(
      'dashboard',
      (d) => d as Map<String, dynamic>,
    );
    expect(hit, isNull,
        reason: 'without a fetch time the UI cannot say how stale it is');
  });

  test('a schema bump makes old entries invisible', () async {
    // Written under a different schema version.
    SharedPreferences.setMockInitialValues({
      'wt.cache.v99.dashboard': '{"fetchedAt":"2026-01-01T00:00:00.000Z","data":{"a":1}}',
    });
    final hit = await LocalCache.instance.read<Map<String, dynamic>>(
      'dashboard',
      (d) => d as Map<String, dynamic>,
    );
    expect(hit, isNull);
  });

  test('clearAll removes every entry', () async {
    SharedPreferences.setMockInitialValues({});
    final cache = LocalCache.instance;
    await cache.write('dashboard', {'a': 1});
    await cache.write('profile', {'b': 2});
    await cache.clearAll();

    expect(await cache.read('dashboard', (d) => d), isNull);
    expect(await cache.read('profile', (d) => d), isNull);
  });
}
