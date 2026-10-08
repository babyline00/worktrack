// Working session screen — live timer + check-out button
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../core/geofence.dart';
import '../providers/attendance_provider.dart';
import 'check_out_camera_screen.dart';

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

  /// Guards the auto check-out so it is only ever offered once per breach.
  bool _autoCheckoutHandled = false;

  @override
  void initState() {
    super.initState();
    final provider = context.read<AttendanceProvider>();
    final att = provider.todayAttendance;
    if (att?.checkInAt != null) {
      final checkIn = DateTime.tryParse(att!.checkInAt!) ?? DateTime.now();
      // Clamp at zero: a server timestamp a few seconds ahead (clock skew, or
      // a record seeded in the future) would otherwise render a negative timer.
      _elapsedSeconds =
          DateTime.now().difference(checkIn).inSeconds.clamp(0, 1 << 31);
    }

    // Measure live positions against the site this session was checked into.
    provider.configureGeofence(
      latitude: att?.projectLatitude,
      longitude: att?.projectLongitude,
      radiusMeters: att?.projectRadiusMeters,
    );

    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _elapsedSeconds++);
    });

    // Prime the location cache immediately, then keep it warm on an interval so
    // the tracker reads a fresh fix instead of waiting 2 minutes for the first
    // one (and so the UI has something to display right away).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<AttendanceProvider>();
      provider.refreshLocation().then((loc) {
        if (loc != null) provider.sendLocationUpdate(widget.attendanceId);
      });
      _locationTimer = Timer.periodic(const Duration(minutes: 1), (_) {
        if (!mounted) return;
        provider.refreshLocation().then((loc) {
          if (loc != null) provider.sendLocationUpdate(widget.attendanceId);
        });
        _maybeAutoCheckOut(provider);
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _locationTimer?.cancel();
    super.dispose();
  }

  /// Offers an automatic check-out once the employee has been clear of the site
  /// for the full grace period.
  ///
  /// The server requires a photo on check-out, so this cannot finalise the
  /// shift silently — it routes to the selfie screen with the reason attached,
  /// which is the same capture the manual button performs.
  void _maybeAutoCheckOut(AttendanceProvider provider) {
    if (_autoCheckoutHandled || !provider.shouldAutoCheckOut) return;
    if (provider.todayAttendance?.sessionStatus != 'WORKING') return;

    _autoCheckoutHandled = true;
    provider.acknowledgeGeofence();
    _promptAutoCheckOut(provider);
  }

  Future<void> _promptAutoCheckOut(AttendanceProvider provider) async {
    if (!mounted) return;
    final distance = provider.distanceFromProject;

    final proceed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.location_off, color: AppColors.danger, size: 32),
        title: const Text('Outside project area'),
        content: Text(
          'You have been outside the project radius for more than '
          '${GeofenceWatch.gracePeriod.inMinutes} minutes'
          '${distance == null ? '' : ' (${distance.toStringAsFixed(0)}m away)'}.\n\n'
          'Your session needs to be checked out.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Not now'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Check out'),
          ),
        ],
      ),
    );

    if (proceed != true || !mounted) return;

    final att = provider.todayAttendance;
    final checkedOut = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CheckOutCameraScreen(
          attendanceId: widget.attendanceId,
          projectLatitude: att?.projectLatitude,
          projectLongitude: att?.projectLongitude,
          projectRadiusMeters: att?.projectRadiusMeters,
          // The employee is outside by definition here, so the geofence
          // pre-check must not block the capture that closes the session. The
          // server still records the true coordinates and outside status.
          skipGeofenceCheck: true,
          reason: 'Auto check-out — outside project area',
        ),
      ),
    );

    if (!mounted) return;
    if (checkedOut == true ||
        context.read<AttendanceProvider>().todayAttendance?.sessionStatus ==
            'COMPLETED') {
      provider.clearGeofence();
      Navigator.of(context).popUntil((r) => r.isFirst);
    } else {
      // The employee chose to stay — restart the breach clock so the prompt
      // does not immediately reappear for the same spell outside.
      provider.acknowledgeGeofence();
      _autoCheckoutHandled = false;
    }
  }

  String _formatDuration(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AttendanceProvider>();
    final att = provider.todayAttendance;

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
              _InfoRow(
                  label: 'Check-In',
                  value: att?.checkInTime ??
                      (att?.checkInAt == null
                          ? '—'
                          : DateTime.parse(att!.checkInAt!)
                              .toLocal()
                              .toString()
                              .substring(11, 16)),
                ),
              _GeofenceRow(
                provider: provider,
                radiusMeters: att?.projectRadiusMeters,
              ),
              const SizedBox(height: 12),
              LiveLocationTile(attendanceId: widget.attendanceId),
              const SizedBox(height: 40),
              // Check out button
              ElevatedButton.icon(
                onPressed: context.watch<AttendanceProvider>().isCheckingOut
                    ? null
                    : () async {
                        final checkedOut = await Navigator.push<bool>(
                          context,
                          MaterialPageRoute(
                            builder: (_) => CheckOutCameraScreen(
                              attendanceId: widget.attendanceId,
                              projectLatitude: att?.projectLatitude,
                              projectLongitude: att?.projectLongitude,
                              projectRadiusMeters: att?.projectRadiusMeters,
                            ),
                          ),
                        );
                        if (!mounted) return;
                        // Unwind straight to the dashboard: the session is
                        // over and this timer would keep counting.
                        if (checkedOut == true ||
                            context
                                    .read<AttendanceProvider>()
                                    .todayAttendance
                                    ?.sessionStatus ==
                                'COMPLETED') {
                          Navigator.of(context).popUntil((r) => r.isFirst);
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

/// Live GPS readout for the active session.
///
/// Shows the cached device fix, refreshes on demand, and pushes each new fix
/// to the server so the tracking dashboard stays current.
class LiveLocationTile extends StatelessWidget {
  final String? attendanceId;

  const LiveLocationTile({super.key, this.attendanceId});

  @override
  Widget build(BuildContext context) {
    final att = context.watch<AttendanceProvider>();
    final pos = att.currentPosition;
    final error = att.locationError;

    final (lat, lng) = pos == null
        ? ('—', '—')
        : (pos.latitude.toStringAsFixed(5), pos.longitude.toStringAsFixed(5));

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  pos != null ? Icons.my_location : Icons.location_off_outlined,
                  size: 20,
                  color: pos != null ? AppColors.success : AppColors.textMuted,
                ),
                const SizedBox(width: AppSpacing.sm),
                const Expanded(
                  child: Text(
                    'Live Location',
                    style: TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
                if (att.isLocating)
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    tooltip: 'Refresh location',
                    icon: const Icon(Icons.refresh, size: 20),
                    onPressed: () async {
                      final loc = await att.refreshLocation();
                      if (loc != null && attendanceId != null) {
                        await att.sendLocationUpdate(attendanceId!);
                      }
                    },
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            _kv('Latitude', lat),
            _kv('Longitude', lng),
            _kv(
              'Accuracy',
              pos == null ? '—' : '±${pos.accuracy.toStringAsFixed(0)} m',
            ),
            if (pos != null) ...[
              const SizedBox(height: 4),
              Text(
                'Updated ${_ago(pos.timestamp)}',
                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
              ),
            ],
            if (pos == null && error != null) ...[
              const SizedBox(height: 4),
              Text(
                error,
                style: const TextStyle(fontSize: 11, color: AppColors.danger),
              ),
              // A permanently denied permission cannot be re-prompted, so offer
              // a route into the OS settings rather than leaving the user stuck.
              if (att.needsLocationSettings) ...[
                const SizedBox(height: 4),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(0, 28),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      foregroundColor: AppColors.primary,
                    ),
                    icon: const Icon(Icons.settings, size: 16),
                    label: const Text('Open location settings',
                        style: TextStyle(fontSize: 12)),
                    onPressed: att.openLocationSettings,
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary)),
            Text(v,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600)),
          ],
        ),
      );

  String _ago(DateTime t) {
    final s = DateTime.now().difference(t).inSeconds;
    if (s < 60) return '${s}s ago';
    if (s < 3600) return '${s ~/ 60}m ago';
    return '${s ~/ 3600}h ago';
  }
}

/// Live geofence status for the running session.
///
/// Reads the provider's current verdict rather than the value captured at
/// check-in, so leaving the site flips the badge immediately and surfaces how
/// far away the employee is.
class _GeofenceRow extends StatelessWidget {
  final AttendanceProvider provider;
  final double? radiusMeters;

  const _GeofenceRow({required this.provider, this.radiusMeters});

  @override
  Widget build(BuildContext context) {
    final inside = provider.isInsideGeofence;
    final distance = provider.distanceFromProject;
    final outsideFor = provider.outsideDuration;

    // Before the first fix there is genuinely nothing to report.
    if (inside == null) {
      return const _InfoRow(label: 'Geofence', value: 'Locating…');
    }

    final value = StringBuffer(inside ? '✓ Inside' : '✗ Outside');
    if (distance != null) {
      value.write(' · ${distance.toStringAsFixed(0)}m');
    }
    if (!inside && outsideFor.inSeconds > 0) {
      value.write(' · ${outsideFor.inMinutes}m');
    }

    return _InfoRow(
      label: 'Geofence',
      value: value.toString(),
      color: inside ? AppColors.success : AppColors.danger,
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
