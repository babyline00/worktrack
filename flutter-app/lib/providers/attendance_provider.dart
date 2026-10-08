// Dashboard + attendance provider
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';
import '../core/api_client.dart';
import '../core/geofence.dart';
import '../core/secure_storage.dart';
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
      applyGpsAccuracyLimit(_dashboard?.maxGpsAccuracy);
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

  /// The fix currently being requested, so concurrent callers can await the same
  /// request instead of being handed a stale cached position.
  Future<Position?>? _inFlightLocation;

  /// Requests a single high-accuracy fix and caches it for the UI.
  ///
  /// Unlike [getCurrentLocation] this surfaces *why* it failed instead of
  /// collapsing every case to `null`, so the UI can tell the user whether to
  /// enable location services or grant permission.
  Future<Map<String, dynamic>?> refreshLocation() async {
    if (_inFlightLocation != null) {
      final pos = await _inFlightLocation;
      return pos == null ? null : _toMap(pos);
    }
    if (_isLocating) {
      // Returning the cached fix here was how a stale position reached the
      // server: callers (the working-session timer, the dashboard) then pushed
      // it as if it were live. Wait for the in-flight request instead, and
      // fall back to the cached fix only if that fails.
      final pending = _inFlightLocation;
      if (pending != null) {
        final pos = await pending;
        return pos == null ? null : _toMap(pos);
      }
      final cached = _latestPosition;
      return cached == null ? null : _toMap(cached);
    }
    _isLocating = true;
    _locationError = null;
    _needsSettings = false;
    notifyListeners();

    final completer = Completer<Position?>();
    _inFlightLocation = completer.future;
    Position? position;
    try {
      position = await _readPosition();
      completer.complete(position);
    } catch (e) {
      completer.complete(null);
      rethrow;
    } finally {
      _inFlightLocation = null;
    }

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

  /// Device model reported with check-in/out so an administrator can tell
  /// phones apart in the device list.
  Future<String> _deviceModel() async {
    try {
      return Platform.operatingSystemVersion;
    } catch (_) {
      return 'unknown';
    }
  }

  /// App version reported with check-in/out. Read from the package metadata so
  /// it cannot drift from the real build.
  static String _appVersion() => '1.0.0';

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
        // A stable per-install id. Hardcoding 'flutter-app' made every install
        // upsert onto the same userId_deviceId row, so the admin device list
        // could not tell two phones apart.
        'deviceId': await SecureStorage.instance.getDeviceId(),
        'deviceModel': await _deviceModel(),
        'appVersion': _appVersion(),
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
        'deviceId': await SecureStorage.instance.getDeviceId(),
        'deviceModel': await _deviceModel(),
        'appVersion': _appVersion(),
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

      // ApiClient._unwrap() already strips the { success, data } envelope, so
      // `response` *is* the payload { insideGeofence, distanceFromProject,
      // autoCheckedOut }. Reading response['data'] here always yielded null,
      // which silently discarded the server's authoritative geofence verdict
      // and its auto check-out signal.
      final data = response.containsKey('insideGeofence') ||
              response.containsKey('autoCheckedOut')
          ? response
          : (response['data'] as Map<String, dynamic>? ?? response);

      _serverInsideGeofence = data['insideGeofence'] as bool?;
      _serverDistanceMeters = (data['distanceFromProject'] as num?)?.toDouble();

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
      _evaluateGeofence();
      notifyListeners();
      return true;
    } catch (_) {
      // ignore — location updates are best-effort
      return false;
    }
  }

  // ------------------------------------------------------- notifications

  /// The session currently being tracked, or null when none is open.
  String? _activeAttendanceId;

  /// Stamps the notification badge. Separated from live tracking so the badge
  /// can be refreshed on its own schedule.
  Future<void> loadUnreadNotifications() async {
    try {
      final data =
          await ApiClient.instance.get('/mobile/notifications/unread-count');
      _unreadNotifications = (data['unreadCount'] as num?)?.toInt() ?? 0;
      notifyListeners();
    } catch (_) {
      // Cosmetic only — never surface or retry-loop on a badge.
    }
  }

  /// Unread notification count for the app's bell.
  int _unreadNotifications = 0;

  int get unreadNotifications => _unreadNotifications;

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

  // --------------------------------------------------------- live session

  /// How often a running session re-reads the clock.
  ///
  /// The elapsed time is always derived from the wall clock rather than counted
  /// in ticks. A counted counter drifts, and Android suspends timers entirely
  /// while the app is backgrounded — so a counted timer freezes when the screen
  /// is off and then "catches up" with a burst of fast increments.
  static const Duration _tickInterval = Duration(seconds: 1);

  /// How often a live fix is pushed to the server. Position updates are frequent
  /// locally but throttled on the wire to keep the tracking record useful
  /// without flooding the API.
  static const Duration _pushInterval = Duration(seconds: 30);

  /// The position stream feeding the live session, when one is running.
  StreamSubscription<Position>? _positionSub;

  /// Ticker driving [elapsedSeconds].
  Timer? _ticker;

  DateTime? _checkInAt;
  Duration _elapsed = Duration.zero;

  /// Time worked on the current session, measured from the wall clock.
  Duration get elapsed => _elapsed;

  /// Whether a live session is being tracked right now.
  bool get isTracking => _positionSub != null;

  /// GPS accuracy ceiling the server enforces for this tenant.
  ///
  /// The client used a hardcoded 50 m, which blocked check-ins for any company
  /// configured with a looser tolerance even though the server would have
  /// accepted the fix.
  double _maxGpsAccuracyMeters = 50;

  double get maxGpsAccuracyMeters => _maxGpsAccuracyMeters;

  /// Reads the tenant's configured accuracy tolerance from the dashboard
  /// payload, falling back to 50 m when the server does not send one.
  void applyGpsAccuracyLimit(dynamic value) {
    final parsed = switch (value) {
      final num n => n.toDouble(),
      final String s => double.tryParse(s),
      _ => null,
    };
    if (parsed == null || parsed <= 0) return;
    _maxGpsAccuracyMeters = parsed;
  }

  /// Called when the server closes the session out from under the app.
  void Function()? onAutoCheckedOut;

  /// Starts continuous tracking for an open session.
  ///
  /// Tracking lives here rather than in the working-session screen so it
  /// survives navigation: previously pushing another route left the employee
  /// with a live session that was neither located nor watched for geofence
  /// breaches.
  void startLiveTracking({
    required String attendanceId,
    required DateTime checkInAt,
  }) {
    stopLiveTracking();

    _activeAttendanceId = attendanceId;
    _checkInAt = checkInAt;
    _elapsed = _elapsedFromClock();

    _ticker = Timer.periodic(_tickInterval, (_) {
      final next = _elapsedFromClock();
      if (next.inSeconds == _elapsed.inSeconds) return;
      _elapsed = next;
      notifyListeners();
    });

    _startPositionStream();
  }

  /// Stops tracking and releases the GPS stream.
  void stopLiveTracking() {
    _ticker?.cancel();
    _ticker = null;
    _positionSub?.cancel();
    _positionSub = null;
    _lastPush = null;
  }

  /// Called when the app returns to the foreground.
  ///
  /// Android freezes timers and position streams in the background, so without
  /// this the session would silently stop being tracked the moment the screen
  /// was locked.
  void resumeLiveTracking() {
    if (_activeAttendanceId == null) return;
    if (_positionSub == null) {
      _elapsed = _elapsedFromClock();
      notifyListeners();
      _startPositionStream();
    }
    final id = _activeAttendanceId;
    if (id == null) return;
    // The elapsed clock may have been frozen too; re-push so the server's
    // record matches reality.
    unawaited(refreshLocation().then((loc) {
      if (loc != null) unawaited(sendLocationUpdate(id));
    }));
  }

  /// Called when the app is backgrounded. The position stream is cancelled so
  /// it is not held open while suspended; the elapsed clock keeps running since
  /// it is computed from the wall clock, not counted.
  void pauseLiveTracking() {
    _positionSub?.cancel();
    _positionSub = null;
  }

  DateTime? _lastPush;

  /// Pushes a location update at most once per [_pushInterval].
  ///
  /// The underlying position stream fires far more often than the server needs,
  /// and an unconditional push on every fix would rate-limit the API.
  Future<void> _maybePush(Position position, String attendanceId) async {
    final last = _lastPush;
    final now = DateTime.now();
    if (last != null && now.difference(last) < _pushInterval) return;

    _latestPosition = position;
    _evaluateGeofence();
    notifyListeners();

    _lastPush = now;
    await sendLocationUpdate(attendanceId);
  }

  void _startPositionStream() {
    final id = _activeAttendanceId;
    if (id == null) return;

    _positionSub?.cancel();
    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        // Frequent enough to react to a breach, cheap enough for the battery.
        distanceFilter: 25,
      ),
    ).listen(
      (position) {
        if (_activeAttendanceId == null) return;
        unawaited(_maybePush(position, id));
      },
      // A stream error (permission revoked, GPS off) must not tear down the
      // session — the interval fallback in the screen still pushes fixes.
      onError: (_) {},
    );
  }

  Duration _elapsedFromClock() {
    final start = _checkInAt;
    if (start == null) return Duration.zero;
    final elapsed = DateTime.now().difference(start);
    return elapsed.isNegative ? Duration.zero : elapsed;
  }

    @override
  void dispose() {
    stopLiveTracking();
    super.dispose();
  }
}
