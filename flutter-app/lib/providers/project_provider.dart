// Project provider — list of projects assigned to the current employee.
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../models/project.dart';

class ProjectProvider extends ChangeNotifier {
  List<Project> _projects = const [];
  bool _loading = false;
  String? _error;

  List<Project> get projects => _projects;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> load({bool silent = false}) async {
    if (!silent) {
      _loading = true;
      notifyListeners();
    }
    try {
      final data = await ApiClient.instance.get('/mobile/projects');
      _projects = ((data['projects'] as List?) ?? [])
          .map((e) => Project.fromJson(e as Map<String, dynamic>))
          .toList();
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Failed to load projects';
    }
    _loading = false;
    notifyListeners();
  }

  /// Distance (in metres) from [lat,lng] to the project's geofence centre,
  /// or `null` if the project has no geofence.
  double? distanceTo(Project project, double lat, double lng) {
    if (!project.hasGeofence) return null;
    const R = 6371000.0;
    double toRad(double d) => d * math.pi / 180.0;
    final dLat = toRad(project.latitude! - lat);
    final dLng = toRad(project.longitude! - lng);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(toRad(lat)) *
            math.cos(toRad(project.latitude!)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return R * c;
  }

  /// Returns `true` if [lat,lng] is inside the project's geofence.
  bool isInsideGeofence(Project project, double lat, double lng) {
    final d = distanceTo(project, lat, lng);
    if (d == null) return true;
    return d <= project.effectiveRadius;
  }
}
