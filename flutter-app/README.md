# WorkTrack — Flutter Mobile App

A complete Flutter mobile app for the WorkTrack workforce management platform. Connects to the live REST API for employee check-in/out with camera selfie + GPS + geofence verification.

## Features

- **JWT Authentication** — login with employee ID + password, automatic token refresh
- **Dashboard** — today's status (WORKING/COMPLETED/NOT_STARTED), live working timer, quick stats, assigned projects, recent attendance
- **Check-In Flow** — select project → front camera selfie capture → GPS location → multipart upload with photo
- **Working Session** — live timer, geofence status, location auto-update every 2 minutes, CHECK OUT button
- **Check-Out Flow** — front camera selfie → GPS → multipart upload → working time summary
- **Attendance History** — paginated list with date, project, times, working hours, late minutes
- **Leave Requests** — create leave requests (annual/sick/unpaid/emergency) with date picker
- **Profile** — employee info, role badge, edit, logout
- **Notifications** — push notification support

## API

- **Base URL**: `https://my-project-chi-flame-13.vercel.app/api/v1` (the default)
- **Override at build/run time**:

  ```bash
  # local backend on a physical device
  adb reverse tcp:3000 tcp:3000
  flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1

  # Android emulator reaches the host at 10.0.2.2
  flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
  ```

- **Tenant code**: employees no longer type it. The company code is supplied by
  the build via `--dart-define=COMPANY_CODE=…` (defaults to `WT001`) and is sent
  automatically with the login request.

### Logins

| Environment | Employee ID | Password |
|---|---|---|
| Production | `987654321` | `admin123` |
| Local seed | `2585436361` | `employee123` |

## Tech Stack

- Flutter 3.x + Dart 3.x
- Dio (HTTP client with JWT interceptor)
- Provider (state management)
- Camera (front camera selfie capture)
- Geolocator (GPS location)
- Google Fonts (Inter)
- flutter_secure_storage (token storage)

## Project Structure

```
lib/
├── main.dart                    # App entry + provider setup
├── core/
│   ├── constants.dart           # API URL, colors, spacing
│   ├── api_client.dart          # Dio HTTP client + JWT interceptor + token refresh
│   └── theme.dart               # Material 3 theme
├── models/
│   └── models.dart              # User, Project, Attendance, DashboardData, etc.
├── providers/
│   ├── auth_provider.dart       # Login/logout/profile state
│   └── attendance_provider.dart # Dashboard, check-in/out, history, location
├── screens/
│   ├── login_screen.dart        # Company code + employee ID + password
│   ├── home_screen.dart         # Bottom nav (Home, Attendance, Leave, Profile)
│   ├── dashboard_tab.dart       # Today's status + check-in/out + stats
│   ├── project_selection_screen.dart  # Pick project before check-in
│   ├── check_in_camera_screen.dart    # Front camera selfie + GPS
│   ├── working_session_screen.dart    # Live timer + check-out
│   ├── check_out_camera_screen.dart   # Front camera selfie + GPS
│   ├── attendance_history_tab.dart    # Paginated history
│   ├── leave_tab.dart           # Leave requests + create form
│   └── profile_tab.dart         # Employee info + logout
└── widgets/
    └── (reusable widgets)
```

## Setup

```bash
# Install dependencies
flutter pub get

# Run on Android emulator or device
flutter run

# Build APK
flutter build apk --release
```

## Design

- **Primary color**: #2563EB (blue)
- **Dark navy**: #0F172A
- **Background**: #F8FAFC
- **Font**: Inter (Google Fonts)
- **Material 3** design system
- Clean, modern SaaS aesthetic matching the web admin dashboard

## Screens

1. **Login** — gradient background (navy → blue), white login card with employee ID and password
2. **Dashboard** — greeting + date, status card with live timer, check-in/out button, quick stats (3 cards), assigned project, recent attendance
3. **Project Selection** — list of assigned projects with geofence radius
4. **Check-In Camera** — full-screen front camera with face guide circle, capture button, preview + retake/confirm
5. **Working Session** — pulsing green dot, "WORKING" label, large timer, project info, geofence status, CHECK OUT button
6. **Check-Out Camera** — same as check-in but with red accent + "Check Out" button
7. **Attendance History** — paginated list with status icons, times, working hours
8. **Leave** — list of requests + create dialog with type dropdown + date pickers + reason
9. **Profile** — avatar with initials, name, email, role badge, info cards, settings, logout button
