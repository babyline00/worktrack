// Shared selfie capture flow used by both check-in and check-out.
//
// One implementation so the camera handling, live-location readout, geofence
// pre-check and submit/error plumbing cannot drift apart between the two
// attendance actions.
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/constants.dart';
import '../core/geofence.dart';
import '../providers/attendance_provider.dart';
import 'working_session_screen.dart' show LiveLocationTile;

/// What the caller wants to do once a selfie has been captured.
enum SelfieAction { checkIn, checkOut }

class SelfieCaptureScreen extends StatefulWidget {
  final SelfieAction action;

  /// Project coords + radius, when known — used for the local geofence
  /// pre-check so the user gets instant feedback instead of a server round-trip.
  final double? projectLatitude;
  final double? projectLongitude;
  final double? projectRadiusMeters;

  /// Check-in only.
  final String? projectId;

  /// Check-out only.
  final String? attendanceId;

  /// Bypasses the client-side geofence pre-check on check-out.
  ///
  /// Used by the auto check-out that fires precisely *because* the employee is
  /// outside the radius — without this the capture that ends the session would
  /// be rejected by the screen's own guard. The server still records the true
  /// coordinates and the outside-geofence status.
  final bool skipGeofenceCheck;

  /// Shown on the capture screen to explain why check-out was triggered.
  final String? reason;

  const SelfieCaptureScreen({
    super.key,
    required this.action,
    this.projectLatitude,
    this.projectLongitude,
    this.projectRadiusMeters,
    this.projectId,
    this.attendanceId,
    this.skipGeofenceCheck = false,
    this.reason,
  });

  bool get _isCheckIn => action == SelfieAction.checkIn;

  @override
  State<SelfieCaptureScreen> createState() => _SelfieCaptureScreenState();
}

class _SelfieCaptureScreenState extends State<SelfieCaptureScreen> {
  CameraController? _controller;
  bool _isCameraReady = false;
  String? _cameraError;
  String? _capturedPath;
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();
    _initCamera();
    // Warm the GPS cache while the user frames their selfie.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AttendanceProvider>().refreshLocation();
    });
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        setState(() => _cameraError = 'No camera found on this device');
        return;
      }
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      final controller = CameraController(
        front,
        ResolutionPreset.high,
        enableAudio: false,
      );
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _controller = controller;
        _isCameraReady = true;
      });
    } on CameraException catch (e) {
      setState(() => _cameraError = _describeCameraError(e));
    } catch (_) {
      setState(() => _cameraError =
          'Camera unavailable. Grant camera permission and reopen this screen.');
    }
  }

  String _describeCameraError(CameraException e) => switch (e.code) {
        'CameraAccessDenied' ||
        'CameraAccessDeniedWithoutPrompt' =>
          'Camera permission denied. Enable it in Settings, then reopen this screen.',
        'CameraAccessRestricted' =>
          'Camera is restricted on this device.',
        _ => 'Camera unavailable (${e.code}).',
      };

  Future<void> _capture() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    try {
      final xFile = await controller.takePicture();
      if (!mounted) return;
      setState(() => _capturedPath = xFile.path);
    } catch (_) {
      _showError('Failed to capture photo. Try again.');
    }
  }

  Future<void> _retake() async {
    final path = _capturedPath;
    setState(() => _capturedPath = null);
    // Free the capture immediately rather than waiting for GC.
    if (path != null) {
      try {
        await File(path).delete();
      } catch (_) {
        // best-effort cleanup
      }
    }
  }

  /// Server caps uploads at 10 MB; refuse locally rather than after a slow upload.
  static const int _maxPhotoBytes = 10 * 1024 * 1024;

  Future<void> _submit() async {
    if (_capturedPath == null) {
      _showError('Take a selfie before continuing.');
      return;
    }

    // A truncated or empty file would satisfy the existence check below and
    // then be rejected by the server as "Photo must be an image", which reads
    // as a random failure. Catch it here instead.
    try {
      final bytes = await File(_capturedPath!).length();
      if (bytes == 0) {
        _showError('The photo was empty. Please retake it.');
        return;
      }
      if (bytes > _maxPhotoBytes) {
        _showError('The photo is too large. Please retake it.');
        return;
      }
    } catch (_) {
      _showError('Could not read the photo. Please retake it.');
      return;
    }

    final att = context.read<AttendanceProvider>();
    setState(() => _isUploading = true);

    // Re-read rather than trusting the cached fix: attendance is stamped at
    // capture time, so a stale position would misreport where the user was.
    final loc = await att.refreshLocation();
    if (loc == null) {
      if (!mounted) return;
      setState(() => _isUploading = false);
      _showError(att.locationError ?? 'Unable to get GPS location');
      return;
    }

    final lat = loc['latitude'] as double;
    final lng = loc['longitude'] as double;

    // Mirror the server's accuracy gate so the user isn't told "Check-in
    // failed" for something they can fix by waiting for a better fix.
    const maxAccuracyMeters = 50.0;
    final accuracy = loc['accuracy'] as double;
    if (accuracy > maxAccuracyMeters) {
      if (!mounted) return;
      setState(() => _isUploading = false);
      _showError(
        'GPS accuracy is ±${accuracy.toStringAsFixed(0)}m. '
        'Move outdoors and try again (need under ${maxAccuracyMeters.toStringAsFixed(0)}m).',
      );
      return;
    }

    // Same for the geofence — warn before spending an upload. Skipped for the
    // auto check-out, which is triggered by being outside the radius.
    final distance = Geofence.distanceMeters(
      latitude: lat,
      longitude: lng,
      projectLatitude: widget.projectLatitude,
      projectLongitude: widget.projectLongitude,
    );
    final radius = widget.projectRadiusMeters;
    if (!widget.skipGeofenceCheck &&
        distance != null &&
        radius != null &&
        distance > radius) {
      if (!mounted) return;
      setState(() => _isUploading = false);
      _showError(
        'You are ${distance.toStringAsFixed(0)}m from the project — '
        'outside the ${radius.toStringAsFixed(0)}m allowed area.',
      );
      return;
    }

    final success = widget._isCheckIn
        ? await att.checkIn(
            projectId: widget.projectId!,
            photoPath: _capturedPath!,
            latitude: lat,
            longitude: lng,
            accuracy: accuracy,
          )
        : await att.checkOut(
            attendanceId: widget.attendanceId!,
            photoPath: _capturedPath!,
            latitude: lat,
            longitude: lng,
            accuracy: accuracy,
          );

    if (!mounted) return;
    if (success) {
      // The server flags a check-out performed outside the project radius and
      // returns a message for the employee. Show it before unwinding, otherwise
      // the FLAGGED record would only ever surface to an admin.
      final warning = att.geofenceWarning;
      if (!widget._isCheckIn && warning != null && warning.isNotEmpty) {
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            icon: const Icon(Icons.warning_amber_rounded,
                color: AppColors.warning, size: 32),
            title: const Text('Checked out outside project area'),
            content: Text(warning, style: const TextStyle(fontSize: 14)),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
      if (!mounted) return;
      // Pop `true` so the caller can unwind to the dashboard.
      Navigator.pop(context, true);
    } else {
      setState(() => _isUploading = false);
      _showError(att.error ?? 'Failed to ${widget._isCheckIn ? 'check in' : 'check out'}');
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.danger,
        duration: const Duration(seconds: 5),
      ),
    );
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final title = widget._isCheckIn ? 'Check-In Selfie' : 'Check-Out Selfie';
    final verb = widget._isCheckIn ? 'CHECK IN' : 'CHECK OUT';

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(title),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: _isUploading ? null : () => Navigator.pop(context),
        ),
      ),
      body: Column(
        children: [
          if (widget.reason != null)
            Container(
              width: double.infinity,
              color: AppColors.warningSoft,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  const Icon(Icons.info_outline,
                      size: 18, color: AppColors.warning),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.reason!,
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: _isUploading
                ? _buildUploading(verb)
                : _capturedPath != null
                    ? _buildPreview(verb)
                    : _buildCapture(),
          ),
        ],
      ),
    );
  }

  Widget _buildCapture() {
    if (_cameraError != null) {
      return _CenteredMessage(
        icon: Icons.no_photography_outlined,
        message: _cameraError!,
        action: ElevatedButton.icon(
          onPressed: () {
            setState(() => _cameraError = null);
            _initCamera();
          },
          icon: const Icon(Icons.refresh),
          label: const Text('Retry'),
        ),
      );
    }

    if (!_isCameraReady) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        // Front camera preview is mirrored so the user sees themselves the way
        // a mirror would; the captured file is unmirrored.
        Transform.scale(
          scaleX: -1,
          child: CameraPreview(_controller!),
        ),
        Center(
          child: Container(
            width: 220,
            height: 280,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white70, width: 2),
              borderRadius: BorderRadius.circular(110),
            ),
          ),
        ),
        const Positioned(
          bottom: 150,
          left: 0,
          right: 0,
          child: Center(
            child: Text(
              'Position your face in the circle',
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),
          ),
        ),
        // Live location so the user can confirm the fix before capturing.
        const Positioned(
          left: 16,
          right: 16,
          bottom: 88,
          child: LiveLocationTile(),
        ),
        Positioned(
          bottom: 24,
          left: 0,
          right: 0,
          child: Center(
            child: GestureDetector(
              onTap: _capture,
              child: Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: widget._isCheckIn ? AppColors.primary : AppColors.danger,
                    width: 4,
                  ),
                ),
                child: Icon(
                  Icons.camera_alt,
                  size: 34,
                  color:
                      widget._isCheckIn ? AppColors.primary : AppColors.danger,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPreview(String verb) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.file(File(_capturedPath!), fit: BoxFit.cover),
        Positioned(
          bottom: 40,
          left: 24,
          right: 24,
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _retake,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retake'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white54),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _submit,
                  icon: const Icon(Icons.check),
                  label: Text(verb),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: widget._isCheckIn
                        ? AppColors.primary
                        : AppColors.danger,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildUploading(String verb) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: Colors.white),
          const SizedBox(height: 24),
          Text(
            'Processing $verb...',
            style: const TextStyle(
                color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            'Uploading selfie, GPS and timestamp',
            style: TextStyle(
                color: Colors.white.withValues(alpha: 0.7), fontSize: 14),
          ),
        ],
      ),
    );
  }
}

class _CenteredMessage extends StatelessWidget {
  final IconData icon;
  final String message;
  final Widget? action;

  const _CenteredMessage({
    required this.icon,
    required this.message,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: Colors.white54, size: 48),
            const SizedBox(height: AppSpacing.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
            if (action != null) ...[
              const SizedBox(height: AppSpacing.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}