// Attendance history tab — paginated list
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../models/models.dart' show AttendanceHistoryItem;
import '../providers/attendance_provider.dart';
import 'attendance_detail_screen.dart';
import '../models/attendance.dart' as detail_models;

class AttendanceHistoryTab extends StatefulWidget {
  const AttendanceHistoryTab({super.key});

  @override
  State<AttendanceHistoryTab> createState() => _AttendanceHistoryTabState();
}

class _AttendanceHistoryTabState extends State<AttendanceHistoryTab> {
  final _scrollController = ScrollController();
  int _page = 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AttendanceProvider>().loadHistory(page: 1);
    });
    _scrollController.addListener(_onScroll);
  }

  /// True while a page request is in flight, so one scroll gesture cannot queue
  /// several overlapping loads.
  bool _loadingPage = false;

  void _onScroll() {
    final pos = _scrollController.position;
    if (!pos.hasContentDimensions) return;
    // 200px of lead time starts the next page before the user reaches the
    // bottom, instead of only firing on the final frame.
    if (pos.pixels < pos.maxScrollExtent - 200) return;
    if (_loadingPage) return;
    if (_page >= context.read<AttendanceProvider>().lastPage) return;

    _loadingPage = true;
    _page += 1;
    context.read<AttendanceProvider>().loadHistory(page: _page).whenComplete(() {
      _loadingPage = false;
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Selector, not watch: during a live session the provider notifies once a
    // second for the elapsed-time ticker, and `watch` would rebuild this whole
    // list — every card — on every tick even though history never changes.
    final provider = context.read<AttendanceProvider>();
    final history = context.select<AttendanceProvider, List<AttendanceHistoryItem>>(
      (a) => a.history,
    );
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance History')),
      body: RefreshIndicator(
        onRefresh: () { _page = 1; return provider.loadHistory(page: 1); },
        child: history.isEmpty
          ? const Center(child: Text('No attendance records yet', style: TextStyle(color: AppColors.textSecondary)))
          : ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: history.length,
              itemBuilder: (ctx, i) {
                final item = history[i];
                return Card(
                  child: ListTile(
                    // Tapping a record opens the full detail, including the
                    // check-in/out selfies — the list was previously inert.
                    onTap: () => Navigator.push(
                      ctx,
                      MaterialPageRoute(
                        builder: (_) => AttendanceDetailScreen(
                          // The provider produces the lean model from
                          // models.dart while the detail screen reads the
                          // richer one; bridge the two here rather than
                          // duplicating the class a third time.
                          historyItem: detail_models.AttendanceHistoryItem(
                            id: item.id,
                            date: item.date,
                            project: item.project,
                            checkIn: item.checkIn,
                            checkOut: item.checkOut,
                            workingMinutes: item.workingMinutes,
                            sessionStatus: item.sessionStatus,
                            attendanceStatus: item.attendanceStatus,
                            verificationStatus: item.verificationStatus,
                            lateMinutes: item.lateMinutes,
                          ),
                        ),
                      ),
                    ),
                    leading: CircleAvatar(
                      backgroundColor: item.sessionStatus == 'COMPLETED' ? AppColors.successSoft : AppColors.warningSoft,
                      child: Icon(item.sessionStatus == 'COMPLETED' ? Icons.check_circle : Icons.access_time,
                        color: item.sessionStatus == 'COMPLETED' ? AppColors.success : AppColors.warning, size: 20),
                    ),
                    title: Text(item.date, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    subtitle: Text('${item.project}\n${item.checkIn ?? "—"} → ${item.checkOut ?? "—"}', style: const TextStyle(fontSize: 12)),
                    isThreeLine: true,
                    trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text('${(item.workingMinutes / 60).toStringAsFixed(1)}h', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      if (item.lateMinutes > 0) Text('+${item.lateMinutes}m late', style: const TextStyle(fontSize: 10, color: AppColors.warning)),
                    ]),
                  ),
                );
              },
            ),
      ),
    );
  }
}
