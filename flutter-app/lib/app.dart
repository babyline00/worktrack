// App root — MaterialApp with theme + providers + initial route.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/theme.dart';
import 'providers/attendance_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/dashboard_provider.dart';
import 'providers/project_provider.dart';
import 'screens/splash_screen.dart';

class WorkTrackApp extends StatelessWidget {
  const WorkTrackApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>(create: (_) => AuthProvider()),
        ChangeNotifierProvider<DashboardProvider>(
            create: (_) => DashboardProvider()),
        ChangeNotifierProvider<AttendanceProvider>(
            create: (_) => AttendanceProvider()),
        ChangeNotifierProvider<ProjectProvider>(
            create: (_) => ProjectProvider()),
      ],
      child: MaterialApp(
        title: 'WorkTrack',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        // SplashScreen restores the persisted session (ApiClient.init + profile)
        // before routing to the home or login screen.
        home: const SplashScreen(),
      ),
    );
  }
}
