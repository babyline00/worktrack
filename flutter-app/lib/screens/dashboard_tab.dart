// Dashboard tab — matches Stitch design with blue header, profile card, status section, verification checklist
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../models/models.dart';
import '../providers/attendance_provider.dart';
import '../providers/auth_provider.dart';
import '../providers/notification_provider.dart';
import '../widgets/nas_mark.dart';
import 'notifications_screen.dart';
import 'project_selection_screen.dart';
import 'working_session_screen.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  Timer? _timer;
  int _elapsedSeconds = 0;
  Timer? _locationTimer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    final att = context.read<AttendanceProvider>().todayAttendance;
    if (att != null && att.checkInAt != null && att.sessionStatus == 'WORKING') {
      final checkIn = DateTime.tryParse(att.checkInAt!) ?? DateTime.now();
      // Clamp at zero: a server timestamp a few seconds ahead (clock skew, or
      // a record seeded in the future) would otherwise render a negative timer.
      _elapsedSeconds = DateTime.now().difference(checkIn).inSeconds.clamp(0, 1 << 31);
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        setState(() => _elapsedSeconds++);
      });

      // Track the session in the background while the dashboard is open:
      // refresh the fix, then push it so live tracking stays current.
      if (att.id.isNotEmpty) {
        _locationTimer?.cancel();
        _locationTimer = Timer.periodic(const Duration(minutes: 2), (_) {
          if (!mounted) return;
          final provider = context.read<AttendanceProvider>();
          provider.refreshLocation().then((loc) {
            if (loc != null) provider.sendLocationUpdate(att.id);
          });
        });
      }
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Re-check timer when data refreshes
    final att = context.read<AttendanceProvider>().todayAttendance;
    if (att?.sessionStatus == 'WORKING' && _timer == null) {
      _startTimer();
    } else if (att?.sessionStatus != 'WORKING') {
      _timer?.cancel();
      _timer = null;
      _locationTimer?.cancel();
      _locationTimer = null;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _locationTimer?.cancel();
    super.dispose();
  }

  String _formatDuration(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  String _formatMins(int mins) {
    final h = mins ~/ 60;
    final m = mins % 60;
    return '${h}h ${m.toString().padLeft(2, '0')}m';
  }

  /// Prefers the API's company-timezone clock string and only falls back to
  /// re-deriving it from the UTC ISO timestamp.
  String _formatTime(String? iso, {String? preformatted}) {
    if (preformatted != null && preformatted.isNotEmpty) return preformatted;
    if (iso == null) return '---';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final h12 = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      return '$h12:${dt.minute.toString().padLeft(2, '0')} ${dt.hour >= 12 ? 'PM' : 'AM'}';
    } catch (_) {
      return '---';
    }
  }

  @override
  Widget build(BuildContext context) {
    final att = context.watch<AttendanceProvider>();
    final auth = context.watch<AuthProvider>();
    final dashboard = att.dashboard;
    final today = att.todayAttendance;
    final isWorking = today != null && today.sessionStatus == 'WORKING';
    final isCheckedOut = today != null && today.sessionStatus == 'COMPLETED';
    final isNotStarted = today == null || today.sessionStatus == 'NOT_STARTED';

    // The server closes a session that stays outside the project radius. Tell
    // the employee rather than silently resetting the timer.
    if (att.wasAutoCheckedOut) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        att.acknowledgeAutoCheckOut();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Your session was closed automatically: you stayed outside the '
              'project area for too long. It has been flagged for review.',
            ),
            backgroundColor: AppColors.warning,
            duration: Duration(seconds: 7),
          ),
        );
      });
    }

    // Minutes already banked from sessions completed earlier today. Added to the
    // live session so a second check-in does not reset the day's clock.
    final bankedSeconds = (today?.totalWorkingMinutes ?? 0) * 60;

    return Scaffold(
      body: Container(
        color: AppColors.background,
        child: CustomScrollView(
          slivers: [
            // Blue header
            SliverAppBar(
              expandedHeight: 120,
              pinned: false,
              flexibleSpace: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF3B82F6), AppColors.primary],
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const NasLockup(width: 118),
                        // Was `onPressed: () {}` — the bell did nothing and the
                        // notifications screen was unreachable from anywhere.
                        Consumer<NotificationProvider>(
                          builder: (context, notifs, _) => IconButton(
                            tooltip: notifs.hasUnread
                                ? '${notifs.unreadCount} unread notifications'
                                : 'Notifications',
                            icon: Badge(
                              isLabelVisible: notifs.hasUnread,
                              label: Text(notifs.unreadCount > 99
                                  ? '99+'
                                  : '${notifs.unreadCount}'),
                              backgroundColor: AppColors.danger,
                              child: const Icon(Icons.notifications_outlined,
                                  color: Colors.white),
                            ),
                            onPressed: () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => const NotificationsScreen(),
                                ),
                              );
                              // The screen may have cleared items; resync so the
                              // badge reflects what actually happened.
                              if (!context.mounted) return;
                              await notifs.load();
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // Content
            SliverToBoxAdapter(
              child: att.isLoading && dashboard == null
                ? const SizedBox(height: 300, child: Center(child: CircularProgressIndicator()))
                : Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      children: [
                        const SizedBox(height: 8),

                        // Profile card
                        _ProfileCard(
                          name: dashboard?.employeeName ?? auth.user?.name ?? 'User',
                          empId: dashboard?.employeeId ?? auth.user?.employeeId ?? '---',
                          designation: dashboard?.designation ?? '',
                        ),
                        const SizedBox(height: 16),

                        // Current project card
                        if (dashboard != null && dashboard.projects.isNotEmpty)
                          _ProjectCard(project: dashboard.projects.first),
                        const SizedBox(height: 16),

                        // Status section
                        _StatusSection(
                          isNotStarted: isNotStarted,
                          isWorking: isWorking,
                          isCheckedOut: isCheckedOut,
                          // Live session plus everything already banked today,
                          // so a second session does not restart the clock.
                          elapsedSeconds: _elapsedSeconds + bankedSeconds,
                          // Day aggregate across every completed session, not just the latest one.
                          workingMinutes: today?.totalWorkingMinutes ?? 0,
                          sessionCount: today?.sessionCount ?? 1,
                        ),
                        const SizedBox(height: 20),

                        // Action button. An employee may work several sessions in one day, so a
                        // completed day still offers CHECK IN AGAIN rather than
                        // locking them out until tomorrow.
                        if (isWorking && today.id.isNotEmpty)
                          _ActionButton(
                            text: 'CHECK OUT',
                            color: AppColors.danger,
                            icon: Icons.stop,
                            onPressed: () => Navigator.push(context, MaterialPageRoute(
                              builder: (_) => WorkingSessionScreen(attendanceId: today.id),
                            )),
                          )
                        else if (dashboard != null && dashboard.projects.isNotEmpty)
                          _ActionButton(
                            text: isCheckedOut ? 'CHECK IN AGAIN' : 'CHECK IN',
                            color: AppColors.success,
                            icon: Icons.play_arrow,
                            onPressed: () => Navigator.push(context, MaterialPageRoute(
                              builder: (_) => ProjectSelectionScreen(projects: dashboard.projects),
                            )),
                          )
                        else if (isCheckedOut)
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(color: AppColors.successSoft, borderRadius: BorderRadius.circular(12)),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.check_circle, color: AppColors.success, size: 24),
                                SizedBox(width: 8),
                                Text('Your day is complete!', style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ),

                        const SizedBox(height: 24),

                        // Today's Details
                        _DetailsSection(
                          checkIn: _formatTime(today?.checkInAt, preformatted: today?.checkInTime),
                          checkOut: _formatTime(today?.checkOutAt, preformatted: today?.checkOutTime),
                          workingHours: isWorking
                              ? _formatDuration(_elapsedSeconds + bankedSeconds)
                              : _formatMins(today?.totalWorkingMinutes ?? 0),
                        ),
                        const SizedBox(height: 20),

                        // Verification section
                        _VerificationSection(
                          isNotStarted: isNotStarted,
                          isWorking: isWorking,
                          hasCheckInPhoto: (today?.checkInPhoto ?? '')
                              .isNotEmpty,
                          checkInTime: _formatTime(today?.checkInAt,
                              preformatted: today?.checkInTime),
                          insideGeofence: today?.insideGeofence ?? true,
                        ),
                        const SizedBox(height: 20),

                        // Geofence indicator
                        if (today != null)
                          _GeofenceIndicator(insideGeofence: today.insideGeofence),
                        const SizedBox(height: 16),

                        // Live device location
                        LiveLocationTile(
                          attendanceId: isWorking ? today.id : null,
                        ),
                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// Profile card — avatar + name + ID + designation
// ============================================================
class _ProfileCard extends StatelessWidget {
  final String name;
  final String empId;
  final String designation;

  const _ProfileCard({required this.name, required this.empId, required this.designation});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: AppColors.primary,
              child: Text(
                name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Good Morning,', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text('ID: $empId', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  if (designation.isNotEmpty)
                    Text(designation, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// Project card — building icon + project name + location
// ============================================================
class _ProjectCard extends StatelessWidget {
  final Project project;

  const _ProjectCard({required this.project});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
          child: const Icon(Icons.business_outlined, color: AppColors.primary, size: 20),
        ),
        title: const Text('Current Project', style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(project.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
            Text(project.location ?? '—', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
        ),
        trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted),
      ),
    );
  }
}

// ============================================================
// Status section — gray/green/red state
// ============================================================
class _StatusSection extends StatelessWidget {
  final bool isNotStarted;
  final bool isWorking;
  final bool isCheckedOut;
  final int elapsedSeconds;
  final int workingMinutes;

  /// Sessions completed today — the employee may work more than one.
  final int sessionCount;

  const _StatusSection({
    required this.isNotStarted,
    required this.isWorking,
    required this.isCheckedOut,
    required this.elapsedSeconds,
    required this.workingMinutes,
    this.sessionCount = 1,
  });

  @override
  Widget build(BuildContext context) {
    final Color bgColor;
    final String statusText;
    final Color statusColor;
    final String timeText;
    final String timeLabel;
    final IconData icon;

    if (isWorking) {
      bgColor = AppColors.successSoft;
      statusText = 'Working Now';
      statusColor = AppColors.success;
      timeText = _format(elapsedSeconds);
      timeLabel = 'Working Time';
      icon = Icons.circle;
    } else if (isCheckedOut) {
      bgColor = AppColors.successSoft;
      statusText = 'Checked Out';
      statusColor = AppColors.success;
      timeText = _formatMins(workingMinutes);
      timeLabel = 'Total Time';
      icon = Icons.check_circle;
    } else {
      bgColor = const Color(0xFFF1F5F9);
      statusText = 'Not Checked In';
      statusColor = AppColors.textSecondary;
      timeText = '00:00:00';
      timeLabel = 'Working Time';
      icon = Icons.access_time;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(icon, size: 40, color: statusColor),
          const SizedBox(height: 12),
          Text(statusText, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: statusColor)),
          const SizedBox(height: 8),
          Text(timeText, style: TextStyle(
            fontSize: 36,
            fontWeight: FontWeight.bold,
            color: isNotStarted ? AppColors.textMuted : AppColors.textPrimary,
            fontFamily: 'monospace',
            letterSpacing: 2,
          )),
          const SizedBox(height: 4),
          Text(timeLabel, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          // More than one session today (split shifts) — say so, otherwise the
          // total looks like a single continuous shift.
          if (sessionCount > 1) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$sessionCount sessions today',
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600, color: statusColor),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _format(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  String _formatMins(int mins) {
    final h = mins ~/ 60;
    final m = mins % 60;
    return '${h}h ${m.toString().padLeft(2, '0')}m';
  }
}

// ============================================================
// Action button — large full-width
// ============================================================
class _ActionButton extends StatelessWidget {
  final String text;
  final Color color;
  final IconData icon;
  final VoidCallback onPressed;

  const _ActionButton({required this.text, required this.color, required this.icon, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 24),
        label: Text(text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1)),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }
}

// ============================================================
// Today's Details section
// ============================================================
class _DetailsSection extends StatelessWidget {
  final String checkIn;
  final String checkOut;
  final String workingHours;

  const _DetailsSection({required this.checkIn, required this.checkOut, required this.workingHours});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("Today's Details", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
        const SizedBox(height: 12),
        Card(
          child: Column(
            children: [
              _DetailRow(icon: Icons.radio_button_checked, iconColor: AppColors.success, label: 'Check-In', value: checkIn),
              const Divider(height: 1, indent: 56),
              _DetailRow(icon: Icons.radio_button_checked, iconColor: AppColors.danger, label: 'Check-Out', value: checkOut),
              const Divider(height: 1, indent: 56),
              _DetailRow(icon: Icons.access_time, iconColor: AppColors.primary, label: 'Working Hours', value: workingHours),
            ],
          ),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;

  const _DetailRow({required this.icon, required this.iconColor, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Icon(icon, color: iconColor, size: 20),
          const SizedBox(width: 16),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 14, color: AppColors.textPrimary))),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}

// ============================================================
// Verification section — photo, GPS, device, time
// ============================================================
class _VerificationSection extends StatelessWidget {
  final bool isNotStarted;
  final bool isWorking;
  final bool hasCheckInPhoto;
  final bool insideGeofence;
  final String checkInTime;

  const _VerificationSection({
    required this.isNotStarted,
    required this.isWorking,
    required this.hasCheckInPhoto,
    required this.insideGeofence,
    required this.checkInTime,
  });

  /// True once a check-in has been recorded for the session.
  bool get _hasCheckIn => isWorking || !isNotStarted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Verification', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
        const SizedBox(height: 4),
        Text(
          _hasCheckIn ? 'Captured at check-in' : 'Captured when you check in',
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 12),
        Card(
          child: Column(
            children: [
              _VerifyRow(
                icon: Icons.camera_alt_outlined,
                label: 'Photo',
                status: !_hasCheckIn
                    ? 'Pending'
                    : hasCheckInPhoto
                        ? 'Captured'
                        : 'Missing',
                isVerified: hasCheckInPhoto,
                isError: _hasCheckIn && !hasCheckInPhoto,
              ),
              const Divider(height: 1, indent: 56),
              _VerifyRow(
                icon: Icons.location_on_outlined,
                label: 'GPS Location',
                status: !_hasCheckIn
                    ? 'Pending'
                    : insideGeofence
                        ? 'In range'
                        : 'Out of range',
                isVerified: _hasCheckIn && insideGeofence,
                isError: _hasCheckIn && !insideGeofence,
              ),
              const Divider(height: 1, indent: 56),
              _VerifyRow(
                icon: Icons.phone_android_outlined,
                label: 'Device Info',
                status: _hasCheckIn ? 'Captured' : 'Pending',
                isVerified: _hasCheckIn,
              ),
              const Divider(height: 1, indent: 56),
              _VerifyRow(
                icon: Icons.access_time,
                label: 'Capture Time',
                status: _hasCheckIn ? checkInTime : 'Pending',
                isVerified: _hasCheckIn,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _VerifyRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String status;
  final bool isVerified;
  final bool isError;

  const _VerifyRow({
    required this.icon,
    required this.label,
    required this.status,
    required this.isVerified,
    this.isError = false,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = isVerified
        ? AppColors.success
        : isError
            ? AppColors.danger
            : AppColors.textMuted;
    final statusBg = isVerified
        ? AppColors.successSoft
        : isError
            ? AppColors.dangerSoft
            : const Color(0xFFF1F5F9);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(icon, color: AppColors.textSecondary, size: 20),
          const SizedBox(width: 16),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 14, color: AppColors.textPrimary))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(12)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (isVerified || isError)
                  Icon(isError ? Icons.priority_high : Icons.check,
                      size: 12, color: statusColor),
                if (isVerified || isError) const SizedBox(width: 4),
                Text(status, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// Geofence indicator
// ============================================================
class _GeofenceIndicator extends StatelessWidget {
  final bool insideGeofence;

  const _GeofenceIndicator({required this.insideGeofence});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: insideGeofence ? AppColors.successSoft : AppColors.dangerSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: insideGeofence ? AppColors.success.withOpacity(0.3) : AppColors.danger.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.location_on, color: insideGeofence ? AppColors.success : AppColors.danger, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  insideGeofence ? 'Inside Project Area' : 'Outside Project Area',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: insideGeofence ? AppColors.success : AppColors.danger),
                ),
                Text(
                  insideGeofence ? 'You are within the allowed geofence radius' : 'Please move to the project area',
                  style: TextStyle(fontSize: 11, color: insideGeofence ? AppColors.success : AppColors.danger),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
