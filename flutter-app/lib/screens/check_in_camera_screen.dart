// Check-in — delegates to the shared selfie capture flow.
import 'package:flutter/material.dart';

import '../models/models.dart';
import 'selfie_capture_screen.dart';

class CheckInCameraScreen extends StatelessWidget {
  final Project project;

  const CheckInCameraScreen({super.key, required this.project});

  @override
  Widget build(BuildContext context) {
    return SelfieCaptureScreen(
      action: SelfieAction.checkIn,
      projectId: project.id,
      projectLatitude: project.latitude,
      projectLongitude: project.longitude,
      projectRadiusMeters: project.radius.toDouble(),
    );
  }
}