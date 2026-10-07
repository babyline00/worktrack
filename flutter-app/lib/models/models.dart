// Data models for WorkTrack mobile app

class User {
  final String id;
  final String? employeeId;
  final String name;
  final String role;
  final String? companyId;
  final String? companyName;
  final String email;
  final String? avatarColor;
  final String? avatarUrl;

  User({
    required this.id,
    this.employeeId,
    required this.name,
    required this.role,
    this.companyId,
    this.companyName,
    required this.email,
    this.avatarColor,
    this.avatarUrl,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      employeeId: json['employeeId'],
      name: json['name'] ?? '',
      role: json['role'] ?? 'EMPLOYEE',
      companyId: json['companyId'],
      companyName: json['companyName'],
      email: json['email'] ?? '',
      avatarColor: json['avatarColor'],
      avatarUrl: json['avatarUrl'],
    );
  }
}

class Project {
  final String id;
  final String name;
  final String code;
  final String status;
  final String? location;
  final double? latitude;
  final double? longitude;
  final int radius;

  Project({
    required this.id,
    required this.name,
    required this.code,
    required this.status,
    this.location,
    this.latitude,
    this.longitude,
    required this.radius,
  });

  factory Project.fromJson(Map<String, dynamic> json) {
    final coords = json['coords'] as Map<String, dynamic>?;
    return Project(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      code: json['code'] ?? '',
      status: json['status'] ?? 'ACTIVE',
      location: json['location'],
      latitude: coords?['latitude']?.toDouble(),
      longitude: coords?['longitude']?.toDouble(),
      radius: json['radius'] ?? 200,
    );
  }
}

class Attendance {
  final String id;
  final String status;
  final String? projectName;
  final String? checkInAt;
  final String? checkOutAt;
  final int workingMinutes;
  final int lateMinutes;
  final String sessionStatus;
  final String attendanceStatus;
  final String verificationStatus;
  final bool insideGeofence;
  final int? distanceFromProject;
  final String? checkInPhoto;
  final String? checkOutPhoto;

  Attendance({
    required this.id,
    required this.status,
    this.projectName,
    this.checkInAt,
    this.checkOutAt,
    required this.workingMinutes,
    required this.lateMinutes,
    required this.sessionStatus,
    required this.attendanceStatus,
    required this.verificationStatus,
    required this.insideGeofence,
    this.distanceFromProject,
    this.checkInPhoto,
    this.checkOutPhoto,
  });

  factory Attendance.fromJson(Map<String, dynamic> json) {
    final att = json['attendance'] as Map<String, dynamic>?;
    final project = att?['project'] as Map<String, dynamic>?;
    return Attendance(
      id: att?['id'] ?? json['id'] ?? '',
      status: json['status'] ?? att?['sessionStatus'] ?? 'NOT_STARTED',
      projectName: project?['name'],
      checkInAt: att?['checkInAt'],
      checkOutAt: att?['checkOutAt'],
      workingMinutes: att?['workingMinutes'] ?? 0,
      lateMinutes: att?['lateMinutes'] ?? 0,
      sessionStatus: att?['sessionStatus'] ?? 'NOT_STARTED',
      attendanceStatus: att?['attendanceStatus'] ?? 'PENDING',
      verificationStatus: att?['verificationStatus'] ?? 'PENDING',
      insideGeofence: att?['insideGeofence'] ?? true,
      distanceFromProject: att?['distanceFromProject'],
      checkInPhoto: att?['checkInPhoto'],
      checkOutPhoto: att?['checkOutPhoto'],
    );
  }
}

class AttendanceHistoryItem {
  final String id;
  final String date;
  final String project;
  final String? checkIn;
  final String? checkOut;
  final int workingMinutes;
  final String sessionStatus;
  final String attendanceStatus;
  final String verificationStatus;
  final int lateMinutes;

  AttendanceHistoryItem({
    required this.id,
    required this.date,
    required this.project,
    this.checkIn,
    this.checkOut,
    required this.workingMinutes,
    required this.sessionStatus,
    required this.attendanceStatus,
    required this.verificationStatus,
    required this.lateMinutes,
  });

  factory AttendanceHistoryItem.fromJson(Map<String, dynamic> json) {
    return AttendanceHistoryItem(
      id: json['id'] ?? '',
      date: json['date'] ?? '',
      project: json['project'] ?? '—',
      checkIn: json['checkIn'],
      checkOut: json['checkOut'],
      workingMinutes: json['workingMinutes'] ?? 0,
      sessionStatus: json['sessionStatus'] ?? '',
      attendanceStatus: json['attendanceStatus'] ?? '',
      verificationStatus: json['verificationStatus'] ?? '',
      lateMinutes: json['lateMinutes'] ?? 0,
    );
  }
}

class NotificationItem {
  final String id;
  final String type;
  final String title;
  final String? description;
  final String? timeAgo;
  final bool unread;
  final String createdAt;

  NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    this.description,
    this.timeAgo,
    required this.unread,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] ?? '',
      type: json['type'] ?? 'system',
      title: json['title'] ?? '',
      description: json['description'],
      timeAgo: json['timeAgo'],
      unread: json['unread'] ?? false,
      createdAt: json['createdAt'] ?? '',
    );
  }
}

class LeaveRequest {
  final String id;
  final String type;
  final String from;
  final String to;
  final int days;
  final String? reason;
  final String status;

  LeaveRequest({
    required this.id,
    required this.type,
    required this.from,
    required this.to,
    required this.days,
    this.reason,
    required this.status,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id'] ?? '',
      type: json['type'] ?? 'ANNUAL',
      from: json['from'] ?? '',
      to: json['to'] ?? '',
      days: json['days'] ?? 1,
      reason: json['reason'],
      status: json['status'] ?? 'pending',
    );
  }
}

class DashboardData {
  final String? employeeName;
  final String? employeeId;
  final String? avatarColor;
  final String? designation;
  final String? companyName;
  final String? companyCode;
  final String? timezone;
  final TodayAttendance? today;
  final List<Project> projects;
  final List<AttendanceHistoryItem> recentAttendance;

  DashboardData({
    this.employeeName,
    this.employeeId,
    this.avatarColor,
    this.designation,
    this.companyName,
    this.companyCode,
    this.timezone,
    this.today,
    required this.projects,
    required this.recentAttendance,
  });

  factory DashboardData.fromJson(Map<String, dynamic> json) {
    final emp = json['employee'] as Map<String, dynamic>? ?? {};
    final company = json['company'] as Map<String, dynamic>? ?? {};
    final today = json['today'] as Map<String, dynamic>?;

    return DashboardData(
      employeeName: emp['name'],
      employeeId: emp['employeeId'],
      avatarColor: emp['avatarColor'],
      designation: emp['designation'],
      companyName: company['name'],
      companyCode: company['code'],
      timezone: company['timezone'],
      today: today != null ? TodayAttendance.fromJson(today) : null,
      projects: (json['projects'] as List<dynamic>? ?? [])
          .map((p) => Project.fromJson(p as Map<String, dynamic>))
          .toList(),
      recentAttendance: (json['recentAttendance'] as List<dynamic>? ?? [])
          .map((a) => AttendanceHistoryItem.fromJson(a as Map<String, dynamic>))
          .toList(),
    );
  }
}

class TodayAttendance {
  final String date;
  final String status;
  final String? projectId;
  final String? projectName;
  final String? checkIn;
  final String? checkOut;
  final int workingMinutes;
  final String? attendanceId;
  final bool insideGeofence;

  TodayAttendance({
    required this.date,
    required this.status,
    this.projectId,
    this.projectName,
    this.checkIn,
    this.checkOut,
    required this.workingMinutes,
    this.attendanceId,
    required this.insideGeofence,
  });

  factory TodayAttendance.fromJson(Map<String, dynamic> json) {
    final project = json['project'] as Map<String, dynamic>?;
    return TodayAttendance(
      date: json['date'] ?? '',
      status: json['status'] ?? 'NOT_STARTED',
      projectId: project?['id'],
      projectName: project?['name'],
      checkIn: json['checkIn'],
      checkOut: json['checkOut'],
      workingMinutes: json['workingMinutes'] ?? 0,
      attendanceId: json['attendanceId'],
      insideGeofence: json['insideGeofence'] ?? true,
    );
  }

  bool get isWorking => status == 'WORKING';
  bool get isCheckedOut => status == 'COMPLETED';
  bool get isNotStarted => status == 'NOT_STARTED';
}
