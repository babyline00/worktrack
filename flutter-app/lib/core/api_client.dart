// Dio HTTP client with JWT interceptor + automatic token refresh
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'constants.dart';

/// Error thrown for any failed API call, carrying the server's message.
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? code;

  const ApiException(this.message, {this.statusCode, this.code});

  @override
  String toString() => message;
}

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  /// Shared instance used across providers and screens.
  static ApiClient get instance => _instance;

  late Dio _dio;
  final _storage = const FlutterSecureStorage();
  String? _accessToken;
  String? _refreshToken;
  Future<void>? _initFuture;

  /// Raw Dio instance. Only available after [init] has completed.
  Dio get dio => _dio;

  String? get accessToken => _accessToken;

  /// Headers for loading an authenticated image, e.g. an attendance selfie.
  ///
  /// Photos are served from `/api/v1/attendance/photo/:id`, which is scoped to
  /// the employee's company rather than public, so `Image.network` has to send
  /// the same bearer token the API calls use.
  Map<String, String> get authImageHeaders {
    final token = accessToken;
    return token == null ? const {} : {'Authorization': 'Bearer $token'};
  }

  /// Idempotent — repeated calls (e.g. from a widget rebuild) reuse the
  /// same initialisation instead of rebuilding the client and its interceptor.
  Future<void> init() => _initFuture ??= _doInit();

  Future<void> _doInit() async {
    _accessToken = await _storage.read(key: 'access_token');
    _refreshToken = await _storage.read(key: 'refresh_token');

    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: ApiConstants.connectTimeout,
      receiveTimeout: ApiConstants.receiveTimeout,
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
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
              final response = await _dio.fetch(opts);
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

  /// Performs a GET and returns the unwrapped `data` payload.
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    await init();
    try {
      final res = await _dio.get<dynamic>(path, queryParameters: query);
      return _unwrap(res.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  /// Performs a POST and returns the unwrapped `data` payload.
  Future<Map<String, dynamic>> post(String path, {Object? data}) async {
    await init();
    try {
      final res = await _dio.post<dynamic>(path, data: data);
      return _unwrap(res.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> put(String path, {Object? data}) async {
    await init();
    try {
      final res = await _dio.put<dynamic>(path, data: data);
      return _unwrap(res.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> patch(String path, {Object? data}) async {
    await init();
    try {
      final res = await _dio.patch<dynamic>(path, data: data);
      return _unwrap(res.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> delete(String path) async {
    await init();
    try {
      final res = await _dio.delete<dynamic>(path);
      return _unwrap(res.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  /// Unwraps the API envelope `{ success, data }` / `{ success, error }`.
  /// Non-object `data` payloads are returned under the `data` key so callers
  /// can always index into a `Map<String, dynamic>`.
  Map<String, dynamic> _unwrap(dynamic body) {
    if (body is! Map) {
      throw ApiException('Unexpected response from server');
    }
    final map = Map<String, dynamic>.from(body);
    if (map['success'] == true) {
      final data = map['data'];
      if (data is Map) return Map<String, dynamic>.from(data);
      return {'data': data};
    }
    final error = map['error'];
    if (error is Map) {
      throw ApiException(
        (error['message'] as String?) ?? 'Request failed',
        code: error['code'] as String?,
      );
    }
    throw ApiException('Request failed');
  }

  ApiException _toApiException(DioException e) {
    final data = e.response?.data;
    if (data is Map) {
      final error = data['error'];
      if (error is Map && error['message'] is String) {
        return ApiException(
          error['message'] as String,
          statusCode: e.response?.statusCode,
          code: error['code'] as String?,
        );
      }
    }
    return ApiException(
      e.response?.statusMessage ?? 'Network error. Please try again.',
      statusCode: e.response?.statusCode,
    );
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
