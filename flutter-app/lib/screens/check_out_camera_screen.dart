// Check-out — delegates to the shared selfie capture flow.
import 'package:flutter/material.dart';

import 'selfie_capture_screen.dart';

class CheckOutCameraScreen extends StatelessWidget {
  final String attendanceId;
  final double? projectLatitude;
  final double? projectLongitude;
  final double? projectRadiusMeters;

  /// Set by the auto check-out, which fires because the employee is outside
  /// the radius and therefore must not be blocked by the geofence pre-check.
  final bool skipGeofenceCheck;

  /// Optional explanation shown on the capture screen.
  final String? reason;

  const CheckOutCameraScreen({
    super.key,
    required this.attendanceId,
    this.projectLatitude,
    this.projectLongitude,
    this.projectRadiusMeters,
    this.skipGeofenceCheck = false,
    this.reason,
  });

  @override
  Widget build(BuildContext context) {
    return SelfieCaptureScreen(
      action: SelfieAction.checkOut,
      attendanceId: attendanceId,
      projectLatitude: projectLatitude,
      projectLongitude: projectLongitude,
      projectRadiusMeters: projectRadiusMeters,
      skipGeofenceCheck: skipGeofenceCheck,
      reason: reason,
    );
  }
}