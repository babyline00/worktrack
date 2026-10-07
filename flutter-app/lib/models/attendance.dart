// Attendance models — used by dashboard, today, history, detail endpoints.
import 'package:intl/intl.dart';

// Today's attendance + work session status (from `/mobile/dashboard` and
// `/mobile/attendance/today`).
class TodayAttendance {
  final String? id;
  final String date;
  final String status;            // NOT_STARTED | WORKING | COMPLETED
  final String? attendanceStatus; // PRESENT | LATE | ABSENT | HALF_DAY
  final String? verificationStatus;
  final ProjectSummary? project;
  final String? checkIn;          // formatted time e.g. "9:30 AM"
  final String? checkOut;
  final String? checkInAt;        // ISO 8601
  final String? checkOutAt;
  final int workingMinutes;
  final int lateMinutes;
  final bool insideGeofence;
  final double? distanceFromProject;
  final String? checkInPhoto;
  final String? checkOutPhoto;

  TodayAttendance({
    this.id,
    required this.date,
    required this.status,
    this.attendanceStatus,
    this.verificationStatus,
    this.project,
    this.checkIn,
    this.checkOut,
    this.checkInAt,
    this.checkOutAt,
    this.workingMinutes = 0,
    this.lateMinutes = 0,
    this.insideGeofence = true,
    this.distanceFromProject,
    this.checkInPhoto,
    this.checkOutPhoto,
  });

  factory TodayAttendance.fromJson(Map<String, dynamic> j) {
    final project = (j['project'] as Map<String, dynamic>?) == null
        ? null
        : ProjectSummary.fromJson(j['project'] as Map<String, dynamic>);
    return TodayAttendance(
      id: (j['id'] as String?) ?? (j['attendanceId'] as String?),
      date: (j['date'] as String?) ??
          (DateTime.now().toIso8601String().split('T')[0]),
      status: (j['status'] as String?) ?? 'NOT_STARTED',
      attendanceStatus: j['attendanceStatus'] as String?,
      verificationStatus: j['verificationStatus'] as String?,
      project: project,
      checkIn: (j['checkIn'] as String?) ?? (j['checkInTime'] as String?),
      checkOut: (j['checkOut'] as String?) ?? (j['checkOutTime'] as String?),
      checkInAt: j['checkInAt'] as String?,
      checkOutAt: j['checkOutAt'] as String?,
      workingMinutes: (j['workingMinutes'] as num?)?.toInt() ?? 0,
      lateMinutes: (j['lateMinutes'] as num?)?.toInt() ?? 0,
      insideGeofence: (j['insideGeofence'] as bool?) ?? true,
      distanceFromProject: (j['distanceFromProject'] as num?)?.toDouble(),
      checkInPhoto: j['checkInPhoto'] as String?,
      checkOutPhoto: j['checkOutPhoto'] as String?,
    );
  }

  bool get isWorking => status == 'WORKING';
  bool get isCompleted => status == 'COMPLETED';
  bool get isNotStarted => status == 'NOT_STARTED';

  Map<String, dynamic> toJson() => {
        'id': id,
        'date': date,
        'status': status,
        'attendanceStatus': attendanceStatus,
        'verificationStatus': verificationStatus,
        'project': project?.toJson(),
        'checkIn': checkIn,
        'checkOut': checkOut,
        'checkInAt': checkInAt,
        'checkOutAt': checkOutAt,
        'workingMinutes': workingMinutes,
        'lateMinutes': lateMinutes,
        'insideGeofence': insideGeofence,
        'distanceFromProject': distanceFromProject,
        'checkInPhoto': checkInPhoto,
        'checkOutPhoto': checkOutPhoto,
      };
}

class ProjectSummary {
  final String id;
  final String name;
  final String? code;
  ProjectSummary({required this.id, required this.name, this.code});

  factory ProjectSummary.fromJson(Map<String, dynamic> j) => ProjectSummary(
        id: (j['id'] as String?) ?? '',
        name: (j['name'] as String?) ?? '',
        code: j['code'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        if (code != null) 'code': code,
      };
}

/// Aggregate stats for the dashboard "this month" card.
class DashboardStats {
  final int presentDays;
  final int lateDays;
  final double attendanceRate;
  final int totalWorkingMinutes;

  DashboardStats({
    this.presentDays = 0,
    this.lateDays = 0,
    this.attendanceRate = 0,
    this.totalWorkingMinutes = 0,
  });

  factory DashboardStats.empty() => DashboardStats();
}

/// History list item (from `/mobile/attendance/history`).
class AttendanceHistoryItem {
  final String id;
  final String date;
  final String project;
  final String? projectCode;
  final String? checkIn;
  final String? checkOut;
  final int workingMinutes;
  final String workingTime;
  final String sessionStatus;
  final String attendanceStatus;
  final String verificationStatus;
  final int lateMinutes;

  AttendanceHistoryItem({
    required this.id,
    required this.date,
    required this.project,
    this.projectCode,
    this.checkIn,
    this.checkOut,
    this.workingMinutes = 0,
    this.workingTime = '',
    required this.sessionStatus,
    required this.attendanceStatus,
    required this.verificationStatus,
    this.lateMinutes = 0,
  });

  factory AttendanceHistoryItem.fromJson(Map<String, dynamic> j) =>
      AttendanceHistoryItem(
        id: (j['id'] as String?) ?? '',
        date: (j['date'] as String?) ?? '',
        project: (j['project'] as String?) ?? '—',
        projectCode: j['projectCode'] as String?,
        checkIn: j['checkIn'] as String?,
        checkOut: j['checkOut'] as String?,
        workingMinutes: (j['workingMinutes'] as num?)?.toInt() ?? 0,
        workingTime: (j['workingTime'] as String?) ?? '',
        sessionStatus: (j['sessionStatus'] as String?) ?? '',
        attendanceStatus: (j['attendanceStatus'] as String?) ?? '',
        verificationStatus: (j['verificationStatus'] as String?) ?? '',
        lateMinutes: (j['lateMinutes'] as num?)?.toInt() ?? 0,
      );

  String get formattedDate {
    try {
      final d = DateTime.parse(date);
      return DateFormat('EEE, d MMM yyyy').format(d);
    } catch (_) {
      return date;
    }
  }

  String get dayNumber {
    try {
      return DateFormat('d').format(DateTime.parse(date));
    } catch (_) {
      return date;
    }
  }

  String get monthShort {
    try {
      return DateFormat('MMM').format(DateTime.parse(date)).toUpperCase();
    } catch (_) {
      return '';
    }
  }
}

/// Full attendance detail (used by detail screen — populated from today's
/// record + history item).
class AttendanceDetail {
  final String id;
  final String date;
  final ProjectSummary? project;
  final String? checkInAt;
  final String? checkOutAt;
  final String? checkInTime;
  final String? checkOutTime;
  final int workingMinutes;
  final int lateMinutes;
  final String sessionStatus;
  final String attendanceStatus;
  final String verificationStatus;
  final bool insideGeofence;
  final double? distanceFromProject;
  final String? checkInPhoto;
  final String? checkOutPhoto;
  final AttendanceLocation? lastLocation;

  AttendanceDetail({
    required this.id,
    required this.date,
    this.project,
    this.checkInAt,
    this.checkOutAt,
    this.checkInTime,
    this.checkOutTime,
    this.workingMinutes = 0,
    this.lateMinutes = 0,
    required this.sessionStatus,
    required this.attendanceStatus,
    required this.verificationStatus,
    this.insideGeofence = true,
    this.distanceFromProject,
    this.checkInPhoto,
    this.checkOutPhoto,
    this.lastLocation,
  });

  factory AttendanceDetail.fromJson(Map<String, dynamic> j) {
    final project = (j['project'] as Map<String, dynamic>?) == null
        ? null
        : ProjectSummary.fromJson(j['project'] as Map<String, dynamic>);
    final loc = (j['lastLocation'] as Map<String, dynamic>?) == null
        ? null
        : AttendanceLocation.fromJson(j['lastLocation'] as Map<String, dynamic>);
    return AttendanceDetail(
      id: (j['id'] as String?) ?? '',
      date: (j['date'] as String?) ??
          (DateTime.now().toIso8601String().split('T')[0]),
      project: project,
      checkInAt: j['checkInAt'] as String?,
      checkOutAt: j['checkOutAt'] as String?,
      checkInTime: j['checkInTime'] as String? ?? j['checkIn'] as String?,
      checkOutTime: j['checkOutTime'] as String? ?? j['checkOut'] as String?,
      workingMinutes: (j['workingMinutes'] as num?)?.toInt() ?? 0,
      lateMinutes: (j['lateMinutes'] as num?)?.toInt() ?? 0,
      sessionStatus: (j['sessionStatus'] as String?) ??
          (j['sessionStatus'] as String?) ??
          '',
      attendanceStatus: (j['attendanceStatus'] as String?) ?? '',
      verificationStatus: (j['verificationStatus'] as String?) ?? '',
      insideGeofence: (j['insideGeofence'] as bool?) ?? true,
      distanceFromProject: (j['distanceFromProject'] as num?)?.toDouble(),
      checkInPhoto: j['checkInPhoto'] as String?,
      checkOutPhoto: j['checkOutPhoto'] as String?,
      lastLocation: loc,
    );
  }

  factory AttendanceDetail.fromHistory(AttendanceHistoryItem h) =>
      AttendanceDetail(
        id: h.id,
        date: h.date,
        project: null,
        checkInTime: h.checkIn,
        checkOutTime: h.checkOut,
        workingMinutes: h.workingMinutes,
        lateMinutes: h.lateMinutes,
        sessionStatus: h.sessionStatus,
        attendanceStatus: h.attendanceStatus,
        verificationStatus: h.verificationStatus,
      );

  String get formattedDate {
    try {
      final d = DateTime.parse(date);
      return DateFormat('EEEE, d MMM yyyy').format(d);
    } catch (_) {
      return date;
    }
  }

  String get workingTimeText {
    if (workingMinutes <= 0) return '—';
    final h = workingMinutes ~/ 60;
    final m = workingMinutes % 60;
    return h > 0 ? '${h}h ${m.toString().padLeft(2, '0')}m' : '${m}m';
  }
}

class AttendanceLocation {
  final double latitude;
  final double longitude;
  final double accuracy;
  final String recordedAt;
  final bool insideGeofence;

  AttendanceLocation({
    required this.latitude,
    required this.longitude,
    this.accuracy = 0,
    required this.recordedAt,
    this.insideGeofence = true,
  });

  factory AttendanceLocation.fromJson(Map<String, dynamic> j) =>
      AttendanceLocation(
        latitude: (j['latitude'] as num?)?.toDouble() ?? 0,
        longitude: (j['longitude'] as num?)?.toDouble() ?? 0,
        accuracy: (j['accuracy'] as num?)?.toDouble() ?? 0,
        recordedAt: (j['recordedAt'] as String?) ?? '',
        insideGeofence: (j['insideGeofence'] as bool?) ?? true,
      );
}
