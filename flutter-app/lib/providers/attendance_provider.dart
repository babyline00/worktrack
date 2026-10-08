// Dashboard + attendance provider
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';
import '../core/api_client.dart';
import '../core/geofence.dart';
import '../models/models.dart';
// `models.dart` declares its own `TodayAttendance`/`AttendanceHistoryItem`,
// so only the detail type is pulled in from the granular model library.
import '../models/attendance.dart' show AttendanceDetail;

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
      final data = await ApiClient.instance.get('/mobile/dashboard');
      _dashboard = DashboardData.fromJson(data);
      if (_dashboard?.today != null && _dashboard!.today!.attendanceId != null) {
        await loadTodayAttendance();
      } else {
        _todayAttendance = null;
      }
    } catch (e) {
      // Surfaced rather than swallowed: a generic message made this look
      // identical to an empty dashboard.
      _error = 'Failed to load dashboard: $e';
      debugPrint('loadDashboard failed: $e');
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadTodayAttendance() async {
    try {
      final data = await ApiClient.instance.get('/mobile/attendance/today');
      _todayAttendance = data['attendance'] == null
          ? null
          : Attendance.fromJson(data);
      notifyListeners();
    } catch (e) {
      // ignore
    }
  }

  Future<void> loadHistory({int page = 1, int limit = 20}) async {
    try {
      final data = await ApiClient.instance.get(
        '/mobile/attendance/history',
        query: {'page': page, 'limit': limit},
      );
      final items = ((data['data'] as List?) ?? [])
          .map((a) => AttendanceHistoryItem.fromJson(a as Map<String, dynamic>))
          .toList();
      if (page == 1) {
        _history = items;
      } else {
        _history.addAll(items);
      }
      notifyListeners();
    } catch (e) {
      // Swallowing this made a failed fetch indistinguishable from "no
      // records yet", so the tab showed an empty state that looked valid.
      _historyError = 'Could not load attendance history';
      notifyListeners();
    }
  }

  String? _historyError = '';
  String? get historyError => _historyError == '' ? null : _historyError;

  /// Live position for the in-session tracker, refreshed on demand.
  Position? _latestPosition;
  String? _locationError;
  bool _isLocating = false;

  /// True when [locationError] can only be cleared from the system settings
  /// screen (permission permanently denied), so the UI can offer a button.
  bool _needsSettings = false;

  /// Most recent device fix, or `null` before the first successful read.
  Position? get currentPosition => _latestPosition;
  /// Why the last location attempt failed, if it did.
  String? get locationError => _locationError;
  bool get isLocating => _isLocating;
  /// Whether the user must enable location from the OS settings screen.
  bool get needsLocationSettings => _needsSettings;

  /// A fix older than this is treated as unusable rather than reported as the
  /// employee's current position. Indoors, Android keeps serving a cached fix
  /// from hours ago; stamping attendance with it would be worse than failing.
  static const Duration _maxFixAge = Duration(minutes: 2);

  /// Opens the OS app-settings page so a permanently denied permission can be
  /// granted without reinstalling.
  Future<void> openLocationSettings() => Geolocator.openAppSettings();

  /// Requests a single high-accuracy fix and caches it for the UI.
  ///
  /// Unlike [getCurrentLocation] this surfaces *why* it failed instead of
  /// collapsing every case to `null`, so the UI can tell the user whether to
  /// enable location services or grant permission.
  Future<Map<String, dynamic>?> refreshLocation() async {
    if (_isLocating) {
      final cached = _latestPosition;
      return cached == null ? null : _toMap(cached);
    }
    _isLocating = true;
    _locationError = null;
    _needsSettings = false;
    notifyListeners();

    final position = await _readPosition();

    if (position == null) {
      _locationError = _lastLocationFailure;
      _isLocating = false;
      notifyListeners();
      return null;
    }

    _latestPosition = position;
    _isLocating = false;
    notifyListeners();
    return _toMap(position);
  }

  Map<String, dynamic> _toMap(Position p) => {
        'latitude': p.latitude,
        'longitude': p.longitude,
        'accuracy': p.accuracy,
        'timestamp': p.timestamp,
      };

  String _lastLocationFailure = 'Unable to get GPS location';

  Future<Position?> _readPosition() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        _lastLocationFailure = 'Location services are turned off';
        return null;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        _lastLocationFailure =
            'Location permission is permanently denied. Enable it in Settings.';
        _needsSettings = true;
        return null;
      }
      if (permission == LocationPermission.denied) {
        _lastLocationFailure = 'Location permission is required';
        return null;
      }

      // A live fix is strongly preferred — it is what attendance should be
      // stamped with — but it routinely fails indoors or with a cold GPS chip.
      // Fall back to the platform's last-known fix so the user still sees where
      // they are, while keeping its real age and accuracy so callers can judge
      // whether it is trustworthy.
      try {
        final fresh = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 20),
        ).timeout(const Duration(seconds: 25));
        _lastLocationFailure = 'Unable to get GPS location';
        return fresh;
      } on TimeoutException {
        return await _lastKnownPositionOrNull();
      } catch (_) {
        return await _lastKnownPositionOrNull();
      }
    } on TimeoutException {
      _lastLocationFailure = 'GPS timed out. Try again outdoors.';
      return null;
    } catch (_) {
      _lastLocationFailure = 'Unable to get GPS location';
      return null;
    }
  }

  /// The platform's cached fix, or `null` when it is missing or too old.
  ///
  /// Android will happily return a fix from hours ago; reporting that as the
  /// employee's live position would silently misplace them, so anything beyond
  /// [_maxFixAge] is rejected with an explanation instead.
  Future<Position?> _lastKnownPositionOrNull() async {
    try {
      final last = await Geolocator.getLastKnownPosition();
      if (last == null) {
        _lastLocationFailure =
            'No GPS fix yet. Move outdoors and try again in a moment.';
        return null;
      }
      final age = DateTime.now().difference(last.timestamp);
      if (age > _maxFixAge) {
        _lastLocationFailure =
            'GPS has no recent fix (last update ${_describeAge(age)} ago). '
            'Move outdoors and try again.';
        return null;
      }
      _lastLocationFailure = 'Unable to get GPS location';
      return last;
    } catch (_) {
      _lastLocationFailure =
          'No GPS fix yet. Move outdoors and try again in a moment.';
      return null;
    }
  }

  static String _describeAge(Duration age) {
    if (age.inMinutes < 60) return '${age.inMinutes}m';
    if (age.inHours < 24) return '${age.inHours}h';
    return '${age.inDays}d';
  }

  Future<Map<String, dynamic>?> getCurrentLocation() async {
    final position = await _readPosition();
    if (position == null) return null;
    _latestPosition = position;
    return {
      'latitude': position.latitude,
      'longitude': position.longitude,
      'accuracy': position.accuracy,
    };
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

    // The server requires a photo and rejects an empty path with a generic
    // validation error, while `MultipartFile.fromFile('')` throws a
    // FileSystemException that would surface as a bogus network error.
    if (photoPath.isEmpty || !await File(photoPath).exists()) {
      _error = 'A selfie is required to check in. Please retake it.';
      _isCheckingIn = false;
      notifyListeners();
      return false;
    }

    try {
      await _api.init();
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

  String? _geofenceWarning;
  String? get geofenceWarning => _geofenceWarning;

  Future<bool> checkOut({
    required String attendanceId,
    required String photoPath,
    required double latitude,
    required double longitude,
    required double accuracy,
  }) async {
    _isCheckingOut = true;
    _error = null;
    _geofenceWarning = null;
    notifyListeners();

    // The server rejects an empty photo with a generic validation error, and
    // `MultipartFile.fromFile('')` throws a confusing FileSystemException.
    // Fail fast with a message the UI can show verbatim.
    if (photoPath.isEmpty || !await File(photoPath).exists()) {
      _error = 'A selfie is required to check out. Please retake it.';
      _isCheckingOut = false;
      notifyListeners();
      return false;
    }

    try {
      await _api.init();
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
        // Check for geofence warning
        _geofenceWarning = response.data['data']?['geofenceWarning'];
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

  /// Fetches the full attendance record for the detail screen.
  ///
  /// `/attendance/{id}` nests check-in/check-out payloads (`checkIn: {photo,
  /// location, …}`), so it is flattened here into the shape
  /// [AttendanceDetail.fromJson] expects.
  Future<AttendanceDetail?> fetchDetail(String id) async {
    try {
      final data = await ApiClient.instance.get('/attendance/$id');
      final checkIn = data['checkIn'] as Map<String, dynamic>?;
      final checkOut = data['checkOut'] as Map<String, dynamic>?;
      final inLoc = checkIn?['location'] as Map<String, dynamic>?;

      return AttendanceDetail.fromJson({
        ...data,
        'checkInAt': checkIn?['iso'] as String?,
        'checkInTime': checkIn?['time'] as String?,
        'checkOutAt': checkOut?['iso'] as String?,
        'checkOutTime': checkOut?['time'] as String?,
        'checkInPhoto': checkIn?['photo'] as String?,
        'checkOutPhoto': checkOut?['photo'] as String?,
        'insideGeofence': inLoc?['insideGeofence'] as bool? ?? true,
        'distanceFromProject':
            (inLoc?['distanceFromProject'] as num?)?.toDouble(),
        'lastLocation': inLoc == null
            ? null
            : {
                'latitude': inLoc['latitude'],
                'longitude': inLoc['longitude'],
                'accuracy': inLoc['accuracy'],
                'name': inLoc['name'],
              },
      });
    } catch (_) {
      return null;
    }
  }

  /// Pushes the cached fix (taking a fresh one if none yet) to the server.
  ///
  /// The server recomputes the geofence for every ping and returns the result.
  /// That response is the authoritative answer — it applies the tenant's own
  /// radius and settings — so it is stored rather than discarded, which is what
  /// previously left the UI frozen on the value from check-in.
  Future<bool> sendLocationUpdate(String attendanceId) async {
    final position = _latestPosition ?? await _readPosition();
    if (position == null) return false;

    _latestPosition = position;
    try {
      final response = await ApiClient.instance.post('/mobile/location', data: {
        'attendanceId': attendanceId,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'recordedAt': DateTime.now().toIso8601String(),
      });

      final data = response['data'];
      if (data is Map<String, dynamic>) {
        _serverInsideGeofence = data['insideGeofence'] as bool?;
        _serverDistanceMeters =
            (data['distanceFromProject'] as num?)?.toDouble();

        // The server closes the session itself once the employee has been
        // outside the radius for the full grace period. Reflect that here so
        // the UI stops counting and the employee is told why.
        if (data['autoCheckedOut'] == true) {
          _autoCheckedOutByServer = true;
          _geofenceWatch.reset();
          _insideGeofence = false;
          _autoCheckOutDue = false;
          await loadTodayAttendance();
          await loadDashboard();
        }
      }
      _evaluateGeofence();
      notifyListeners();
      return true;
    } catch (_) {
      // ignore — location updates are best-effort
      return false;
    }
  }

  // ---------------------------------------------------------------- geofence

  /// Authoritative geofence answer from the last server ping, when available.
  bool? _serverInsideGeofence;
  double? _serverDistanceMeters;
  final GeofenceWatch _geofenceWatch = GeofenceWatch();

  double? _projectLatitude;
  double? _projectLongitude;
  double? _projectRadiusMeters;

  /// Distance from the project site in metres, from the server when it has
  /// answered and computed locally otherwise. `null` until a fix exists.
  double? get distanceFromProject =>
      _serverDistanceMeters ?? _localDistance;

  /// Whether the employee is currently inside the site. `null` before the
  /// first location fix, so callers can distinguish "unknown" from "outside".
  bool? get isInsideGeofence => _insideGeofence;

  bool? _insideGeofence;

  /// How long the employee has been continuously outside the radius.
  Duration get outsideDuration => _geofenceWatch.outsideDuration;

  /// Whether an employee should be auto checked out right now.
  bool get shouldAutoCheckOut => _autoCheckOutDue;

  bool _autoCheckOutDue = false;

  /// Set when the server closed the session because the employee stayed
  /// outside the project radius. Surfaced once, then cleared.
  bool _autoCheckedOutByServer = false;

  /// Whether the server auto checked out the current session.
  bool get wasAutoCheckedOut => _autoCheckedOutByServer;

  /// Clears the auto check-out notice after the UI has shown it.
  void acknowledgeAutoCheckOut() {
    _autoCheckedOutByServer = false;
    notifyListeners();
  }

  /// Sets the site to measure live positions against, taken from the attendance
  /// record the session was started on.
  void configureGeofence({
    double? latitude,
    double? longitude,
    double? radiusMeters,
  }) {
    _projectLatitude = latitude;
    _projectLongitude = longitude;
    _projectRadiusMeters = radiusMeters;
    _evaluateGeofence();
    notifyListeners();
  }

  /// Clears live tracking state once the session is over.
  void clearGeofence() {
    _geofenceWatch.reset();
    _autoCheckOutDue = false;
    _serverInsideGeofence = null;
    _serverDistanceMeters = null;
    _localDistance = null;
    _insideGeofence = null;
    _projectLatitude = null;
    _projectLongitude = null;
    _projectRadiusMeters = null;
  }

  /// Distance to the site from the cached fix.
  double? _localDistance;

  /// Recomputes geofence state from the newest fix.
  ///
  /// The server's verdict wins when it has one; otherwise the local fix is
  /// measured against the project so the badge still updates between pings.
  void _evaluateGeofence() {
    final pos = _latestPosition;
    if (pos == null) return;

    final local = Geofence.distanceMeters(
      latitude: pos.latitude,
      longitude: pos.longitude,
      projectLatitude: _projectLatitude,
      projectLongitude: _projectLongitude,
    );
    _localDistance = local;

    final inside = _serverInsideGeofence ??
        Geofence.isInside(
          distanceMeters: local,
          radiusMeters: _projectRadiusMeters,
          accuracyMeters: pos.accuracy,
        );
    _insideGeofence = inside;

    _autoCheckOutDue = _geofenceWatch.record(outside: !inside);
  }

  /// Resets the breach timer, e.g. when the user re-enters the site.
  void acknowledgeGeofence() {
    _autoCheckOutDue = false;
    notifyListeners();
  }
}
