// Attendance history tab — paginated list
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../providers/attendance_provider.dart';

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

  void _onScroll() {
    if (_scrollController.position.pixels == _scrollController.position.maxScrollExtent) {
      _page++;
      context.read<AttendanceProvider>().loadHistory(page: _page);
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final att = context.watch<AttendanceProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance History')),
      body: RefreshIndicator(
        onRefresh: () { _page = 1; return att.loadHistory(page: 1); },
        child: att.history.isEmpty
          ? const Center(child: Text('No attendance records yet', style: TextStyle(color: AppColors.textSecondary)))
          : ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: att.history.length,
              itemBuilder: (ctx, i) {
                final item = att.history[i];
                return Card(
                  child: ListTile(
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
