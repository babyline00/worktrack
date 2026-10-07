// Notifications screen — paginated list of notifications with type icons.
import 'package:flutter/material.dart';
import 'package:pull_to_refresh/pull_to_refresh.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../models/notification.dart';
import '../widgets/loading_overlay.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final RefreshController _rc = RefreshController();
  List<AppNotification> _items = [];
  int _page = 1;
  int _pages = 1;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load(refresh: true);
  }

  @override
  void dispose() {
    _rc.dispose();
    super.dispose();
  }

  Future<void> _load({bool refresh = false, int page = 1}) async {
    if (refresh) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final data = await ApiClient.instance.get(
        '/mobile/notifications',
        query: {'page': page, 'limit': 20},
      );
      final items = ((data['data'] as List?) ?? [])
          .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
          .toList();
      final pagination =
          (data['pagination'] as Map<String, dynamic>?) ?? const {};
      setState(() {
        if (refresh || page == 1) {
          _items = items;
        } else {
          _items = [..._items, ...items];
        }
        _page = (pagination['page'] as num?)?.toInt() ?? page;
        _pages = (pagination['pages'] as num?)?.toInt() ?? 1;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Failed to load notifications';
        _loading = false;
      });
    }
  }

  Future<void> _onRefresh() async {
    await _load(refresh: true);
    _rc.refreshCompleted();
  }

  Future<void> _onLoading() async {
    if (_page < _pages) {
      await _load(page: _page + 1);
      _rc.loadComplete();
    } else {
      _rc.loadNoData();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (_items.any((n) => n.unread))
            TextButton(
              onPressed: () async {
                // Best-effort — fire and forget.
                try {
                  await ApiClient.instance.post('/notifications/read-all');
                } catch (_) {}
                if (!mounted) return;
                setState(() {
                  _items = _items
                      .map((n) => AppNotification(
                            id: n.id,
                            type: n.type,
                            title: n.title,
                            description: n.description,
                            timeAgo: n.timeAgo,
                            createdAt: n.createdAt,
                            unread: false,
                          ))
                      .toList();
                });
              },
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: SmartRefresher(
        controller: _rc,
        enablePullDown: true,
        enablePullUp: _page < _pages,
        onRefresh: _onRefresh,
        onLoading: _onLoading,
        header: const WaterDropHeader(waterDropColor: AppColors.primary),
        footer: CustomFooter(
          builder: (ctx, mode) {
            Widget body;
            if (mode == LoadStatus.loading) {
              body = const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: AppColors.primary),
              );
            } else if (mode == LoadStatus.noMore) {
              body = const Text('No more notifications',
                  style:
                      TextStyle(color: AppColors.textMuted, fontSize: 12));
            } else {
              body = const SizedBox.shrink();
            }
            return SizedBox(height: 56, child: Center(child: body));
          },
        ),
        child: _loading && _items.isEmpty
            ? const InlineLoading(message: 'Loading notifications…')
            : _items.isEmpty
                ? EmptyState(
                    icon: Icons.notifications_none_rounded,
                    title: 'No notifications',
                    subtitle: _error ?? 'You\'re all caught up!',
                    actionLabel: _error != null ? 'Retry' : null,
                    onAction: _error != null
                        ? () => _load(refresh: true)
                        : null,
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(
                        AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xxxl),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: AppSpacing.sm),
                    itemBuilder: (ctx, i) {
                      final n = _items[i];
                      return _NotificationCard(notification: n);
                    },
                  ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  final AppNotification notification;
  const _NotificationCard({required this.notification});

  (IconData, Color, Color) _visualForType(String type) {
    switch (type.toLowerCase()) {
      case 'attendance':
        return (Icons.fingerprint, AppColors.success, AppColors.successBg);
      case 'leave':
        return (Icons.event_available, AppColors.primary, AppColors.primaryBg);
      case 'alert':
        return (Icons.warning_amber_rounded, AppColors.warning, AppColors.warningBg);
      case 'system':
        return (Icons.info_outline, AppColors.info, AppColors.infoBg);
      default:
        return (Icons.notifications, AppColors.primary, AppColors.primaryBg);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (icon, color, bg) = _visualForType(notification.type);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        border: Border.all(
          color:
              notification.unread ? AppColors.primary.withOpacity(0.25) : AppColors.cardBorder,
          width: notification.unread ? 1.5 : 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        notification.title,
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: notification.unread
                              ? FontWeight.w800
                              : FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    if (notification.unread)
                      Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.only(left: 6),
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                if (notification.description != null &&
                    notification.description!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    notification.description!,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
                if (notification.relativeTime.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    notification.relativeTime,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
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
