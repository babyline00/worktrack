// Notifications screen — driven by NotificationProvider.
//
// This screen was previously unreachable (no route pushed it), called
// POST /notifications/read-all against a PATCH-only route inside a swallowed
// catch, and called setState after dispose on every load.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/constants.dart';
import '../models/notification.dart';
import '../providers/notification_provider.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    // The provider owns the list, so loading is idempotent and cheap on a
    // revisit.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<NotificationProvider>().load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final notifs = context.watch<NotificationProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (notifs.hasUnread)
            TextButton(
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                final error = await notifs.markAllRead();
                if (error == null) return;
                messenger.showSnackBar(SnackBar(content: Text(error)));
              },
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: _body(context, notifs),
    );
  }

  Widget _body(BuildContext context, NotificationProvider notifs) {
    if (notifs.loading && notifs.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (notifs.error != null && notifs.items.isEmpty) {
      return _ErrorView(
        message: notifs.error!,
        onRetry: () => notifs.load(),
      );
    }

    if (notifs.items.isEmpty) {
      return const _EmptyView();
    }

    // RefreshIndicator rather than pull_to_refresh: the provider does not model
    // pages, so the earlier per-page counter had nothing to drive.
    return RefreshIndicator(
      onRefresh: () => notifs.load(),
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        itemCount: notifs.items.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final n = notifs.items[i];
          return _NotificationTile(
            notification: n,
            onTap: n.unread ? () => notifs.markRead(n.id) : null,
          );
        },
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final AppNotification notification;
  final VoidCallback? onTap;

  const _NotificationTile({required this.notification, this.onTap});

  static const _icons = {
    'attendance': Icons.schedule,
    'leave': Icons.beach_access,
    'alert': Icons.warning_amber_rounded,
    'system': Icons.info_outline,
  };

  static const _colors = {
    'attendance': AppColors.primary,
    'leave': AppColors.success,
    'alert': AppColors.danger,
    'system': AppColors.textSecondary,
  };

  @override
  Widget build(BuildContext context) {
    final type = notification.type.toLowerCase();
    final unread = notification.unread;
    final icon = _icons[type] ?? _icons['system'];
    // Declared nullable so the lookup's null is part of the type rather than
    // needing a second fallback.
    final Color? color = _colors[type];

    return ListTile(
      onTap: onTap,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 4),
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: (color ?? AppColors.primary).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 20, color: color ?? AppColors.textSecondary),
      ),
      title: Text(
        notification.title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
        ),
      ),
      subtitle: notification.description == null
          ? null
          : Text(
              notification.description!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (unread)
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(bottom: 6),
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
            ),
          Text(
            notification.relativeTime,
            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.notifications_none, size: 56, color: AppColors.textMuted),
          SizedBox(height: 12),
          Text('No notifications',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          SizedBox(height: 4),
          Text('You are all caught up.',
              style: TextStyle(color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off, size: 48, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
