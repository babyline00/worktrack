// On-device cache for read-mostly API payloads.
//
// Why this exists: the dashboard is the app's first screen and the single most
// expensive request it makes (a remote database, four parallel queries, plus
// serverless cold start — measured at 1.4-2.1s). Waiting for that on every cold
// start means a spinner over a screen whose contents did not change.
//
// So the payload is written to disk when it arrives and read back on the next
// launch. The user sees the last known state immediately and the network
// refreshes it behind them. What they must never see is stale data presented as
// live, so every cached entry carries the timestamp it was fetched at and the
// UI is told how old it is.
//
// Only GET payloads are cached. Nothing here may ever hold a token or a
// credential — see [LocalCache.clearSensitive] for the note on that.
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CachedPayload<T> {
  final T data;

  /// When this was fetched from the server, not when it was written to disk.
  final DateTime fetchedAt;

  const CachedPayload(this.data, this.fetchedAt);

  Duration get age => DateTime.now().difference(fetchedAt);

  /// Older than this and the UI should say so rather than implying "now".
  bool get isStale => age > const Duration(minutes: 10);

  bool get isVeryStale => age > const Duration(days: 1);
}

class LocalCache {
  LocalCache._();
  static final LocalCache instance = LocalCache._();

  static const _prefix = 'wt.cache.';
  static const _version = 1;

  /// Bumping this invalidates every entry written by an older shape, which is
  /// how a response that changed shape avoids being parsed into the wrong model.
  static const String _schemaVersion = 'v$_version';

  SharedPreferences? _prefs;

  Future<SharedPreferences> get _store async =>
      _prefs ??= await SharedPreferences.getInstance();

  /// Drops the memoised store.
  ///
  /// Only for tests: the store is deliberately memoised so the hot path never
  /// awaits `getInstance()`, which makes it impossible to swap in a fresh set of
  /// mock values between cases.
  @visibleForTesting
  void resetForTest() => _prefs = null;

  /// Reads a cached payload, or null when absent or unparseable.
  ///
  /// Every failure path returns null rather than throwing: a corrupt cache must
  /// never be the reason the app fails to start.
  Future<CachedPayload<T>?> read<T>(String key, T Function(dynamic) parse) async {
    try {
      final store = await _store;
      final raw = store.getString('$_prefix$_schemaVersion.$key');
      if (raw == null) return null;
      final decoded = json.decode(raw) as Map<String, dynamic>;
      final fetchedAt = DateTime.tryParse(decoded['fetchedAt'] as String? ?? '');
      if (fetchedAt == null) return null;
      return CachedPayload<T>(parse(decoded['data']), fetchedAt);
    } catch (_) {
      // A cache miss is the correct outcome for anything unreadable.
      await _drop(key);
      return null;
    }
  }

  Future<void> write(String key, Object data) async {
    try {
      final store = await _store;
      await store.setString(
        '$_prefix$_schemaVersion.$key',
        jsonEncode({'fetchedAt': DateTime.now().toIso8601String(), 'data': data}),
      );
    } catch (e) {
      // Never let a cache write failure surface as a request failure.
      debugPrint('LocalCache.write($key) failed: $e');
    }
  }

  Future<void> _drop(String key) async {
    try {
      final store = await _store;
      await store.remove('$_prefix$_schemaVersion.$key');
    } catch (_) {
      // best effort
    }
  }

  Future<void> drop(String key) => _drop(key);

  /// Removes every cached payload. Called on sign-out.
  ///
  /// Tokens live in the Android Keystore via FlutterSecureStorage and are never
  /// written here, so this cannot leave a credential behind — but it does leave
  /// an employee's name, project and coordinates on a shared device, which is
  /// exactly what must not survive someone else signing in.
  Future<void> clearAll() async {
    try {
      final store = await _store;
      final keys = store.getKeys().where((k) => k.startsWith(_prefix)).toList();
      for (final k in keys) {
        await store.remove(k);
      }
    } catch (_) {
      // best effort
    }
  }
}