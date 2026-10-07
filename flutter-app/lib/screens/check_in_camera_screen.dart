// Check-in camera screen — capture selfie + GPS + upload
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import '../core/constants.dart';
import '../models/models.dart';
import '../providers/attendance_provider.dart';
import 'home_screen.dart';

class CheckInCameraScreen extends StatefulWidget {
  final Project project;

  const CheckInCameraScreen({super.key, required this.project});

  @override
  State<CheckInCameraScreen> createState() => _CheckInCameraScreenState();
}

class _CheckInCameraScreenState extends State<CheckInCameraScreen> {
  CameraController? _controller;
  bool _isReady = false;
  String? _capturedPath;
  bool _isUploading = false;
  String? _statusMessage;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      _controller = CameraController(front, ResolutionPreset.medium, enableAudio: false);
      await _controller!.initialize();
      setState(() => _isReady = true);
    } catch (e) {
      setState(() => _statusMessage = 'Camera not available. You can proceed without photo.');
    }
  }

  Future<void> _capture() async {
    if (_controller == null || !_controller!.value.isInitialized) return;
    try {
      final xFile = await _controller!.takePicture();
      setState(() => _capturedPath = xFile.path);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to capture photo')));
    }
  }

  Future<void> _submit() async {
    setState(() => _isUploading = true);

    final att = context.read<AttendanceProvider>();
    final loc = await att.getCurrentLocation();

    if (loc == null) {
      setState(() { _isUploading = false; });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Unable to get GPS location. Please enable location services.'),
        backgroundColor: AppColors.danger,
      ));
      return;
    }

    final success = await att.checkIn(
      projectId: widget.project.id,
      photoPath: _capturedPath ?? '',
      latitude: loc['latitude'] as double,
      longitude: loc['longitude'] as double,
      accuracy: loc['accuracy'] as double,
    );

    if (success && mounted) {
      Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const HomeScreen()), (r) => false);
    } else if (mounted) {
      setState(() { _isUploading = false; });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(att.error ?? 'Check-in failed'),
        backgroundColor: AppColors.danger,
      ));
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Check-In Selfie'),
        leading: IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
      ),
      body: _isUploading
        ? _buildUploading()
        : _capturedPath != null
          ? _buildPreview()
          : _buildCamera(),
    );
  }

  Widget _buildCamera() {
    if (!_isReady && _statusMessage == null) {
      return const Center(child: CircularProgressIndicator(color: Colors.white));
    }
    if (_statusMessage != null) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_statusMessage!, style: const TextStyle(color: Colors.white70), textAlign: TextAlign.center)));
    }
    return Stack(
      children: [
        CameraPreview(_controller!),
        // Face guide overlay
        Center(
          child: Container(
            width: 200, height: 260,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white54, width: 2),
              borderRadius: BorderRadius.circular(100),
            ),
          ),
        ),
        Positioned(
          bottom: 40, left: 0, right: 0,
          child: Center(
            child: GestureDetector(
              onTap: _capture,
              child: Container(
                width: 72, height: 72,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.primary, width: 4),
                ),
                child: const Icon(Icons.camera_alt, size: 32, color: AppColors.primary),
              ),
            ),
          ),
        ),
        const Positioned(
          bottom: 130, left: 0, right: 0,
          child: Center(child: Text('Position your face in the circle', style: TextStyle(color: Colors.white70, fontSize: 14))),
        ),
      ],
    );
  }

  Widget _buildPreview() {
    return Stack(
      children: [
        Center(child: Image.file(File(_capturedPath!), fit: BoxFit.cover, width: double.infinity, height: double.infinity)),
        Positioned(
          bottom: 40, left: 24, right: 24,
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => setState(() => _capturedPath = null),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retake'),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white54), padding: const EdgeInsets.symmetric(vertical: 16)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _submit,
                  icon: const Icon(Icons.check),
                  label: const Text('Check In'),
                  style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildUploading() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: Colors.white),
          const SizedBox(height: 24),
          const Text('Processing Check-In...', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text('Verifying photo + GPS + geofence', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 14)),
        ],
      ),
    );
  }
}
