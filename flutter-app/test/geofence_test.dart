// Geofence maths and breach tracking.
//
// The grace-period behaviour is the part that decides whether an employee's
// shift ends early, so it is pinned down here rather than only exercised by
// waiting on a device.
import 'package:flutter_test/flutter_test.dart';
import 'package:worktrack/core/geofence.dart';

void main() {
  group('Geofence.distanceMeters', () {
    test('is zero for the same point', () {
      final d = Geofence.distanceMeters(
        latitude: 31.492857,
        longitude: 74.293935,
        projectLatitude: 31.492857,
        projectLongitude: 74.293935,
      );
      expect(d, closeTo(0, 0.01));
    });

    test('matches a known short distance', () {
      // ~111 m per 0.001 degree of latitude.
      final d = Geofence.distanceMeters(
        latitude: 31.493857,
        longitude: 74.293935,
        projectLatitude: 31.492857,
        projectLongitude: 74.293935,
      );
      expect(d, closeTo(111, 2));
    });

    test('returns null when the project has no coordinates', () {
      expect(
        Geofence.distanceMeters(
          latitude: 31.5,
          longitude: 74.3,
          projectLatitude: null,
          projectLongitude: null,
        ),
        isNull,
      );
    });
  });

  group('Geofence.isInside', () {
    test('allows a fix within the radius', () {
      expect(
        Geofence.isInside(distanceMeters: 100, radiusMeters: 250),
        isTrue,
      );
    });

    test('rejects a fix beyond the radius', () {
      expect(
        Geofence.isInside(distanceMeters: 400, radiusMeters: 250),
        isFalse,
      );
    });

    test('treats an unknown radius as inside so attendance is not blocked', () {
      expect(
        Geofence.isInside(distanceMeters: 99999, radiusMeters: null),
        isTrue,
      );
      expect(
        Geofence.isInside(distanceMeters: 99999, radiusMeters: 0),
        isTrue,
      );
    });

    test('does not trust a low-accuracy fix', () {
      // A fix claiming ±500 m could read as inside while the employee is
      // actually elsewhere, so it must not satisfy the geofence.
      expect(
        Geofence.isInside(
          distanceMeters: 10,
          radiusMeters: 250,
          accuracyMeters: 500,
        ),
        isFalse,
      );
    });
  });

  group('GeofenceWatch', () {
    test('does not trigger inside the radius', () {
      final watch = GeofenceWatch();
      expect(watch.record(outside: false), isFalse);
      expect(watch.isOutside, isFalse);
    });

    test('does not trigger immediately on first breach', () {
      final watch = GeofenceWatch();
      // A single GPS outlier must not end a shift.
      expect(watch.record(outside: true), isFalse);
      expect(watch.isOutside, isTrue);
      expect(watch.outsideSince, isNotNull);
    });

    test('triggers once the grace period elapses', () {
      final watch = GeofenceWatch();
      final start = DateTime(2026, 10, 8, 9);
      watch.record(outside: true, now: start);
      expect(watch.record(outside: true, now: start), isFalse);

      // Just short of the grace period.
      final justBefore = start.add(GeofenceWatch.gracePeriod - const Duration(seconds: 1));
      expect(watch.record(outside: true, now: justBefore), isFalse);

      final elapsed = start.add(GeofenceWatch.gracePeriod);
      expect(watch.record(outside: true, now: elapsed), isTrue);
    });

    test('fires only once per spell outside', () {
      final watch = GeofenceWatch();
      final start = DateTime(2026, 10, 8, 9);
      watch.record(outside: true, now: start);
      final after = start.add(const Duration(minutes: 10));
      expect(watch.record(outside: true, now: after), isTrue);
      // Still outside on the next poll — must not prompt again.
      expect(watch.record(outside: true, now: after), isFalse);
    });

    test('resets the clock when the employee comes back', () {
      final watch = GeofenceWatch();
      final start = DateTime(2026, 10, 8, 9);
      watch.record(outside: true, now: start);
      watch.record(outside: false, now: start.add(const Duration(minutes: 4)));
      expect(watch.outsideSince, isNull);

      // A fresh spell has to serve the whole grace period again.
      final reLeft = start.add(const Duration(minutes: 5));
      expect(watch.record(outside: true, now: reLeft), isFalse);
      expect(
        watch.record(
          outside: true,
          now: reLeft.add(GeofenceWatch.gracePeriod),
        ),
        isTrue,
      );
    });

    test('reset clears breach state', () {
      final watch = GeofenceWatch();
      watch.record(outside: true);
      watch.reset();
      expect(watch.isOutside, isFalse);
      expect(watch.outsideDuration, Duration.zero);
    });
  });
}