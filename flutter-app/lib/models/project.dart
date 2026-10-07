// Project model — assigned project with geofence (from `/mobile/projects`
// and `/mobile/dashboard`).
class Project {
  final String id;
  final String name;
  final String? code;
  final String? client;
  final String? description;
  final String? location;
  final String status;
  final double? latitude;
  final double? longitude;
  final double? radiusMeters;
  final String? timezone;
  final String? startDate;
  final String? endDate;

  Project({
    required this.id,
    required this.name,
    this.code,
    this.client,
    this.description,
    this.location,
    this.status = 'ACTIVE',
    this.latitude,
    this.longitude,
    this.radiusMeters,
    this.timezone,
    this.startDate,
    this.endDate,
  });

  factory Project.fromJson(Map<String, dynamic> j) {
    final coords = (j['coords'] as Map<String, dynamic>?) ?? const {};
    return Project(
      id: (j['id'] as String?) ?? '',
      name: (j['name'] as String?) ?? '',
      code: j['code'] as String?,
      client: j['client'] as String?,
      description: j['description'] as String?,
      location: j['location'] as String?,
      status: (j['status'] as String?) ?? 'ACTIVE',
      latitude: (coords['latitude'] as num?)?.toDouble() ?? (j['lat'] as num?)?.toDouble(),
      longitude: (coords['longitude'] as num?)?.toDouble() ?? (j['lng'] as num?)?.toDouble(),
      radiusMeters: (j['radius'] as num?)?.toDouble() ??
          (j['radiusM'] as num?)?.toDouble(),
      timezone: j['timezone'] as String?,
      startDate: j['startDate'] as String?,
      endDate: j['endDate'] as String?,
    );
  }

  bool get hasGeofence => latitude != null && longitude != null;
  double get effectiveRadius => radiusMeters ?? 200.0;
}
