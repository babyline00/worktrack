// Attendance detail screen — photos, GPS, times, status, working time.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../models/attendance.dart';
import '../providers/attendance_provider.dart';
import '../widgets/loading_overlay.dart';
import '../widgets/status_card.dart';

class AttendanceDetailScreen extends StatefulWidget {
  final AttendanceHistoryItem historyItem;
  const AttendanceDetailScreen({super.key, required this.historyItem});

  @override
  State<AttendanceDetailScreen> createState() =>
      _AttendanceDetailScreenState();
}

class _AttendanceDetailScreenState extends State<AttendanceDetailScreen> {
  AttendanceDetail? _detail;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final att = context.read<AttendanceProvider>();
    final d = await att.fetchDetail(widget.historyItem.id);
    if (!mounted) return;
    setState(() {
      _detail = d ?? AttendanceDetail.fromHistory(widget.historyItem);
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final h = widget.historyItem;
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance detail')),
      body: _loading
          ? const InlineLoading(message: 'Loading detail…')
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.xxxl),
              children: [
                // Date + status hero
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFF0F172A),
                        Color(0xFF1D4ED8),
                        Color(0xFF2563EB)
                      ],
                    ),
                    borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _detail?.formattedDate ?? h.formattedDate,
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.7),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              h.project,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          StatusBadge.fromStatus(h.attendanceStatus.isEmpty
                              ? h.sessionStatus
                              : h.attendanceStatus),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        children: [
                          Expanded(
                            child: _HeroStat(
                              label: 'Check-in',
                              value: _detail?.checkInTime ?? h.checkIn ?? '—',
                              icon: Icons.login,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: _HeroStat(
                              label: 'Check-out',
                              value:
                                  _detail?.checkOutTime ?? h.checkOut ?? '—',
                              icon: Icons.logout,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: _HeroStat(
                              label: 'Worked',
                              value: _detail?.workingTimeText ??
                                  (h.workingTime.isEmpty ? '—' : h.workingTime),
                              icon: Icons.timer,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                if (h.lateMinutes > 0 ||
                    (_detail?.lateMinutes ?? 0) > 0)
                  _InfoTile(
                    icon: Icons.access_time,
                    title: 'Late by',
                    value:
                        '${h.lateMinutes > 0 ? h.lateMinutes : _detail?.lateMinutes} min',
                    valueColor: AppColors.warning,
                  ),
                if (h.lateMinutes > 0 || (_detail?.lateMinutes ?? 0) > 0)
                  const SizedBox(height: AppSpacing.sm),
                _InfoTile(
                  icon: Icons.verified_user_outlined,
                  title: 'Verification',
                  value: (_detail?.verificationStatus ??
                          h.verificationStatus)
                      .replaceAll('_', ' ')
                      .toLowerCase(),
                  valueColor: _verificationColor(
                      _detail?.verificationStatus ?? h.verificationStatus),
                ),
                const SizedBox(height: AppSpacing.sm),
                _InfoTile(
                  icon: Icons.location_on,
                  title: 'Geofence',
                  value: (_detail?.insideGeofence ?? true)
                      ? 'Inside zone'
                      : 'Outside zone',
                  valueColor: (_detail?.insideGeofence ?? true)
                      ? AppColors.success
                      : AppColors.danger,
                ),
                if (_detail?.lastLocation != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  _InfoTile(
                    icon: Icons.gps_fixed,
                    title: 'Last GPS',
                    value:
                        '${_detail!.lastLocation!.latitude.toStringAsFixed(5)}, '
                        '${_detail!.lastLocation!.longitude.toStringAsFixed(5)}',
                    subtitle:
                        '±${_detail!.lastLocation!.accuracy.toStringAsFixed(0)}m',
                  ),
                ],
                const SizedBox(height: AppSpacing.xl),
                // Photos
                const _SectionTitle('Photos'),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: _PhotoTile(
                        label: 'Check-in',
                        photoUrl: _detail?.checkInPhoto,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _PhotoTile(
                        label: 'Check-out',
                        photoUrl: _detail?.checkOutPhoto,
                      ),
                    ),
                  ],
                ),
              ],
            ),
    );
  }

  Color _verificationColor(String? status) {
    if (status == null) return AppColors.textSecondary;
    final s = status.toUpperCase();
    if (s == 'VERIFIED') return AppColors.success;
    if (s == 'REJECTED') return AppColors.danger;
    return AppColors.warning;
  }
}

class _HeroStat extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  const _HeroStat({
    required this.label,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: Colors.white.withOpacity(0.7), size: 18),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withOpacity(0.6),
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;
  final String? subtitle;
  final Color? valueColor;
  const _InfoTile({
    required this.icon,
    required this.title,
    required this.value,
    this.subtitle,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    color: valueColor ?? AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: AppColors.textPrimary,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _PhotoTile extends StatelessWidget {
  final String label;
  final String? photoUrl;
  const _PhotoTile({required this.label, required this.photoUrl});

  @override
  Widget build(BuildContext context) {
    final url = resolvePhotoUrl(photoUrl);
    return Container(
      height: 160,
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
            child: url.isEmpty
                ? Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.image_outlined,
                          color: AppColors.textMuted, size: 32),
                      SizedBox(height: 6),
                      Text(
                        'No photo',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  )
                : Image.network(
                    url,
                    fit: BoxFit.cover,
                    // Photos are company-scoped rather than public.
                    headers: ApiClient.instance.authImageHeaders,
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.broken_image_outlined,
                      color: AppColors.textMuted,
                      size: 32,
                    ),
                  ),
          ),
          Positioned(
            top: 8,
            left: 8,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.5),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
