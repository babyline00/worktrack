// Home screen with bottom navigation — Home, Attendance, Leave, Profile
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/attendance_provider.dart';
import 'dashboard_tab.dart';
import 'attendance_history_tab.dart';
import 'leave_tab.dart';
import 'profile_tab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  /// Needed so the Leave tab can be refreshed when selected — `IndexedStack`
  /// keeps every tab alive, so its `initState` only ever runs once.
  final _leaveKey = GlobalKey<LeaveTabState>();

  @override
  void initState() {
    super.initState();
    // The dashboard is the screen's own data, so it loads with the screen.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AttendanceProvider>().loadDashboard();
    });
  }

  /// Reloads the data behind a tab as it becomes visible.
  ///
  /// `IndexedStack` builds every tab up front and keeps it alive, so each tab's
  /// `initState` runs once at startup — before any check-in. Without this,
  /// Attendance and Leave kept showing whatever was loaded at launch.
  void _refreshTab(int index) {
    switch (index) {
      case 0:
        // Pick up check-ins/out made since the screen was built.
        context.read<AttendanceProvider>().loadDashboard();
      case 1:
        // Page 1 replaces rather than appends, so this also clears the
        // paginated state from any earlier scroll.
        context.read<AttendanceProvider>().loadHistory(page: 1);
      case 2:
        _leaveKey.currentState?.reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          const DashboardTab(),
          const AttendanceHistoryTab(),
          LeaveTab(key: _leaveKey),
          const ProfileTab(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) {
          setState(() => _currentIndex = i);
          _refreshTab(i);
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.history_outlined), activeIcon: Icon(Icons.history), label: 'Attendance'),
          BottomNavigationBarItem(icon: Icon(Icons.event_busy_outlined), activeIcon: Icon(Icons.event_busy), label: 'Leave'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
