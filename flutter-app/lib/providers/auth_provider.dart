// Auth provider — manages login/logout state
import 'package:flutter/material.dart';
import '../core/api_client.dart';
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

  Future<bool> login(String companyCode, String employeeId, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.dio.post('/auth/login', data: {
        'companyCode': companyCode,
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
          avatarColor: data['employee']?['avatarColor'],
        );
        notifyListeners();
      }
    } catch (e) {
      // ignore
    }
  }

  Future<void> logout() async {
    try {
      await _api.dio.post('/auth/logout', data: {});
    } catch (_) {}
    await _api.clearTokens();
    _user = null;
    notifyListeners();
  }
}
