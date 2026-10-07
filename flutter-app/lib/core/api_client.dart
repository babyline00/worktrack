// Dio HTTP client with JWT interceptor + automatic token refresh
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'constants.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  late Dio dio;
  final _storage = const FlutterSecureStorage();
  String? _accessToken;
  String? _refreshToken;

  String? get accessToken => _accessToken;

  Future<void> init() async {
    _accessToken = await _storage.read(key: 'access_token');
    _refreshToken = await _storage.read(key: 'refresh_token');

    dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: ApiConstants.connectTimeout,
      receiveTimeout: ApiConstants.receiveTimeout,
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (_accessToken != null) {
          options.headers['Authorization'] = 'Bearer $_accessToken';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401 && _refreshToken != null) {
          // Try to refresh token
          final refreshed = await _tryRefresh();
          if (refreshed) {
            // Retry the original request
            final opts = error.requestOptions;
            opts.headers['Authorization'] = 'Bearer $_accessToken';
            try {
              final response = await dio.fetch(opts);
              handler.resolve(response);
              return;
            } catch (e) {
              handler.next(error);
              return;
            }
          }
        }
        handler.next(error);
      },
    ));
  }

  Future<bool> _tryRefresh() async {
    try {
      final response = await Dio().post(
        '${ApiConstants.baseUrl}/auth/refresh',
        data: {'refreshToken': _refreshToken},
        options: Options(headers: {'Content-Type': 'application/json'}),
      );
      if (response.statusCode == 200 && response.data['success'] == true) {
        _accessToken = response.data['data']['accessToken'];
        await _storage.write(key: 'access_token', value: _accessToken);
        return true;
      }
    } catch (e) {
      // Refresh failed — logout
      await clearTokens();
    }
    return false;
  }

  Future<void> setTokens(String access, String refresh) async {
    _accessToken = access;
    _refreshToken = refresh;
    await _storage.write(key: 'access_token', value: access);
    await _storage.write(key: 'refresh_token', value: refresh);
  }

  Future<void> clearTokens() async {
    _accessToken = null;
    _refreshToken = null;
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }

  bool get isAuthenticated => _accessToken != null;
}
