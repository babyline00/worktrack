// Help & Support — searchable guides for the employee app.
//
// Reachable from Profile. The row that pointed here had `onTap: () {}`.
import 'package:flutter/material.dart';

import '../core/constants.dart';

class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<_Guide> get _visible =>
      _guides.where((g) => g.matches(_query)).toList();

  @override
  Widget build(BuildContext context) {
    final visible = _visible;

    return Scaffold(
      appBar: AppBar(title: const Text('Help & Support')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: TextField(
              controller: _controller,
              onChanged: (v) => setState(() => _query = v),
              decoration: InputDecoration(
                hintText: 'Search help',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _controller.clear();
                          setState(() => _query = '');
                        },
                      ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12),
              ),
            ),
          ),
          Expanded(
            child: visible.isEmpty
                ? const Center(
                    child: Text(
                      'No guides match your search.',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  )
                // Keeps each guide's open/closed state across searches.
                : ListView.builder(
                    padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                    itemCount: visible.length,
                    itemBuilder: (context, i) => _GuideTile(guide: visible[i]),
                  ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                const Icon(Icons.support_agent, color: AppColors.primary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Still stuck? Your administrator manages this account and '
                    'can correct your shift, project or leave records.',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GuideTile extends StatelessWidget {
  final _Guide guide;

  const _GuideTile({required this.guide});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 4),
      child: ExpansionTile(
        shape: const Border(),
        collapsedShape: const Border(),
        title: Text(guide.title,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        subtitle: Text(guide.summary,
            style:
                const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md, 0, AppSpacing.md, AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final step in guide.steps)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(step,
                        style: const TextStyle(
                            fontSize: 13, height: 1.4)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Guide {
  final String title;
  final String summary;
  final List<String> steps;
  final List<String> keywords;

  const _Guide(this.title, this.summary, this.steps,
      {this.keywords = const []});

  bool matches(String q) {
    if (q.trim().isEmpty) return true;
    final needle = q.toLowerCase();
    return title.toLowerCase().contains(needle) ||
        summary.toLowerCase().contains(needle) ||
        keywords.any((k) => k.contains(needle));
  }
}

const _guides = [
  _Guide(
    'Checking in',
    'Open a shift at the project you are working at.',
    [
      'From Home, tap CHECK IN.',
      'Allow location access when asked. Without a position fix your check-in '
          'will be refused, so make sure GPS is on.',
      'The app checks you are inside the project radius. If you are not, move '
          'closer to the site and try again.',
      'Take a selfie. This is required and is used to confirm the shift is yours.',
      'A green WORKING status and a running timer confirm you are checked in.',
    ],
    keywords: ['clock in', 'start shift', 'geo', 'gps', 'selfie', 'photo'],
  ),
  _Guide(
    'Checking out',
    'Close your shift when you finish work.',
    [
      'Tap CHECK OUT from the working session screen.',
      'Take the check-out selfie. A photo is required every time.',
      'The server confirms your check-out time and total hours worked.',
      'If you walked outside the project radius for several minutes, the app '
          'will offer to check you out automatically — this protects you from '
          'billing time you were not on site.',
    ],
    keywords: ['clock out', 'end shift', 'finish', 'auto'],
  ),
  _Guide(
    'Location and the project area',
    'How your position is used while you work.',
    [
      'Your position is recorded only while a shift is open, so your hours can '
          'be verified against the project.',
      'Tracking continues when you switch screens, and resumes when you come '
          'back to the app.',
      'If the app says location permission is permanently denied, open Settings '
          'and enable Location for NAS International — it cannot re-prompt you itself.',
      'A fix with poor accuracy (say ±80 m) may read as outside the radius. '
          'Move to an open area and wait for accuracy to improve.',
    ],
    keywords: ['permission', 'gps', 'accuracy', 'geofence', 'radius', 'settings'],
  ),
  _Guide(
    'Requesting leave',
    'Ask for time off and track its status.',
    [
      'Open the Leave tab and tap the add button.',
      'Choose the leave type and the from/to dates, then add a reason.',
      'The request goes to your administrator and shows as PENDING.',
      'Once approved it appears as APPROVED. Your administrator sets the final '
          'status — the app cannot approve requests itself.',
    ],
    keywords: ['leave', 'vacation', 'sick', 'holiday', 'absence', 'pto'],
  ),
  _Guide(
    'Viewing your attendance history',
    'Look back at previous shifts.',
    [
      'Open the Attendance tab to see your past shifts with date, times and '
          'total hours.',
      'Scroll down to load older records.',
      'Each row shows whether the shift was verified and how late it started.',
      'Tap a shift for its full detail, including the project.',
    ],
    keywords: ['history', 'past', 'records', 'hours', 'report'],
  ),
  _Guide(
    'Notifications',
    'Alerts about your attendance and leave.',
    [
      'Tap the bell on the Home header to open your notifications.',
      'A badge shows how many are unread.',
      'Tap a notification to mark that one read, or use "Mark all read".',
      'You are notified when leave is approved or rejected, and about shift '
          'issues that need your attention.',
    ],
    keywords: ['bell', 'badge', 'alert', 'read', 'unread'],
  ),
];