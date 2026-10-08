// Parses the real `/mobile/dashboard` and `/mobile/attendance/today` payloads.
//
// `AttendanceProvider.loadDashboard` swallows exceptions into a generic
// "Failed to load dashboard", so a parse error is invisible in the UI — it just
// looks like an empty dashboard. These tests pin the response shapes down.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:worktrack/models/models.dart';

/// Reads a captured payload written by the test setup script.
Map<String, dynamic> loadFixture(String name) {
  final file = File('test/fixtures/$name.json');
  if (!file.existsSync()) {
    throw StateError(
      'Missing fixture $name.json — capture it from the running API first.',
    );
  }
  return json.decode(file.readAsStringSync()) as Map<String, dynamic>;
}

void main() {
  group('DashboardData.fromJson', () {
    late Map<String, dynamic> payload;

    setUpAll(() => payload = loadFixture('dashboard'));

    test('parses the employee and company', () {
      final d = DashboardData.fromJson(payload);
      expect(d.employeeName, isNotNull);
      expect(d.companyCode, isNotNull);
    });

    test('parses assigned projects with their geofence', () {
      final d = DashboardData.fromJson(payload);
      expect(d.projects, isNotEmpty);
      final p = d.projects.first;
      expect(p.id, isNotEmpty);
      expect(p.latitude, isNotNull);
      expect(p.longitude, isNotNull);
      expect(p.radius, greaterThan(0));
    });

    test("parses today's block including the multi-session fields", () {
      final d = DashboardData.fromJson(payload);
      expect(d.today, isNotNull);
      final today = d.today!;
      expect(today.status, 'COMPLETED');
      expect(today.sessionCount, greaterThanOrEqualTo(1));
      expect(today.workingMinutes, isA<int>());
    });

    test('parses recent attendance', () {
      final d = DashboardData.fromJson(payload);
      expect(d.recentAttendance, isA<List<AttendanceHistoryItem>>());
    });
  });

  group('Attendance.fromJson (attendance/today envelope)', () {
    late Map<String, dynamic> payload;

    setUpAll(() => payload = loadFixture('today'));

    test('reads the session from the nested attendance object', () {
      final a = Attendance.fromJson(payload);
      expect(a.sessionStatus, 'COMPLETED');
      expect(a.checkInAt, isNotNull);
      expect(a.checkOutAt, isNotNull);
      expect(a.id, isNotEmpty);
    });

    test('exposes the day aggregate and session count', () {
      final a = Attendance.fromJson(payload);
      expect(a.sessionCount, 2);
      expect(a.totalWorkingMinutes, isA<int>());
    });

    test('carries the project geofence for the live tracker', () {
      final a = Attendance.fromJson(payload);
      expect(a.projectLatitude, isNotNull);
      expect(a.projectLongitude, isNotNull);
      expect(a.projectRadiusMeters, isNotNull);
    });
  });
}