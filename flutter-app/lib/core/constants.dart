// Core constants for WorkTrack mobile app
import 'package:flutter/material.dart';

class ApiConstants {
  /// Base API URL. Override at build/run time with:
  ///
  /// ```
  //  flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1
  /// ```
  ///
  /// On a physical device use `adb reverse tcp:3000 tcp:3000` and point at
  /// `localhost`; the Android emulator reaches the host at `10.0.2.2`.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://my-project-chi-flame-13.vercel.app/api/v1',
  );

  /// Tenant code sent with the login request.
  ///
  /// The login screen no longer asks employees for this — it is a property of
  /// the deployment, not of the user. Override per environment with:
  ///
  /// ```
  /// flutter run --dart-define=COMPANY_CODE=WT001
  /// ```
  static const String companyCode = String.fromEnvironment(
    'COMPANY_CODE',
    defaultValue: 'WT001',
  );

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);
}

class AppColors {
  static const Color primary = Color(0xFF2563EB);
  static const Color primaryDark = Color(0xFF1D4ED8);
  static const Color navy = Color(0xFF0F172A);
  static const Color background = Color(0xFFF8FAFC);
  static const Color card = Colors.white;
  static const Color border = Color(0xFFE2E8F0);
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color success = Color(0xFF16A34A);
  static const Color successSoft = Color(0xFFDCFCE7);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningSoft = Color(0xFFFEF3C7);
  static const Color danger = Color(0xFFDC2626);
  static const Color dangerSoft = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF0EA5E9);
  static const Color infoSoft = Color(0xFFE0F2FE);

  // Soft background tints for status chips / badges
  static const Color primaryBg = Color(0xFFDBEAFE);
  static const Color successBg = successSoft;
  static const Color warningBg = warningSoft;
  static const Color dangerBg = dangerSoft;
  static const Color infoBg = infoSoft;

  // Surface tokens
  static const Color surface = card;
  static const Color cardBorder = border;
}

class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;
  static const double xxxl = 64;

  /// Corner radius for card containers.
  static const double cardRadius = AppRadius.md;
}

class AppRadius {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

class AppText {
  static const String appName = 'NAS International';
  static const String appShortName = 'NAS';
  /// The name as it appears in tight headers, e.g. the dashboard top bar.
  static const String appWordmark = 'NAS INTERNATIONAL';
  static const String appTagline = 'Delivering Today \u2022 Connecting Tomorrow';
  /// What the product does — a descriptor, not the brand name.
  static const String appDescriptor = 'Workforce Management';
}

/// Origin of the API host, e.g. `https://example.vercel.app`.
///
/// Photos are persisted as root-relative paths (`/uploads/...`), so they need
/// the origin prepended before being handed to `Image.network`.
String get apiOrigin {
  final uri = Uri.parse(ApiConstants.baseUrl);
  return '${uri.scheme}://${uri.authority}';
}

/// Turns a stored photo path into an absolute URL. Returns `''` when there is
/// no photo so callers can fall back to a placeholder.
String resolvePhotoUrl(String? path) {
  if (path == null || path.isEmpty) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return '$apiOrigin${path.startsWith('/') ? '' : '/'}$path';
}
