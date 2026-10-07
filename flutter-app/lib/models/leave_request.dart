// Leave request model — from POST `/leaves`.
import 'package:intl/intl.dart';

class LeaveRequest {
  final String? id;
  final String type;          // ANNUAL | SICK | CASUAL | UNPAID | MATERNITY | ...
  final String fromDate;      // yyyy-MM-dd
  final String toDate;        // yyyy-MM-dd
  final int days;
  final String? reason;
  final String status;        // pending | approved | rejected
  final String? employeeId;
  final String? reviewedAt;
  final DateTime? createdAt;

  LeaveRequest({
    this.id,
    required this.type,
    required this.fromDate,
    required this.toDate,
    required this.days,
    this.reason,
    this.status = 'pending',
    this.employeeId,
    this.reviewedAt,
    this.createdAt,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> j) {
    final inner = (j['leave'] as Map<String, dynamic>?) ?? j;
    DateTime? created;
    final raw = inner['createdAt'] ?? inner['created_at'];
    if (raw is String) {
      try {
        created = DateTime.parse(raw);
      } catch (_) {}
    }
    return LeaveRequest(
      id: (inner['id'] as String?) ?? '',
      type: ((inner['type'] as String?) ?? 'ANNUAL').toUpperCase(),
      fromDate: (inner['from'] as String?) ??
          (inner['fromDate'] as String?) ??
          '',
      toDate: (inner['to'] as String?) ??
          (inner['toDate'] as String?) ??
          '',
      days: (inner['days'] as num?)?.toInt() ?? 1,
      reason: inner['reason'] as String?,
      status: ((inner['status'] as String?) ?? 'pending').toLowerCase(),
      employeeId: inner['employeeId'] as String?,
      reviewedAt: inner['reviewedAt'] as String?,
      createdAt: created,
    );
  }

  Map<String, dynamic> toJson({String? employeeId}) => {
        if (employeeId != null) 'employeeId': employeeId,
        if (id != null) 'id': id,
        'type': type,
        'from': fromDate,
        'to': toDate,
        'days': days,
        if (reason != null) 'reason': reason,
        'status': status,
      };

  String get typeLabel {
    switch (type.toUpperCase()) {
      case 'ANNUAL':
        return 'Annual Leave';
      case 'SICK':
        return 'Sick Leave';
      case 'CASUAL':
        return 'Casual Leave';
      case 'UNPAID':
        return 'Unpaid Leave';
      case 'MATERNITY':
        return 'Maternity Leave';
      case 'PATERNITY':
        return 'Paternity Leave';
      default:
        return type[0].toUpperCase() + type.substring(1).toLowerCase();
    }
  }

  String get dateRange {
    if (fromDate == toDate) return _fmt(fromDate);
    return '${_fmt(fromDate)} — ${_fmt(toDate)}';
  }

  String _fmt(String iso) {
    try {
      return DateFormat('d MMM yyyy').format(DateTime.parse(iso));
    } catch (_) {
      return iso;
    }
  }
}
