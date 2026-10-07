// Working session screen — live timer + check-out button
import 'dart:async';
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../providers/attendance_provider.dart';
import 'check_out_camera_screen.dart';
import 'home_screen.dart';

class WorkingSessionScreen extends StatefulWidget {
  final String attendanceId;

  const WorkingSessionScreen({super.key, required this.attendanceId});

  @override
  State<WorkingSessionScreen> createState() => _WorkingSessionScreenState();
}

class _WorkingSessionScreenState extends State<WorkingSessionScreen> {
  Timer? _timer;
  Timer? _locationTimer;
  int _elapsedSeconds = 0;

  @override
  void initState() {
    super.initState();
    final att = context.read<AttendanceProvider>().todayAttendance;
    if (att?.checkInAt != null) {
      final checkIn = DateTime.tryParse(att!.checkInAt!) ?? DateTime.now();
      _elapsedSeconds = DateTime.now().difference(checkIn).inSeconds;
    }
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => _elapsedSeconds++));
    // Send location updates every 2 minutes
    _locationTimer = Timer.periodic(const Duration(minutes: 2), (_) {
      context.read<AttendanceProvider>().sendLocationUpdate(widget.attendanceId);
    });
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
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padStart(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final att = context.watch<AttendanceProvider>().todayAttendance;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Working Session'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Pulsing dot
              Container(
                width: 12, height: 12,
                decoration: BoxDecoration(color: AppColors.success, shape: BoxShape.circle, boxShadow: [BoxShadow(color: AppColors.success.withOpacity(0.4), blurRadius: 12, spreadRadius: 4)]),
              ),
              const SizedBox(height: 16),
              const Text('WORKING', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.success, letterSpacing: 2)),
              const SizedBox(height: 24),
              // Timer
              Text(_formatDuration(_elapsedSeconds), style: const TextStyle(fontSize: 56, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
              const SizedBox(height: 32),
              // Info cards
              _InfoRow(label: 'Project', value: att?.projectName ?? '—'),
              _InfoRow(label: 'Check-In', value: att?.checkIn?.substring(11, 19) ?? '—'),
              _InfoRow(label: 'Geofence', value: (att?.insideGeofence ?? true) ? '✓ Inside' : '✗ Outside', color: (att?.insideGeofence ?? true) ? AppColors.success : AppColors.danger),
              const SizedBox(height: 40),
              // Check out button
              ElevatedButton.icon(
                onPressed: () async {
                  await Navigator.push(context, MaterialPageRoute(
                    builder: (_) => CheckOutCameraScreen(attendanceId: widget.attendanceId),
                  ));
                  if (context.read<AttendanceProvider>().todayAttendance?.sessionStatus == 'COMPLETED') {
                    if (mounted) Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const HomeScreen()), (r) => false);
                  }
                },
                icon: const Icon(Icons.logout),
                label: const Text('CHECK OUT'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.danger,
                  minimumSize: const Size(double.infinity, 56),
                  textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;

  const _InfoRow({required this.label, required this.value, this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
          Text(value, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: color ?? AppColors.textPrimary)),
        ],
      ),
    );
  }
}
