// Auth provider — manages login/logout state
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../core/api_client.dart';
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
  Future<void> init() async {
    await _api.init();
    if (_api.isAuthenticated) {
      await loadProfile();
    }
    notifyListeners();
  }

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
        _user = User(
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
    _user = null;
    notifyListeners();
  }
}
