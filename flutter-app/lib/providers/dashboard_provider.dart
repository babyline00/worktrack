// Dashboard provider — home screen data (employee, today, projects, recent).
import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../models/attendance.dart';
import '../models/project.dart';

class DashboardProvider extends ChangeNotifier {
  // Aggregated payload from /mobile/dashboard (kept for future use).
  String? _employeeName;
  String? _employeeDesignation;
  String? _employeeInitials;
  String? _avatarColor;
  String? _companyName;
  String? _companyCode;
  String? _timezone;
  TodayAttendance? _today;
  List<Project> _projects = const [];
  List<AttendanceHistoryItem> _recent = const [];
  DashboardStats _stats = DashboardStats.empty();

  bool _loading = false;
  bool _refreshing = false;
  String? _error;

  bool get loading => _loading;
  bool get refreshing => _refreshing;
  String? get error => _error;

  String get employeeName => _employeeName ?? '—';
  String get employeeDesignation => _employeeDesignation ?? '';
  String get employeeInitials => _employeeInitials ?? '?';
  String get avatarColor => _avatarColor ?? '#2563EB';
  String get companyName => _companyName ?? '';
  String get companyCode => _companyCode ?? '';
  String get timezone => _timezone ?? 'Asia/Karachi';
  TodayAttendance? get today => _today;
  List<Project> get projects => _projects;
  List<AttendanceHistoryItem> get recent => _recent;
  DashboardStats get stats => _stats;

  String get greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  Future<void> load({bool silent = false}) async {
    if (silent) {
      _refreshing = true;
    } else {
      _loading = true;
    }
    _error = null;
    notifyListeners();
    try {
      final data = await ApiClient.instance.get('/mobile/dashboard');
      final emp = (data['employee'] as Map<String, dynamic>?) ?? const {};
      final company = (data['company'] as Map<String, dynamic>?) ?? const {};
      _employeeName = emp['name'] as String?;
      _employeeDesignation = emp['designation'] as String?;
      _avatarColor = emp['avatarColor'] as String?;
      _companyName = company['name'] as String?;
      _companyCode = company['code'] as String?;
      _timezone = company['timezone'] as String?;
      _employeeInitials = _buildInitials(_employeeName);

      _today = TodayAttendance.fromJson(
          (data['today'] as Map<String, dynamic>?) ?? const {'status': 'NOT_STARTED'});

      _projects = ((data['projects'] as List?) ?? [])
          .map((e) => Project.fromJson(e as Map<String, dynamic>))
          .toList();

      _recent = ((data['recentAttendance'] as List?) ?? [])
          .map((e) => AttendanceHistoryItem.fromJson(e as Map<String, dynamic>))
          .toList();

      // Compute monthly stats from recent records (best-effort; backend doesn't
      // expose a stats endpoint for mobile yet).
      _stats = _computeStats(_recent);
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Failed to load dashboard';
    }
    _loading = false;
    _refreshing = false;
    notifyListeners();
  }

  /// Pull only the today's-attendance slice — used after check-in/out to keep
  /// the home screen in sync without a full reload.
  Future<void> refreshToday() async {
    try {
      final data = await ApiClient.instance.get('/mobile/attendance/today');
      final attendance = (data['attendance'] as Map<String, dynamic>?) ?? null;
      final status = (data['status'] as String?) ?? 'NOT_STARTED';
      if (attendance != null) {
        final merged = <String, dynamic>{
          'date': DateTime.now().toIso8601String().split('T')[0],
          ...attendance,
          'status': status,
        };
        _today = TodayAttendance.fromJson(merged);
      } else {
        _today = TodayAttendance(
          date: DateTime.now().toIso8601String().split('T')[0],
          status: status,
        );
      }
      notifyListeners();
    } catch (_) {
      // ignore
    }
  }

  DashboardStats _computeStats(List<AttendanceHistoryItem> recent) {
    if (recent.isEmpty) return DashboardStats.empty();
    final present = recent.where((r) =>
        r.attendanceStatus == 'PRESENT' || r.attendanceStatus == 'LATE').length;
    final late = recent.where((r) => r.attendanceStatus == 'LATE').length;
    final totalMins = recent.fold<int>(0, (a, r) => a + r.workingMinutes);
    final rate = recent.isEmpty ? 0.0 : (present / recent.length) * 100;
    return DashboardStats(
      presentDays: present,
      lateDays: late,
      attendanceRate: rate,
      totalWorkingMinutes: totalMins,
    );
  }

  String _buildInitials(String? name) {
    if (name == null || name.isEmpty) return '?';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}
