// Notification model — from `/mobile/notifications`.
class AppNotification {
  final String id;
  final String type;     // attendance | leave | alert | system | ...
  final String title;
  final String? description;
  final String? timeAgo;
  final DateTime? createdAt;
  final bool unread;

  AppNotification({
    required this.id,
    required this.type,
    required this.title,
    this.description,
    this.timeAgo,
    this.createdAt,
    this.unread = false,
  });

  factory AppNotification.fromJson(Map<String, dynamic> j) {
    DateTime? created;
    final raw = j['createdAt'] ?? j['created_at'] ?? j['time'];
    if (raw is String) {
      try {
        created = DateTime.parse(raw);
      } catch (_) {}
    }
    return AppNotification(
      id: (j['id'] as String?) ?? '',
      type: ((j['type'] as String?) ?? 'system').toLowerCase(),
      title: (j['title'] as String?) ?? '',
      description: j['description'] as String?,
      timeAgo: j['timeAgo'] as String?,
      createdAt: created,
      unread: (j['unread'] as bool?) ?? false,
    );
  }

  String get relativeTime {
    if (timeAgo != null && timeAgo!.isNotEmpty) return timeAgo!;
    if (createdAt == null) return '';
    final diff = DateTime.now().difference(createdAt!);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${createdAt!.day}/${createdAt!.month}/${createdAt!.year}';
  }
}
