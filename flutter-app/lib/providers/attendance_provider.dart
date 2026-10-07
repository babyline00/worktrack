// Dashboard + attendance provider
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:io';
import '../core/api_client.dart';
import '../models/models.dart';

class AttendanceProvider extends ChangeNotifier {
  final _api = ApiClient();
  DashboardData? _dashboard;
  Attendance? _todayAttendance;
  List<AttendanceHistoryItem> _history = [];
  bool _isLoading = false;
  bool _isCheckingIn = false;
  bool _isCheckingOut = false;
  String? _error;

  DashboardData? get dashboard => _dashboard;
  Attendance? get todayAttendance => _todayAttendance;
  List<AttendanceHistoryItem> get history => _history;
  bool get isLoading => _isLoading;
  bool get isCheckingIn => _isCheckingIn;
  bool get isCheckingOut => _isCheckingOut;
  String? get error => _error;

  Future<void> loadDashboard() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.dio.get('/mobile/dashboard');
      if (response.data['success'] == true) {
        _dashboard = DashboardData.fromJson(response.data['data']);
        if (_dashboard?.today != null && _dashboard!.today!.attendanceId != null) {
          await loadTodayAttendance();
        } else {
          _todayAttendance = null;
        }
      }
    } catch (e) {
      _error = 'Failed to load dashboard';
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadTodayAttendance() async {
    try {
      final response = await _api.dio.get('/mobile/attendance/today');
      if (response.data['success'] == true) {
        _todayAttendance = Attendance.fromJson(response.data['data']);
        notifyListeners();
      }
    } catch (e) {
      // ignore
    }
  }

  Future<void> loadHistory({int page = 1, int limit = 20}) async {
    try {
      final response = await _api.dio.get(
        '/mobile/attendance/history',
        queryParameters: {'page': page, 'limit': limit},
      );
      if (response.data['success'] == true) {
        final data = response.data['data'];
        final items = (data['data'] as List)
            .map((a) => AttendanceHistoryItem.fromJson(a as Map<String, dynamic>))
            .toList();
        if (page == 1) {
          _history = items;
        } else {
          _history.addAll(items);
        }
        notifyListeners();
      }
    } catch (e) {
      // ignore
    }
  }

  Future<Map<String, dynamic>?> getCurrentLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return null;

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever ||
          permission == LocationPermission.denied) return null;

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );

      return {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
      };
    } catch (e) {
      return null;
    }
  }

  Future<bool> checkIn({
    required String projectId,
    required String photoPath,
    required double latitude,
    required double longitude,
    required double accuracy,
  }) async {
    _isCheckingIn = true;
    _error = null;
    notifyListeners();

    try {
      final formData = FormData.fromMap({
        'projectId': projectId,
        'latitude': latitude,
        'longitude': longitude,
        'accuracy': accuracy,
        'capturedAt': DateTime.now().toIso8601String(),
        'deviceId': 'flutter-app',
        'deviceModel': '',
        'appVersion': '1.0.0',
        'photo': await MultipartFile.fromFile(photoPath, filename: 'checkin.jpg'),
      });

      final response = await _api.dio.post(
        '/mobile/attendance/check-in',
        data: formData,
        options: Options(headers: {
          'Content-Type': 'multipart/form-data',
          'Idempotency-Key': DateTime.now().millisecondsSinceEpoch.toString(),
        }),
      );

      if (response.data['success'] == true) {
        await loadTodayAttendance();
        await loadDashboard();
        _isCheckingIn = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _error = e.response?.data?['error']?['message'] ?? 'Check-in failed';
    } catch (e) {
      _error = 'Network error during check-in';
    }

    _isCheckingIn = false;
    notifyListeners();
    return false;
  }

  Future<bool> checkOut({
    required String attendanceId,
    required String photoPath,
    required double latitude,
    required double longitude,
    required double accuracy,
  }) async {
    _isCheckingOut = true;
    _error = null;
    notifyListeners();

    try {
      final formData = FormData.fromMap({
        'attendanceId': attendanceId,
        'latitude': latitude,
        'longitude': longitude,
        'accuracy': accuracy,
        'capturedAt': DateTime.now().toIso8601String(),
        'deviceId': 'flutter-app',
        'photo': await MultipartFile.fromFile(photoPath, filename: 'checkout.jpg'),
      });

      final response = await _api.dio.post(
        '/mobile/attendance/check-out',
        data: formData,
        options: Options(headers: {
          'Content-Type': 'multipart/form-data',
          'Idempotency-Key': DateTime.now().millisecondsSinceEpoch.toString(),
        }),
      );

      if (response.data['success'] == true) {
        await loadTodayAttendance();
        await loadDashboard();
        _isCheckingOut = false;
        notifyListeners();
        return true;
      }
    } on DioException catch (e) {
      _error = e.response?.data?['error']?['message'] ?? 'Check-out failed';
    } catch (e) {
      _error = 'Network error during check-out';
    }

    _isCheckingOut = false;
    notifyListeners();
    return false;
  }

  Future<void> sendLocationUpdate(String attendanceId) async {
    final loc = await getCurrentLocation();
    if (loc == null) return;

    try {
      await _api.dio.post('/mobile/location', data: {
        'attendanceId': attendanceId,
        'latitude': loc['latitude'],
        'longitude': loc['longitude'],
        'accuracy': loc['accuracy'],
        'recordedAt': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      // ignore — location updates are best-effort
    }
  }
}
