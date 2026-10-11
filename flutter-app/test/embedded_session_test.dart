// Guards the single-request dashboard path.
//
// The dashboard used to be followed by a second call to
// /mobile/attendance/today purely to obtain the project coordinates, ISO
// timestamps and last known fix. The dashboard now embeds that session, so if
// the embedded shape ever drifts from what Attendance.fromJson expects, the app
// would silently show a session with no geofence and no timer — a regression
// with no visible error anywhere.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:worktrack/models/models.dart';

Map<String, dynamic> loadUnwrapped(String name) {
  final raw = File('test/fixtures/$name.json').readAsStringSync();
  final decoded = json.decode(raw) as Map<String, dynamic>;
  // The API wraps in { success, data }; ApiClient._unwrap strips it in the app.
  return (decoded['data'] as Map<String, dynamic>?) ?? decoded;
}

void main() {
  group('dashboard embeds the session', () {
    late DashboardData d;

    setUpAll(() {
      d = DashboardData.fromJson(loadUnwrapped('dashboard_live_session'));
    });

    test('today carries the session object', () {
      expect(d.today, isNotNull);
      expect(d.today!.attendanceJson, isNotNull,
          reason: 'dashboard must embed the session so the app can skip '
              'the follow-up /mobile/attendance/today request');
    });

    test('the embedded session parses without a second request', () {
      final att = Attendance.fromJson(d.today!.attendanceJson!);

      expect(att.id, isNotEmpty);
      expect(att.sessionStatus, isNotEmpty);
      expect(att.checkInAt, isNotNull,
          reason: 'the live timer needs the ISO check-in timestamp');
      expect(att.projectLatitude, isNotNull,
          reason: 'the geofence cannot be configured without coordinates');
      expect(att.projectLongitude, isNotNull);
      expect(att.projectRadiusMeters, isNotNull);
      expect(att.insideGeofence, isA<bool>());
      expect(att.verificationStatus, isNotEmpty);
    });

    test('the accuracy ceiling travels with it', () {
      expect(d.maxGpsAccuracy, 50);
    });
  });
}
