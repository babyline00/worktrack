// Status card — pill-style status badge used on the dashboard and elsewhere.
import 'package:flutter/material.dart';

import '../core/constants.dart';

enum StatusKind { working, notStarted, completed, late, absent, info, warning, danger, success }

class StatusBadge extends StatelessWidget {
  final String label;
  final StatusKind kind;
  final double? fontSize;
  final EdgeInsets? padding;

  const StatusBadge({
    super.key,
    required this.label,
    required this.kind,
    this.fontSize,
    this.padding,
  });

  factory StatusBadge.fromStatus(String status) {
    switch (status.toUpperCase()) {
      case 'WORKING':
        return StatusBadge(label: 'Working', kind: StatusKind.working);
      case 'COMPLETED':
        return StatusBadge(label: 'Completed', kind: StatusKind.completed);
      case 'NOT_STARTED':
        return StatusBadge(label: 'Not Started', kind: StatusKind.notStarted);
      case 'LATE':
        return StatusBadge(label: 'Late', kind: StatusKind.late);
      case 'ABSENT':
        return StatusBadge(label: 'Absent', kind: StatusKind.absent);
      case 'PRESENT':
        return StatusBadge(label: 'Present', kind: StatusKind.success);
      case 'PENDING':
        return StatusBadge(label: 'Pending', kind: StatusKind.warning);
      case 'APPROVED':
        return StatusBadge(label: 'Approved', kind: StatusKind.success);
      case 'REJECTED':
        return StatusBadge(label: 'Rejected', kind: StatusKind.danger);
      default:
        return StatusBadge(label: status, kind: StatusKind.info);
    }
  }

  Color get _bg {
    switch (kind) {
      case StatusKind.working:
        return AppColors.primaryBg;
      case StatusKind.notStarted:
        return const Color(0xFFF1F5F9);
      case StatusKind.completed:
        return AppColors.successBg;
      case StatusKind.late:
        return AppColors.warningBg;
      case StatusKind.absent:
      case StatusKind.danger:
        return AppColors.dangerBg;
      case StatusKind.success:
        return AppColors.successBg;
      case StatusKind.warning:
        return AppColors.warningBg;
      case StatusKind.info:
        return AppColors.infoBg;
    }
  }

  Color get _fg {
    switch (kind) {
      case StatusKind.working:
        return AppColors.primary;
      case StatusKind.notStarted:
        return AppColors.textSecondary;
      case StatusKind.completed:
      case StatusKind.success:
        return AppColors.success;
      case StatusKind.late:
      case StatusKind.warning:
        return AppColors.warning;
      case StatusKind.absent:
      case StatusKind.danger:
        return AppColors.danger;
      case StatusKind.info:
        return AppColors.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ??
          const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: _bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: _fg,
          fontSize: fontSize ?? 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}
