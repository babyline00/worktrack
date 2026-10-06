// WorkTrack mock data store — single source of truth for the dashboard demo.

export type AttendanceStatus =
  | "working"
  | "break"
  | "checked_out"
  | "absent"
  | "late"
  | "leave";

export type VerificationStatus = "verified" | "pending" | "rejected";

export interface Employee {
  id: string;
  empId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  projects: string[]; // project ids
  status: "active" | "inactive";
  avatarColor: string;
  initials: string;
  // Today's live data
  todaysStatus: AttendanceStatus;
  checkIn?: string; // "10:32 AM"
  checkOut?: string;
  workingTimeMins: number;
  project: string;
  location: string;
  accuracyM?: number;
  coords: { lat: number; lng: number };
  lastUpdatedSec: number;
  photoCaptured: boolean;
  insideGeofence: boolean;
  // Monthly stats
  presentThisMonth: number;
  lateThisMonth: number;
  totalHours: number; // hrs
  attendanceRate: number; // %
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  description: string;
  status: "active" | "paused" | "completed";
  location: string;
  coords: { lat: number; lng: number };
  radiusM: number;
  startDate: string;
  endDate?: string;
  totalEmployees: number;
  presentToday: number;
  workingNow: number;
  lateToday: number;
  absentToday: number;
}

export interface AttendanceRow {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  avatarColor: string;
  project: string;
  checkIn: string;
  checkOut?: string;
  hoursMins: string;
  status: AttendanceStatus;
  verification: VerificationStatus;
  location: string;
  coords: { lat: number; lng: number };
  accuracyM: number;
  photoCheckIn: boolean;
  photoCheckOut: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  avatarColor: string;
  type: "Annual" | "Sick" | "Unpaid" | "Emergency";
  from: string;
  to: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

export interface Shift {
  id: string;
  name: string;
  start: string;
  end: string;
  graceMins: number;
  breakMins: number;
  workingDays: string[];
  employees: number;
}

export interface NotificationItem {
  id: string;
  type: "attendance" | "leave" | "system" | "alert";
  title: string;
  description: string;
  timeAgo: string;
  unread: boolean;
}

export interface AlertItem {
  id: string;
  severity: "warning" | "danger" | "info";
  title: string;
  description: string;
  employee?: string;
}

const AVATAR_COLORS = [
  "#2563eb",
  "#0ea5e9",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
];

function initialsFromName(first: string, last: string) {
  return (first[0] ?? "") + (last[0] ?? "");
}

const FIRST_NAMES = [
  "Ahmad",
  "Ali",
  "Hamza",
  "Bilal",
  "Usman",
  "Sana",
  "Ayesha",
  "Hassan",
  "Faisal",
  "Imran",
  "Rehan",
  "Kashif",
  "Zain",
  "Saad",
  "Junaid",
  "Nida",
  "Mariam",
  "Tariq",
  "Adnan",
  "Yasir",
];
const LAST_NAMES = [
  "Khan",
  "Raza",
  "Ahmed",
  "Malik",
  "Sheikh",
  "Iqbal",
  "Aslam",
  "Hussain",
  "Butt",
  "Cheema",
  "Tariq",
  "Shah",
  "Siddiqui",
  "Mughal",
  "Ansari",
];

const DEPARTMENTS = [
  "Marketing",
  "Engineering",
  "Operations",
  "Field",
  "Sales",
  "Finance",
  "HR",
];
const DESIGNATIONS = [
  "Marketing Executive",
  "Site Engineer",
  "Field Officer",
  "Project Coordinator",
  "Sales Executive",
  "Accountant",
  "HR Officer",
  "Technician",
];

export const PROJECTS: Project[] = [
  {
    id: "p1",
    code: "DHT-001",
    name: "Dubai Home Technical",
    client: "Dubai Properties",
    description: "Technical maintenance & decor for residential units.",
    status: "active",
    location: "Dubai, UAE",
    coords: { lat: 25.2048, lng: 55.2708 },
    radiusM: 200,
    startDate: "2026-09-01",
    totalEmployees: 20,
    presentToday: 18,
    workingNow: 15,
    lateToday: 3,
    absentToday: 2,
  },
  {
    id: "p2",
    code: "ABC-002",
    name: "ABC Construction",
    client: "ABC Group",
    description: "On-site construction supervision & labour attendance.",
    status: "active",
    location: "Sharjah, UAE",
    coords: { lat: 25.3463, lng: 55.4209 },
    radiusM: 250,
    startDate: "2026-08-15",
    totalEmployees: 15,
    presentToday: 12,
    workingNow: 10,
    lateToday: 1,
    absentToday: 3,
  },
  {
    id: "p3",
    code: "CXY-003",
    name: "Client XYZ",
    client: "XYZ Holdings",
    description: "Maintenance contract for retail outlets.",
    status: "active",
    location: "Abu Dhabi, UAE",
    coords: { lat: 24.4539, lng: 54.3773 },
    radiusM: 150,
    startDate: "2026-07-20",
    totalEmployees: 10,
    presentToday: 7,
    workingNow: 6,
    lateToday: 1,
    absentToday: 3,
  },
  {
    id: "p4",
    code: "MNT-004",
    name: "Marina Maintenance",
    client: "Marina Towers",
    description: "Annual maintenance & inspection services.",
    status: "active",
    location: "Dubai Marina, UAE",
    coords: { lat: 25.0805, lng: 55.1403 },
    radiusM: 200,
    startDate: "2026-06-01",
    totalEmployees: 3,
    presentToday: 2,
    workingNow: 1,
    lateToday: 1,
    absentToday: 1,
  },
];

const today = "06 Oct 2026";

function makeEmployees(): Employee[] {
  const out: Employee[] = [];
  const presentStatuses: AttendanceStatus[] = [
    "working",
    "working",
    "working",
    "working",
    "break",
    "late",
    "checked_out",
  ];
  let counter = 0;
  for (let i = 0; i < 48; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const proj = PROJECTS[i % PROJECTS.length];
    const status: AttendanceStatus =
      i % 6 === 0
        ? "absent"
        : i % 11 === 0
          ? "leave"
          : presentStatuses[counter % presentStatuses.length];
    counter++;
    const checkIn =
      status === "absent" || status === "leave"
        ? undefined
        : `${9 + (i % 3)}:${(i * 7) % 60 < 10 ? "0" : ""}${(i * 7) % 60} ${i % 2 === 0 ? "AM" : "AM"}`;
    const workingMins =
      status === "working"
        ? 200 + (i % 300)
        : status === "break"
          ? 180 + (i % 100)
          : status === "late"
            ? 90 + (i % 60)
            : status === "checked_out"
              ? 460
              : 0;
    out.push({
      id: `e${i + 1}`,
      empId: String(2585436360 + i),
      firstName: first,
      lastName: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@worktrack.io`,
      phone: `+971 5${(i % 9)} ${100 + i} ${1000 + i * 7}`,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      designation: DESIGNATIONS[i % DESIGNATIONS.length],
      projects: [proj.id, ...(i % 4 === 0 ? [PROJECTS[(i + 1) % 4].id] : [])],
      status: i % 17 === 0 ? "inactive" : "active",
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      initials: initialsFromName(first, last),
      todaysStatus: status,
      checkIn,
      checkOut: status === "checked_out" ? "06:14 PM" : undefined,
      workingTimeMins: workingMins,
      project: proj.name,
      location: proj.location,
      accuracyM: 5 + (i % 20),
      coords: {
        lat: proj.coords.lat + (Math.random() - 0.5) * 0.05,
        lng: proj.coords.lng + (Math.random() - 0.5) * 0.05,
      },
      lastUpdatedSec: i * 4 + 5,
      photoCaptured: i % 13 !== 0,
      insideGeofence: i % 19 !== 0,
      presentThisMonth: 18 + (i % 6),
      lateThisMonth: i % 8,
      totalHours: 160 + (i % 40),
      attendanceRate: 80 + (i % 18),
    });
  }
  return out;
}

export const EMPLOYEES: Employee[] = makeEmployees();

export const KPIS = {
  totalEmployees: EMPLOYEES.length,
  present: EMPLOYEES.filter((e) => e.todaysStatus !== "absent" && e.todaysStatus !== "leave").length,
  workingNow: EMPLOYEES.filter((e) => e.todaysStatus === "working").length,
  absent: EMPLOYEES.filter((e) => e.todaysStatus === "absent").length,
  late: EMPLOYEES.filter((e) => e.todaysStatus === "late").length,
  leave: EMPLOYEES.filter((e) => e.todaysStatus === "leave").length,
  onBreak: EMPLOYEES.filter((e) => e.todaysStatus === "break").length,
  checkedOut: EMPLOYEES.filter((e) => e.todaysStatus === "checked_out").length,
};

export function presentPct() {
  return Math.round((KPIS.present / KPIS.totalEmployees) * 1000) / 10;
}

// Live attendance rows (today)
export const LIVE_ATTENDANCE: AttendanceRow[] = EMPLOYEES.filter(
  (e) => e.todaysStatus !== "absent" && e.todaysStatus !== "leave",
).map((e, i) => ({
  id: `a${i + 1}`,
  date: today,
  employeeId: e.empId,
  employeeName: `${e.firstName} ${e.lastName}`,
  employeeInitials: e.initials,
  avatarColor: e.avatarColor,
  project: e.project,
  checkIn: e.checkIn ?? "—",
  checkOut: e.checkOut,
  hoursMins: formatMins(e.workingTimeMins),
  status: e.todaysStatus,
  verification: e.photoCaptured ? "verified" : "pending",
  location: e.location,
  coords: e.coords,
  accuracyM: e.accuracyM ?? 12,
  photoCheckIn: e.photoCaptured,
  photoCheckOut: !!e.checkOut,
}));

export function formatMins(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export const ALERTS: AlertItem[] = [
  {
    id: "al1",
    severity: "warning",
    title: "Ahmad checked in 42 minutes late",
    description: "Dubai Home Technical • Expected 09:00 AM, checked in 09:42 AM",
    employee: "Ahmad",
  },
  {
    id: "al2",
    severity: "warning",
    title: "3 employees haven't checked out",
    description: "Shift ended at 06:00 PM — checkout pending",
  },
  {
    id: "al3",
    severity: "danger",
    title: "Ali is outside project geofence",
    description: "Currently 380m away from Dubai Home Technical site",
    employee: "Ali",
  },
  {
    id: "al4",
    severity: "warning",
    title: "2 employees have missing attendance photos",
    description: "Photo verification required at check-in",
  },
];

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    type: "attendance",
    title: "Ahmad checked in late",
    description: "09:42 AM — 42 minutes late",
    timeAgo: "5 min ago",
    unread: true,
  },
  {
    id: "n2",
    type: "attendance",
    title: "Ali checked out",
    description: "06:14 PM • 8h 14m worked",
    timeAgo: "18 min ago",
    unread: true,
  },
  {
    id: "n3",
    type: "alert",
    title: "3 employees absent",
    description: "Today's attendance is below target",
    timeAgo: "1 hour ago",
    unread: true,
  },
  {
    id: "n4",
    type: "leave",
    title: "New leave request",
    description: "Hamza requested 2 days annual leave",
    timeAgo: "2 hours ago",
    unread: false,
  },
  {
    id: "n5",
    type: "system",
    title: "Backup completed",
    description: "Daily database backup successful",
    timeAgo: "4 hours ago",
    unread: false,
  },
];

export const LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: "l1",
    employeeId: "e3",
    employeeName: "Hamza Khan",
    employeeInitials: "HK",
    avatarColor: AVATAR_COLORS[2],
    type: "Annual",
    from: "10 Oct 2026",
    to: "11 Oct 2026",
    days: 2,
    reason: "Family event out of city",
    status: "pending",
  },
  {
    id: "l2",
    employeeId: "e6",
    employeeName: "Sana Iqbal",
    employeeInitials: "SI",
    avatarColor: AVATAR_COLORS[5],
    type: "Sick",
    from: "07 Oct 2026",
    to: "07 Oct 2026",
    days: 1,
    reason: "Flu — medical certificate attached",
    status: "pending",
  },
  {
    id: "l3",
    employeeId: "e8",
    employeeName: "Hassan Raza",
    employeeInitials: "HR",
    avatarColor: AVATAR_COLORS[7],
    type: "Emergency",
    from: "08 Oct 2026",
    to: "09 Oct 2026",
    days: 2,
    reason: "Family emergency",
    status: "pending",
  },
  {
    id: "l4",
    employeeId: "e2",
    employeeName: "Ali Ahmed",
    employeeInitials: "AA",
    avatarColor: AVATAR_COLORS[1],
    type: "Annual",
    from: "01 Oct 2026",
    to: "03 Oct 2026",
    days: 3,
    reason: "Vacation",
    status: "approved",
  },
  {
    id: "l5",
    employeeId: "e4",
    employeeName: "Bilal Malik",
    employeeInitials: "BM",
    avatarColor: AVATAR_COLORS[4],
    type: "Unpaid",
    from: "20 Sep 2026",
    to: "22 Sep 2026",
    days: 3,
    reason: "Personal work",
    status: "rejected",
  },
];

export const SHIFTS: Shift[] = [
  {
    id: "s1",
    name: "Morning Shift",
    start: "09:00 AM",
    end: "05:00 PM",
    graceMins: 15,
    breakMins: 45,
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    employees: 32,
  },
  {
    id: "s2",
    name: "Night Shift",
    start: "06:00 PM",
    end: "03:00 AM",
    graceMins: 10,
    breakMins: 45,
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    employees: 10,
  },
  {
    id: "s3",
    name: "Flexible",
    start: "Variable",
    end: "Variable",
    graceMins: 0,
    breakMins: 60,
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    employees: 6,
  },
];

// Attendance trend (last 7 days, percentage)
export const ATTENDANCE_TREND_7D = [
  { label: "Mon", value: 92 },
  { label: "Tue", value: 88 },
  { label: "Wed", value: 94 },
  { label: "Thu", value: 79 },
  { label: "Fri", value: 85 },
  { label: "Sat", value: 73 },
  { label: "Sun", value: 77 },
];

export const ATTENDANCE_TREND_30D = Array.from({ length: 30 }, (_, i) => ({
  label: `D${i + 1}`,
  value: 70 + Math.round(Math.sin(i / 3) * 10 + 12 + (i % 5)),
}));

export const ATTENDANCE_TREND_3M = [
  { label: "Aug W1", value: 86 },
  { label: "Aug W2", value: 88 },
  { label: "Aug W3", value: 84 },
  { label: "Aug W4", value: 90 },
  { label: "Sep W1", value: 87 },
  { label: "Sep W2", value: 91 },
  { label: "Sep W3", value: 85 },
  { label: "Sep W4", value: 89 },
  { label: "Oct W1", value: 77 },
];

export const PROJECT_PERFORMANCE = PROJECTS.map((p) => ({
  id: p.id,
  name: p.name,
  present: p.presentToday,
  total: p.totalEmployees,
  pct: Math.round((p.presentToday / p.totalEmployees) * 100),
}));
