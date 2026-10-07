// User model — comes back from `/auth/login`, `/auth/me`, `/mobile/profile`.
class User {
  final String id;
  final String? employeeId;
  final String name;
  final String email;
  final String role;
  final String? companyId;
  final String? companyName;
  final String? companyCode;
  final String? timezone;
  final String? designation;
  final String? department;
  final String? phone;
  final String? avatarColor;
  final String? avatarUrl;
  final String? status;

  User({
    required this.id,
    this.employeeId,
    required this.name,
    required this.email,
    required this.role,
    this.companyId,
    this.companyName,
    this.companyCode,
    this.timezone,
    this.designation,
    this.department,
    this.phone,
    this.avatarColor,
    this.avatarUrl,
    this.status,
  });

  factory User.fromJson(Map<String, dynamic> j) {
    final employee = (j['employee'] as Map<String, dynamic>?) ?? const {};
    final company = (j['company'] as Map<String, dynamic>?) ??
        (employee['company'] as Map<String, dynamic>?) ??
        const {};
    return User(
      id: (j['id'] as String?) ?? '',
      employeeId: (j['employeeId'] as String?) ?? (employee['employeeId'] as String?),
      name: (j['name'] as String?) ?? '',
      email: (j['email'] as String?) ?? '',
      role: (j['role'] as String?) ?? 'EMPLOYEE',
      companyId: (j['companyId'] as String?) ?? (employee['id'] as String?),
      companyName: (j['companyName'] as String?) ?? (company['name'] as String?),
      companyCode: (company['code'] as String?),
      timezone: (company['timezone'] as String?) ?? 'Asia/Karachi',
      designation: (employee['designation'] as String?),
      department: (employee['department'] as String?),
      phone: (employee['phone'] as String?),
      avatarColor: (j['avatarColor'] as String?) ?? (employee['avatarColor'] as String?),
      avatarUrl: (j['avatarUrl'] as String?) ?? (employee['avatarUrl'] as String?),
      status: (employee['status'] as String?) ?? (j['status'] as String?),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'employeeId': employeeId,
        'name': name,
        'email': email,
        'role': role,
        'companyId': companyId,
        'companyName': companyName,
        'companyCode': companyCode,
        'timezone': timezone,
        'designation': designation,
        'department': department,
        'phone': phone,
        'avatarColor': avatarColor,
        'avatarUrl': avatarUrl,
        'status': status,
      };

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}

/// Extended employee profile from `/mobile/profile`.
class EmployeeProfile {
  final String id;
  final String employeeId;
  final String firstName;
  final String lastName;
  final String? email;
  final String? phone;
  final String? department;
  final String? designation;
  final String status;
  final String? avatarColor;
  final String? avatarUrl;
  final String? companyName;
  final String? companyCode;
  final String? timezone;
  final List<ProfileProject> projects;

  EmployeeProfile({
    required this.id,
    required this.employeeId,
    required this.firstName,
    required this.lastName,
    this.email,
    this.phone,
    this.department,
    this.designation,
    required this.status,
    this.avatarColor,
    this.avatarUrl,
    this.companyName,
    this.companyCode,
    this.timezone,
    this.projects = const [],
  });

  factory EmployeeProfile.fromJson(Map<String, dynamic> j) {
    final company = (j['company'] as Map<String, dynamic>?) ?? const {};
    final projects = (j['projects'] as List? ?? [])
        .map((e) => ProfileProject.fromJson(e as Map<String, dynamic>))
        .toList();
    return EmployeeProfile(
      id: (j['id'] as String?) ?? '',
      employeeId: (j['employeeId'] as String?) ?? '',
      firstName: (j['firstName'] as String?) ?? '',
      lastName: (j['lastName'] as String?) ?? '',
      email: j['email'] as String?,
      phone: j['phone'] as String?,
      department: j['department'] as String?,
      designation: j['designation'] as String?,
      status: (j['status'] as String?) ?? 'ACTIVE',
      avatarColor: j['avatarColor'] as String?,
      avatarUrl: j['avatarUrl'] as String?,
      companyName: company['name'] as String?,
      companyCode: company['code'] as String?,
      timezone: company['timezone'] as String?,
      projects: projects,
    );
  }

  String get fullName => '$firstName $lastName'.trim();
  String get initials =>
      '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'
          .toUpperCase();
}

class ProfileProject {
  final String id;
  final String name;
  final String? code;
  ProfileProject({required this.id, required this.name, this.code});

  factory ProfileProject.fromJson(Map<String, dynamic> j) => ProfileProject(
        id: (j['id'] as String?) ?? '',
        name: (j['name'] as String?) ?? '',
        code: j['code'] as String?,
      );
}
