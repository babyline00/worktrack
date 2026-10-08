// Privacy & Security — what the app collects, and the controls for it.
//
// Reachable from Profile. The row that pointed here had `onTap: () {}`.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/constants.dart';
import '../core/secure_storage.dart';
import '../providers/auth_provider.dart';
import '../providers/attendance_provider.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final att = context.watch<AttendanceProvider>();
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Privacy & Security')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          const _Section('Your session'),
          Card(
            child: Column(
              children: [
                _Row(
                  label: 'Signed in as',
                  value: user?.email ?? '—',
                ),
                _Row(label: 'Role', value: user?.role ?? '—'),
                _Row(label: 'Company', value: user?.companyName ?? '—'),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          const _Section('Location access'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'WorkTrack records a position only while you have an open '
                    'shift, so your attendance can be verified against the '
                    'project you are working at. Positions are visible to your '
                    'administrator while the session is open.',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _Row(
                    label: 'Current status',
                    value: att.isTracking ? 'Tracking live' : 'Not tracking',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  OutlinedButton.icon(
                    onPressed: () => _confirmClearData(context, auth),
                    icon: const Icon(Icons.logout, size: 18),
                    label: const Text('Sign out on this device'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      minimumSize: const Size(double.infinity, 44),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          const _Section('Stored on this device'),
          Card(
            child: Column(
              children: [
                _Row(label: 'Auth tokens', value: 'Android Keystore'),
                _Row(
                  label: 'Attendance photos',
                  value: 'Uploaded, never cached locally',
                ),
                _Row(label: 'Session history', value: 'Held in memory only'),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          const Center(
            child: Text(
              'WorkTrack v1.0.0',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmClearData(
      BuildContext context, AuthProvider auth) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text(
          'Your saved session will be removed from this device. You will need '
          'to sign in again.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style:
                ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await auth.logout();
    // Belt and braces: make sure no token outlives the session even if a future
    // logout path skips a key.
    await SecureStorage.clearAll();
    if (!context.mounted) return;
    Navigator.of(context).popUntil((r) => r.isFirst);
  }
}

class _Section extends StatelessWidget {
  final String title;

  const _Section(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: AppSpacing.sm),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;

  const _Row({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style:
                  const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}