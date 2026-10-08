// Notification provider — unread badge for the bell, plus push-to-refresh after
// any action that can create a notification (check-in/out, leave requests).
import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../models/notification.dart';

class NotificationProvider extends ChangeNotifier {
  List<AppNotification> _items = [];
  int _unreadCount = 0;
  bool _loading = false;
  String? _error;

  List<AppNotification> get items => _items;
  int get unreadCount => _unreadCount;
  bool get loading => _loading;
  String? get error => _error;
  bool get hasUnread => _unreadCount > 0;

  /// Reads the badge count only. Cheap enough to poll, unlike the full list.
  Future<void> loadUnreadCount() async {
    try {
      final data =
          await ApiClient.instance.get('/mobile/notifications/unread-count');
      final count = (data['unreadCount'] as num?)?.toInt();
      if (count == null || count == _unreadCount) return;
      _unreadCount = count;
      notifyListeners();
    } catch (_) {
      // Badge is cosmetic — never surface an error for it, and never let a
      // failed poll tear down the screen.
    }
  }

  /// Replaces the list. [unreadCount] comes back with the list so the badge and
  /// the rows can never disagree.
  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final data = await ApiClient.instance.get('/mobile/notifications');
      _items = ((data['data'] as List?) ?? [])
          .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
          .toList();
      _unreadCount = (data['unreadCount'] as num?)?.toInt() ??
          _items.where((n) => n.unread).length;
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'Failed to load notifications';
    }
    _loading = false;
    notifyListeners();
  }

  /// Marks one notification read, keeping the row in place.
  Future<void> markRead(String id) async {
    final idx = _items.indexWhere((n) => n.id == id);
    if (idx == -1 || !_items[idx].unread) return;

    // Optimistic: the dot disappears immediately, reverted below on failure.
    final prev = _items[idx];
    _items = [..._items]..[idx] = withUnread(prev, false);
    if (_unreadCount > 0) _unreadCount--;
    notifyListeners();

    try {
      await ApiClient.instance.patch('/notifications/$id');
    } catch (_) {
      _items = [..._items]..[idx] = prev;
      _unreadCount++;
      notifyListeners();
    }
  }

  Future<String?> markAllRead() async {
    if (_unreadCount == 0) return null;
    try {
      await ApiClient.instance.patch('/notifications/read-all');
    } on ApiException catch (e) {
      return e.message;
    } catch (_) {
      return 'Could not mark notifications read';
    }
    _items = _items.map((n) => withUnread(n, false)).toList();
    _unreadCount = 0;
    notifyListeners();
    return null;
  }

  static AppNotification withUnread(AppNotification n, bool unread) =>
      AppNotification(
        id: n.id,
        type: n.type,
        title: n.title,
        description: n.description,
        timeAgo: n.timeAgo,
        createdAt: n.createdAt,
        unread: unread,
      );

  void clear() {
    _items = [];
    _unreadCount = 0;
    _error = null;
    notifyListeners();
  }
}