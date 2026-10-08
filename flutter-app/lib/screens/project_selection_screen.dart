// Project selection screen — pick project before check-in
import 'package:flutter/material.dart';
import '../core/constants.dart';
import '../models/models.dart';
import 'check_in_camera_screen.dart';

class ProjectSelectionScreen extends StatelessWidget {
  final List<Project> projects;

  const ProjectSelectionScreen({super.key, required this.projects});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Select Project')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Choose a project to check in to:', style: TextStyle(color: AppColors.textSecondary, fontSize: 14)),
          const SizedBox(height: 16),
          ...projects.map((p) => Card(
            child: ListTile(
              leading: Container(
                width: 48, height: 48,
                decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.location_on, color: AppColors.primary),
              ),
              title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('${p.code} • ${p.location ?? "—"}\nGeofence: ${p.radius}m radius', style: const TextStyle(fontSize: 12)),
              isThreeLine: true,
              trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted),
              onTap: () async {
                final checkedIn = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => CheckInCameraScreen(project: p),
                  ),
                );
                // Unwind to the dashboard so it refreshes into the working
                // state. Pushing a fresh HomeScreen would duplicate the
                // existing tab stack.
                if (checkedIn == true && context.mounted) {
                  Navigator.of(context).popUntil((r) => r.isFirst);
                }
              },
            ),
          )),
        ],
      ),
    );
  }
}
