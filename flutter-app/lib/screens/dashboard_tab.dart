// Dashboard tab — today's status, check-in/out, quick stats, recent attendance
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../models/models.dart';
import '../providers/attendance_provider.dart';
import '../providers/auth_provider.dart';
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
      _elapsedSeconds = DateTime.now().difference(checkIn).inSeconds;
      _timer = Timer.periodic(const Duration(seconds: 1), (t) {
        setState(() => _elapsedSeconds++);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _formatDuration(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final att = context.watch<AttendanceProvider>();
    final auth = context.watch<AuthProvider>();
    final dashboard = att.dashboard;
    final today = att.todayAttendance;
    final isWorking = today != null && today.sessionStatus == 'WORKING';
    final isCheckedOut = today != null && today.sessionStatus == 'COMPLETED';

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(dashboard?.employeeName ?? 'Hello', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(_formatDate(DateTime.now()), style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => Navigator.pushNamed(context, '/notifications'),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => att.loadDashboard(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => att.loadDashboard(),
        child: att.isLoading && dashboard == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Status card
                _StatusCard(
                  isWorking: isWorking,
                  isCheckedOut: isCheckedOut,
                  projectName: today?.projectName,
                  checkInTime: today?.checkIn,
                  checkOutTime: today?.checkOut,
                  workingMinutes: today?.workingMinutes ?? 0,
                  elapsedSeconds: _elapsedSeconds,
                  insideGeofence: today?.insideGeofence ?? true,
                ),
                const SizedBox(height: 16),

                // Action button
                if (!isWorking && !isCheckedOut)
                  ElevatedButton.icon(
                    onPressed: att.dashboard!.projects.isNotEmpty
                      ? () => Navigator.push(context, MaterialPageRoute(
                          builder: (_) => ProjectSelectionScreen(projects: att.dashboard!.projects),
                        ))
                      : null,
                    icon: const Icon(Icons.login),
                    label: const Text('CHECK IN'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success,
                      minimumSize: const Size(double.infinity, 56),
                      textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  )
                else if (isWorking)
                  ElevatedButton.icon(
                    onPressed: () {
                      if (today?.attendanceId != null) {
                        Navigator.push(context, MaterialPageRoute(
                          builder: (_) => WorkingSessionScreen(attendanceId: today!.attendanceId!),
                        ));
                      }
                    },
                    icon: const Icon(Icons.logout),
                    label: const Text('CHECK OUT'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.danger,
                      minimumSize: const Size(double.infinity, 56),
                      textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  )
                else if (isCheckedOut)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.successSoft,
                      borderRadius: BorderRadius.circular(12),
                    ),
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

                // Quick stats
                Row(
                  children: [
                    _StatCard(label: 'This Month', value: '22', subtitle: 'Present', color: AppColors.success),
                    const SizedBox(width: 12),
                    _StatCard(label: 'Late', value: '3', subtitle: 'Times', color: AppColors.warning),
                    const SizedBox(width: 12),
                    _StatCard(label: 'Rate', value: '92%', subtitle: 'Attendance', color: AppColors.info),
                  ],
                ),
                const SizedBox(height: 24),

                // Assigned project
                if (dashboard!.projects.isNotEmpty) ...[
                  const Text('Assigned Project', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  ...dashboard.projects.map((p) => _ProjectCard(project: p)),
                ],

                const SizedBox(height: 24),

                // Recent attendance
                if (dashboard.recentAttendance.isNotEmpty) ...[
                  const Text('Recent Attendance', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  ...dashboard.recentAttendance.map((a) => _RecentAttendanceCard(item: a)),
                ],
              ],
            ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return '${days[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}

class _StatusCard extends StatelessWidget {
  final bool isWorking;
  final bool isCheckedOut;
  final String? projectName;
  final String? checkInTime;
  final String? checkOutTime;
  final int workingMinutes;
  final int elapsedSeconds;
  final bool insideGeofence;

  const _StatusCard({
    required this.isWorking,
    required this.isCheckedOut,
    this.projectName,
    this.checkInTime,
    this.checkOutTime,
    required this.workingMinutes,
    required this.elapsedSeconds,
    required this.insideGeofence,
  });

  @override
  Widget build(BuildContext context) {
    final status = isWorking ? 'WORKING' : isCheckedOut ? 'COMPLETED' : 'NOT CHECKED IN';
    final statusColor = isWorking ? AppColors.success : isCheckedOut ? AppColors.textSecondary : AppColors.warning;
    final statusBg = isWorking ? AppColors.successSoft : isCheckedOut ? Color(0xFFF1F5F9) : AppColors.warningSoft;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (isWorking)
                  Container(
                    width: 10, height: 10,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(color: AppColors.success, shape: BoxShape.circle),
                  ),
                Text(status, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: statusColor, letterSpacing: 1)),
              ],
            ),
            const SizedBox(height: 12),
            if (isWorking)
              Text(_formatElapsed(elapsedSeconds), style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: AppColors.textPrimary))
            else if (isCheckedOut)
              Text('${(workingMinutes / 60).toStringAsFixed(1)}h', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: AppColors.textPrimary))
            else
              const Text('0h 00m', style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
            const SizedBox(height: 12),
            if (projectName != null)
              Text(projectName!, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _TimeInfo(label: 'Check In', time: checkInTime ?? '—'),
                Container(width: 1, height: 30, color: AppColors.border),
                _TimeInfo(label: 'Check Out', time: checkOutTime ?? '—'),
                Container(width: 1, height: 30, color: AppColors.border),
                _TimeInfo(label: 'Geofence', time: insideGeofence ? 'Inside' : 'Outside', color: insideGeofence ? AppColors.success : AppColors.danger),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatElapsed(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padStart(2, '0')}';
  }
}

class _TimeInfo extends StatelessWidget {
  final String label;
  final String time;
  final Color? color;

  const _TimeInfo({required this.label, required this.time, this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        const SizedBox(height: 4),
        Text(time, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: color ?? AppColors.textPrimary)),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final String subtitle;
  final Color color;

  const _StatCard({required this.label, required this.value, required this.subtitle, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
              const SizedBox(height: 4),
              Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
              Text(subtitle, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProjectCard extends StatelessWidget {
  final Project project;

  const _ProjectCard({required this.project});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
          child: const Icon(Icons.location_on, color: AppColors.primary, size: 20),
        ),
        title: Text(project.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text('${project.code} • ${project.location ?? "—"}', style: const TextStyle(fontSize: 12)),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: AppColors.successSoft, borderRadius: BorderRadius.circular(12)),
          child: Text(project.status, style: const TextStyle(fontSize: 10, color: AppColors.success, fontWeight: FontWeight.w600)),
        ),
      ),
    );
  }
}

class _RecentAttendanceCard extends StatelessWidget {
  final AttendanceHistoryItem item;

  const _RecentAttendanceCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const CircleAvatar(backgroundColor: AppColors.primary, child: Icon(Icons.access_time, color: Colors.white, size: 18)),
        title: Text(item.date, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text('${item.project} • ${item.checkIn ?? "—"} → ${item.checkOut ?? "—"}', style: const TextStyle(fontSize: 12)),
        trailing: Text('${(item.workingMinutes / 60).toStringAsFixed(1)}h', style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
      ),
    );
  }
}
