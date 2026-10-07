// Check-out camera screen — capture selfie + GPS + upload for checkout
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../providers/attendance_provider.dart';

class CheckOutCameraScreen extends StatefulWidget {
  final String attendanceId;

  const CheckOutCameraScreen({super.key, required this.attendanceId});

  @override
  State<CheckOutCameraScreen> createState() => _CheckOutCameraScreenState();
}

class _CheckOutCameraScreenState extends State<CheckOutCameraScreen> {
  CameraController? _controller;
  bool _isReady = false;
  String? _capturedPath;
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      final front = cameras.firstWhere((c) => c.lensDirection == CameraLensDirection.front, orElse: () => cameras.first);
      _controller = CameraController(front, ResolutionPreset.medium, enableAudio: false);
      await _controller!.initialize();
      setState(() => _isReady = true);
    } catch (e) {
      setState(() => _isReady = false);
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
      setState(() => _isUploading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Unable to get GPS location'), backgroundColor: AppColors.danger));
      return;
    }

    final success = await att.checkOut(
      attendanceId: widget.attendanceId,
      photoPath: _capturedPath ?? '',
      latitude: loc['latitude'] as double,
      longitude: loc['longitude'] as double,
      accuracy: loc['accuracy'] as double,
    );

    if (success && mounted) {
      Navigator.pop(context);
    } else if (mounted) {
      setState(() { _isUploading = false; });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(att.error ?? 'Check-out failed'), backgroundColor: AppColors.danger));
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
      appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white, title: const Text('Check-Out Selfie'), leading: IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context))),
      body: _isUploading
        ? _buildUploading()
        : _capturedPath != null
          ? _buildPreview()
          : _buildCamera(),
    );
  }

  Widget _buildCamera() {
    if (!_isReady) return const Center(child: CircularProgressIndicator(color: Colors.white));
    return Stack(
      children: [
        CameraPreview(_controller!),
        Center(child: Container(width: 200, height: 260, decoration: BoxDecoration(border: Border.all(color: Colors.white54, width: 2), borderRadius: BorderRadius.circular(100)))),
        Positioned(bottom: 40, left: 0, right: 0, child: Center(child: GestureDetector(onTap: _capture, child: Container(width: 72, height: 72, decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: AppColors.danger, width: 4)), child: const Icon(Icons.camera_alt, size: 32, color: AppColors.danger))))),
        const Positioned(bottom: 130, left: 0, right: 0, child: Center(child: Text('Position your face in the circle', style: TextStyle(color: Colors.white70, fontSize: 14)))),
      ],
    );
  }

  Widget _buildPreview() {
    return Stack(
      children: [
        Center(child: Image.file(File(_capturedPath!), fit: BoxFit.cover, width: double.infinity, height: double.infinity)),
        Positioned(bottom: 40, left: 24, right: 24, child: Row(children: [
          Expanded(child: OutlinedButton.icon(onPressed: () => setState(() => _capturedPath = null), icon: const Icon(Icons.refresh), label: const Text('Retake'), style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white54), padding: const EdgeInsets.symmetric(vertical: 16)))),
          const SizedBox(width: 12),
          Expanded(child: ElevatedButton.icon(onPressed: _submit, icon: const Icon(Icons.logout), label: const Text('Check Out'), style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger, padding: const EdgeInsets.symmetric(vertical: 16)))),
        ])),
      ],
    );
  }

  Widget _buildUploading() {
    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const CircularProgressIndicator(color: Colors.white),
      const SizedBox(height: 24),
      const Text('Processing Check-Out...', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      Text('Calculating working time...', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 14)),
    ]));
  }
}
