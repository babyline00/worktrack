// Auth provider — manages login/logout state
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/local_cache.dart';
import '../core/constants.dart';
import '../models/models.dart';

class AuthProvider extends ChangeNotifier {
  final _api = ApiClient();
  User? _user;
  bool _isLoading = false;
  String? _error;

  User? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _api.isAuthenticated && _user != null;

  /// Restores a persisted session (tokens + profile) on cold start.
  /// Restores the session on launch.
  ///
  /// The refresh token is already persisted in the Android Keystore and lives
  /// 30 days, so this does not need — and must never have — the password.
  ///
  /// The profile is painted from cache first so the app lands on the dashboard
  /// immediately rather than on a spinner, then the network confirms it in the
  /// background. A rejected token falls back to the login screen.
  Future<void> init() async {
    await _api.init();

    if (_api.isAuthenticated) {
      final cached =
          await LocalCache.instance.read<User>('profile', (d) => User.fromJson(d as Map<String, dynamic>));
      if (cached != null) {
        _user = cached.data;
        _profileFromCache = cached.fetchedAt;
        notifyListeners();
      }

      // Confirms the token is still good and picks up anything that changed.
      await loadProfile();
    }
    notifyListeners();
  }

  /// When the profile on screen came from cache, or null if it is live.
  DateTime? _profileFromCache;

  bool get isShowingCachedProfile => _profileFromCache != null;

  /// Builds a [User] from an `/auth/me` payload.
  static User userFromProfilePayload(Map<String, dynamic> data) => User(
        id: data['id'],
        email: data['email'],
        name: data['name'],
        role: data['role'],
        companyId: data['companyId'],
        employeeId: data['employee']?['employeeId'],
        // Read from the nested company as well as the flattened field, so a
        // server that only sends one of the two still populates the profile.
        companyName: data['companyName'] ?? data['employee']?['company']?['name'],
        companyCode: data['companyCode'] ?? data['employee']?['company']?['code'],
        avatarColor: data['avatarColor'] ?? data['employee']?['avatarColor'],
        avatarUrl: data['avatarUrl'] ?? data['employee']?['avatarUrl'],
      );

  /// Signs in with employee ID + password. The tenant [companyCode] is supplied
  /// by the build (see `ApiConstants.companyCode`) rather than the user.
  Future<bool> login(String employeeId, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _api.init();
      final response = await _api.dio.post('/auth/login', data: {
        'companyCode': ApiConstants.companyCode,
        'employeeId': employeeId,
        'password': password,
      });

      if (response.data['success'] == true) {
        final data = response.data['data'];
        await _api.setTokens(data['accessToken'], data['refreshToken']);
        _user = User.fromJson(data['user']);
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _error = e.response?.data?['error']?['message'] ?? 'Login failed. Check your credentials.';
    } catch (e) {
      _error = 'Network error. Please check your connection.';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<void> loadProfile() async {
    try {
      await _api.init();
      final response = await _api.dio.get('/auth/me');
      if (response.data['success'] == true) {
        final data = response.data['data'];
        _user = userFromProfilePayload(data);
        _profileFromCache = null;
        await LocalCache.instance.write('profile', data);
        notifyListeners();
      }
    } catch (e) {
      // Swallowed, but that is a real gap: a failed /auth/me on cold start
      // drops the user to the login screen with no message. Surfaced now.
      _error = 'Could not load your profile. Please sign in again.';
      debugPrint('loadProfile failed: $e');
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      await _api.init();
      await _api.dio.post('/auth/logout', data: {});
    } catch (_) {}
    await _api.clearTokens();

    // The cache holds the previous employee's name, project and coordinates.
    // Leaving that on a device that is about to be signed into by someone else
    // is a data leak, so it goes with the tokens.
    await LocalCache.instance.clearAll();

    _user = null;
    _profileFromCache = null;
    notifyListeners();
  }
}
