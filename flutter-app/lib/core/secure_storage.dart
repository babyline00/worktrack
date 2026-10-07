// Secure storage for JWT tokens + cached user profile.
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/user.dart';

class SecureStorage {
  SecureStorage._();
  static final SecureStorage instance = SecureStorage._();

  static const _kAccessToken = 'wt_access_token';
  static const _kRefreshToken = 'wt_refresh_token';
  static const _kUser = 'wt_user';
  static const _kDeviceId = 'wt_device_id';

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  // ---------- access token ----------
  Future<String?> getAccessToken() => _storage.read(key: _kAccessToken);
  Future<void> setAccessToken(String? token) async {
    if (token == null) {
      await _storage.delete(key: _kAccessToken);
    } else {
      await _storage.write(key: _kAccessToken, value: token);
    }
  }

  // ---------- refresh token ----------
  Future<String?> getRefreshToken() => _storage.read(key: _kRefreshToken);
  Future<void> setRefreshToken(String? token) async {
    if (token == null) {
      await _storage.delete(key: _kRefreshToken);
    } else {
      await _storage.write(key: _kRefreshToken, value: token);
    }
  }

  // ---------- cached user ----------
  Future<User?> getUser() async {
    final raw = await _storage.read(key: _kUser);
    if (raw == null || raw.isEmpty) return null;
    try {
      return User.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> setUser(User? user) async {
    if (user == null) {
      await _storage.delete(key: _kUser);
    } else {
      await _storage.write(
          key: _kUser, value: jsonEncode(user.toJson()));
    }
  }

  // ---------- device id (generated once) ----------
  Future<String> getDeviceId() async {
    var id = await _storage.read(key: _kDeviceId);
    if (id == null || id.isEmpty) {
      // Cheap unique id — fine for the demo backend which doesn't validate format.
      id = 'wt-${DateTime.now().millisecondsSinceEpoch}-${_randomString(6)}';
      await _storage.write(key: _kDeviceId, value: id);
    }
    return id;
  }

  // ---------- clear all ----------
  Future<void> clearAll() async {
    await _storage.delete(key: _kAccessToken);
    await _storage.delete(key: _kRefreshToken);
    await _storage.delete(key: _kUser);
  }

  String _randomString(int length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    final buffer = StringBuffer();
    for (var i = 0; i < length; i++) {
      buffer.write(chars[DateTime.now().microsecondsSinceEpoch % chars.length]);
    }
    return buffer.toString();
  }
}
