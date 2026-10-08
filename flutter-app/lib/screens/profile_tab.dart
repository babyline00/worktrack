// Profile tab — employee info, edit, logout
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../providers/auth_provider.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Avatar + name
          Center(child: Column(children: [
            CircleAvatar(
              radius: 48,
              backgroundColor: _parseColor(user?.avatarColor),
              child: Text(_initials(user?.name ?? ''), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
            ),
            const SizedBox(height: 12),
            Text(user?.name ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            Text(user?.email ?? '', style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
            const SizedBox(height: 8),
            Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
              child: Text(user?.role ?? 'EMPLOYEE', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary))),
          ])),
          const SizedBox(height: 24),

          // Info cards
          Card(child: ListTile(leading: const Icon(Icons.badge_outlined, color: AppColors.primary), title: const Text('Employee ID', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)), trailing: Text(user?.employeeId ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)))),
          Card(child: ListTile(leading: const Icon(Icons.email_outlined, color: AppColors.primary), title: const Text('Email', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)), trailing: Text(user?.email ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)))),
          Card(child: ListTile(leading: const Icon(Icons.business_outlined, color: AppColors.primary), title: const Text('Company', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)), trailing: Text('WorkTrack LLC', style: const TextStyle(fontWeight: FontWeight.w600)))),

          const SizedBox(height: 24),

          // Settings
          Card(child: ListTile(leading: const Icon(Icons.notifications_outlined, color: AppColors.textSecondary), title: const Text('Notifications'), trailing: const Icon(Icons.chevron_right), onTap: () {})),
          Card(child: ListTile(leading: const Icon(Icons.security_outlined, color: AppColors.textSecondary), title: const Text('Privacy & Security'), trailing: const Icon(Icons.chevron_right), onTap: () {})),
          Card(child: ListTile(leading: const Icon(Icons.help_outline, color: AppColors.textSecondary), title: const Text('Help & Support'), trailing: const Icon(Icons.chevron_right), onTap: () {})),
          Card(child: ListTile(leading: const Icon(Icons.info_outline, color: AppColors.textSecondary), title: const Text('About'), trailing: const Icon(Icons.chevron_right), onTap: () => showAboutDialog(context: context, applicationName: 'WorkTrack', applicationVersion: '1.0.0'))),

          const SizedBox(height: 24),

          // Logout
          ElevatedButton.icon(
            onPressed: () async {
              await auth.logout();
              // The splash screen owns the auth-driven routing, so popping back
              // to the root is enough — it will render the login screen itself.
              if (context.mounted) {
                Navigator.of(context).popUntil((r) => r.isFirst);
              }
            },
            icon: const Icon(Icons.logout),
            label: const Text('Sign Out'),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger, minimumSize: const Size(double.infinity, 48)),
          ),
          const SizedBox(height: 16),
          const Center(child: Text('WorkTrack v1.0.0', style: TextStyle(color: AppColors.textMuted, fontSize: 12))),
        ],
      ),
    );
  }

  Color _parseColor(String? hex) {
    if (hex == null) return AppColors.primary;
    try { return Color(int.parse(hex.replaceAll('#', '0xFF'))); } catch (_) { return AppColors.primary; }
  }

  String _initials(String name) {
    final parts = name.split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}
