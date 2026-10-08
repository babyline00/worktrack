// Geofence maths and breach tracking, shared by the provider, the dashboard and
// the selfie flow.
//
// The haversine calculation lived inline in the selfie screen before; keeping
// one copy here means the distance the user is warned about, the badge the
// dashboard shows and the auto check-out trigger can never disagree.
import 'dart:math' as math;

class Geofence {
  const Geofence._();

  /// Mean Earth radius in metres.
  static const double earthRadiusMeters = 6371000.0;

  static double _rad(double deg) => deg * math.pi / 180.0;

  /// Great-circle distance between two coordinates in metres (haversine).
  ///
  /// Returns `null` when either coordinate is unknown, so callers can tell
  /// "outside" apart from "we don't know where the project is".
  static double? distanceMeters({
    required double latitude,
    required double longitude,
    required double? projectLatitude,
    required double? projectLongitude,
  }) {
    if (projectLatitude == null || projectLongitude == null) return null;

    final dLat = _rad(latitude - projectLatitude);
    final dLng = _rad(longitude - projectLongitude);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_rad(projectLatitude)) *
            math.cos(_rad(latitude)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    return earthRadiusMeters * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  /// Whether a position counts as inside the site.
  ///
  /// A fix is only trusted once it is accurate to [maxAccuracyMeters]; a fix
  /// reporting ±500 m accuracy could read as "inside" while the employee is
  /// actually across town, so it is reported as outside rather than trusted.
  /// An unknown radius or distance means "inside" so a project without
  /// coordinates never blocks attendance.
  static bool isInside({
    required double? distanceMeters,
    required double? radiusMeters,
    double? accuracyMeters,
    double maxAccuracyMeters = 50,
  }) {
    if (distanceMeters == null || radiusMeters == null || radiusMeters <= 0) {
      return true;
    }
    if (accuracyMeters != null && accuracyMeters > maxAccuracyMeters) {
      return false;
    }
    return distanceMeters <= radiusMeters;
  }
}

/// Tracks how long an employee has been continuously outside the project site.
///
/// Auto check-out must not fire on a single bad fix — GPS drifts, tunnels lose
/// signal, and one outlier would otherwise end a shift early. This holds the
/// outside state until the employee has been clear of the radius for
/// [gracePeriod], and resets the moment they come back.
class GeofenceWatch {
  /// How long the employee must stay outside before a check-out is triggered.
  static const Duration gracePeriod = Duration(minutes: 5);

  DateTime? _outsideSince;

  /// Clock the watch measures against — the timestamp of the latest
  /// observation. Reading the wall clock directly inside [outsideDuration]
  /// would ignore a caller-supplied `now` and make the grace period untestable.
  DateTime _now = DateTime.now();

  bool _graceExceeded = false;

  /// When the current continuous outside spell began, or `null` if inside.
  DateTime? get outsideSince => _outsideSince;

  /// Whether the employee is currently outside the radius.
  bool get isOutside => _outsideSince != null;

  /// How long the employee has been continuously outside, or zero.
  Duration get outsideDuration =>
      _outsideSince == null ? Duration.zero : _now.difference(_outsideSince!);

  /// Feeds a new observation and returns whether the grace period has elapsed.
  ///
  /// Returns `true` only on the transition into "grace period exceeded", so a
  /// caller polling on a timer triggers check-out once rather than repeatedly.
  bool record({required bool outside, DateTime? now}) {
    _now = now ?? DateTime.now();

    if (!outside) {
      _outsideSince = null;
      _graceExceeded = false;
      return false;
    }

    _outsideSince ??= _now;
    final exceeded = outsideDuration >= gracePeriod;

    // Fire once, at the moment the threshold is crossed.
    final shouldTrigger = exceeded && !_graceExceeded;
    _graceExceeded = exceeded;
    return shouldTrigger;
  }

  /// Clears all breach state, e.g. once the session has ended.
  void reset() {
    _outsideSince = null;
    _graceExceeded = false;
  }
}