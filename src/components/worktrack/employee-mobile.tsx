"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Camera,
  MapPin,
  Clock,
  LogIn,
  LogOut,
  CalendarHeart,
  CheckCircle2,
  AlertTriangle,
  Crosshair,
  Building2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { useCheckin, useCheckout, useMyAttendance, useCreateLeave, useEmployees } from "@/lib/hooks";
import { Avatar, Card } from "./ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MobileTab = "home" | "attendance" | "leave" | "profile";

export function EmployeeMobileView() {
  const { setView } = useApp();
  const { data: session } = useSession();
  const { data: empData } = useEmployees();
  const employee = empData?.employees.find((e) => e.id === (session?.user as any)?.employeeId);
  const { data: myAttendance } = useMyAttendance((session?.user as any)?.employeeId);
  const checkin = useCheckin();
  const checkout = useCheckout();

  const [tab, setTab] = useState<MobileTab>("home");
  const [cameraOpen, setCameraOpen] = useState<"checkin" | "checkout" | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const todayRecord = myAttendance?.[0];
  const isCheckedIn = !!todayRecord && !todayRecord.employeeName.includes("checked_out"); // any record means checked in
  const isCheckedOut = !!todayRecord?.checkOut;
  const workingMins = todayRecord ? parseHoursToMins(todayRecord.hoursMins) : 0;

  function getLocation() {
    setLocating(true);
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setLocating(false);
        toast.success("Location captured", { description: `Accuracy: ${Math.round(pos.coords.accuracy)}m` });
      },
      (err) => {
        setLocating(false);
        toast.error("Unable to get location", { description: err.message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function doCheckin(photo: string) {
    if (!location) {
      toast.error("Location required. Tap \u201cGet Location\u201d first.");
      return;
    }
    checkin.mutate({
      employeeId: (session?.user as any)?.employeeId,
      projectId: employee?.projectIds?.[0],
      lat: location.lat,
      lng: location.lng,
      accuracy: location.accuracy,
      photo,
      location: employee?.location,
    }, {
      onSuccess: () => {
        setCameraOpen(null);
        setTab("attendance");
      },
    });
  }

  function doCheckout(photo: string) {
    if (!location) {
      toast.error("Location required. Tap \u201cGet Location\u201d first.");
      return;
    }
    checkout.mutate({
      employeeId: (session?.user as any)?.employeeId,
      lat: location.lat,
      lng: location.lng,
      accuracy: location.accuracy,
      photo,
      location: employee?.location,
    }, {
      onSuccess: () => {
        setCameraOpen(null);
        setTab("attendance");
      },
    });
  }

  if (!employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-navy">Loading employee profile…</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => setView("admin")}>
            <ArrowLeft size={14} className="mr-2" /> Back to Admin
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-4">
        <button onClick={() => setView("admin")} className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          <ArrowLeft size={16} /> Admin
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="18" cy="17" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <span className="text-sm font-bold text-navy">WorkTrack</span>
        </div>
        <Avatar initials={employee.initials} color={employee.avatarColor} size={32} />
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {tab === "home" && (
          <div className="space-y-5 fade-in">
            {/* Greeting */}
            <div>
              <p className="text-sm text-muted-foreground">Hello,</p>
              <h1 className="text-2xl font-bold text-navy">{employee.firstName} {employee.lastName}</h1>
              <p className="text-xs text-muted-foreground">{employee.designation} • {employee.department}</p>
            </div>

            {/* Status card */}
            <Card className={cn("border-2", isCheckedIn && !isCheckedOut ? "border-success" : "border-border")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Today's Status</p>
                  <p className="mt-1 text-lg font-bold text-navy">
                    {isCheckedOut ? "Checked Out" : isCheckedIn ? "Working" : "Not Checked In"}
                  </p>
                  {isCheckedIn && (
                    <p className="text-xs text-muted-foreground">
                      Since {todayRecord?.checkIn} • {todayRecord?.hoursMins}
                    </p>
                  )}
                </div>
                <span className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full",
                  isCheckedOut ? "bg-muted text-muted-foreground" : isCheckedIn ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
                )}>
                  {isCheckedOut ? <LogOut size={20} /> : isCheckedIn ? <Clock size={20} /> : <LogIn size={20} />}
                </span>
              </div>
            </Card>

            {/* Action buttons */}
            <div className="space-y-3">
              {!isCheckedIn ? (
                <Button
                  size="lg"
                  className="w-full bg-success text-white hover:bg-success/90"
                  onClick={() => setCameraOpen("checkin")}
                >
                  <Camera size={18} className="mr-2" /> Check In
                </Button>
              ) : !isCheckedOut ? (
                <Button
                  size="lg"
                  variant="destructive"
                  className="w-full"
                  onClick={() => setCameraOpen("checkout")}
                >
                  <LogOut size={18} className="mr-2" /> Check Out
                </Button>
              ) : (
                <Card className="bg-success-soft p-4 text-center">
                  <CheckCircle2 size={32} className="mx-auto text-success" />
                  <p className="mt-2 text-sm font-medium text-navy">Your day is complete</p>
                  <p className="text-xs text-muted-foreground">Total: {todayRecord?.hoursMins}</p>
                </Card>
              )}

              {/* Location capture */}
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin size={14} className="text-primary" />
                    <div>
                      <p className="font-medium text-navy">
                        {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Location not captured"}
                      </p>
                      {location && <p className="text-xs text-muted-foreground">Accuracy: ±{location.accuracy}m</p>}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={getLocation} disabled={locating}>
                    {locating ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Crosshair size={14} className="mr-2" />}
                    {location ? "Update" : "Get Location"}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">This Month</p>
                <p className="mt-1 text-lg font-bold text-navy">{employee.presentThisMonth}</p>
                <p className="text-[10px] text-muted-foreground">Present</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Late</p>
                <p className="mt-1 text-lg font-bold text-warning">{employee.lateThisMonth}</p>
                <p className="text-[10px] text-muted-foreground">Times</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Rate</p>
                <p className="mt-1 text-lg font-bold text-success">{employee.attendanceRate}%</p>
                <p className="text-[10px] text-muted-foreground">Attendance</p>
              </Card>
            </div>

            {/* Project info */}
            <Card>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Assigned Project</p>
              <div className="flex items-start gap-2">
                <Building2 size={16} className="mt-0.5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-navy">{employee.project}</p>
                  <p className="text-xs text-muted-foreground">{employee.location}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {tab === "attendance" && (
          <div className="space-y-4 fade-in">
            <h2 className="text-lg font-bold text-navy">My Attendance</h2>
            {myAttendance && myAttendance.length > 0 ? (
              myAttendance.slice(0, 7).map((a: any) => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-navy">{a.date}</p>
                      <p className="text-xs text-muted-foreground">{a.project}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-navy">{a.checkIn} → {a.checkOut ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{a.hoursMins}</p>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="py-12 text-center">
                <CalendarHeart size={40} className="mx-auto text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium text-navy">No attendance records yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Your check-in/out history will appear here.</p>
              </Card>
            )}
          </div>
        )}

        {tab === "leave" && (
          <div className="space-y-4 fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy">Leave Requests</h2>
              <Button size="sm" onClick={() => setLeaveOpen(true)}>
                <CalendarHeart size={14} className="mr-2" /> Request Leave
              </Button>
            </div>
            <Card className="py-8 text-center">
              <CalendarHeart size={40} className="mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-navy">No active leave requests</p>
              <p className="mt-1 text-xs text-muted-foreground">Tap "Request Leave" to submit a new request.</p>
            </Card>
          </div>
        )}

        {tab === "profile" && (
          <div className="space-y-4 fade-in">
            <Card className="text-center">
              <Avatar initials={employee.initials} color={employee.avatarColor} size={64} />
              <h2 className="mt-3 text-lg font-bold text-navy">{employee.firstName} {employee.lastName}</h2>
              <p className="text-sm text-muted-foreground">{employee.empId}</p>
            </Card>
            <Card>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-navy">{employee.email ?? "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium text-navy">{employee.phone ?? "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Department</span>
                  <span className="font-medium text-navy">{employee.department ?? "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Designation</span>
                  <span className="font-medium text-navy">{employee.designation ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project</span>
                  <span className="font-medium text-navy">{employee.project}</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex max-w-md items-center justify-around border-t border-border bg-card px-2 py-2">
        {[
          { id: "home" as const, label: "Home", icon: Clock },
          { id: "attendance" as const, label: "Attendance", icon: CalendarHeart },
          { id: "leave" as const, label: "Leave", icon: LogOut },
          { id: "profile" as const, label: "Profile", icon: Building2 },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition", active ? "text-primary" : "text-muted-foreground")}>
              <Icon size={18} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Spacer for bottom nav */}
      <div className="h-16" />

      {/* Camera modal */}
      {cameraOpen && (
        <CameraCapture
          mode={cameraOpen}
          onClose={() => setCameraOpen(null)}
          onCapture={(photo) => {
            if (cameraOpen === "checkin") doCheckin(photo);
            else doCheckout(photo);
          }}
          loading={checkin.isPending || checkout.isPending}
        />
      )}

      {/* Leave request modal */}
      <LeaveRequestDialog open={leaveOpen} onOpenChange={setLeaveOpen} employeeId={(session?.user as any)?.employeeId} />
    </div>
  );
}

function CameraCapture({ mode, onClose, onCapture, loading }: { mode: "checkin" | "checkout"; onClose: () => void; onCapture: (photo: string) => void; loading: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }
      } catch (e: any) {
        setError(e.message ?? "Unable to access camera");
      }
    }
    startCamera();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    setCaptured(dataUrl);
    stream?.getTracks().forEach((t) => t.stop());
  }

  function retake() {
    setCaptured(null);
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }
      } catch (e: any) {
        setError(e.message ?? "Unable to access camera");
      }
    }
    startCamera();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera size={16} /> {mode === "checkin" ? "Check-In Photo" : "Check-Out Photo"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error ? (
            <div className="rounded-lg bg-danger-soft p-4 text-center">
              <AlertTriangle size={32} className="mx-auto text-danger" />
              <p className="mt-2 text-sm font-medium text-danger">Camera not available</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                You can still proceed without a photo. The verification will be marked as "Pending".
              </p>
              <Button className="mt-3" size="sm" onClick={() => onCapture("")}>Proceed without photo</Button>
            </div>
          ) : captured ? (
            <>
              <img src={captured} alt="Captured" className="w-full rounded-lg" />
              <canvas ref={canvasRef} className="hidden" />
            </>
          ) : (
            <>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-navy">
                <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
                <div className="absolute inset-0 border-4 border-white/30 rounded-lg" />
                <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-navy/60 px-2 py-1 text-[10px] text-white">
                  Position your face in the frame
                </p>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}

          <div className="flex gap-2">
            {!captured && !error && (
              <Button className="flex-1" onClick={capture}>
                <Camera size={14} className="mr-2" /> Capture Photo
              </Button>
            )}
            {captured && (
              <>
                <Button variant="outline" className="flex-1" onClick={retake} disabled={loading}>
                  <RefreshCw size={14} className="mr-2" /> Retake
                </Button>
                <Button className="flex-1" onClick={() => onCapture(captured)} disabled={loading}>
                  {loading && <Loader2 size={14} className="mr-2 animate-spin" />}
                  {mode === "checkin" ? "Check In" : "Check Out"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeaveRequestDialog({ open, onOpenChange, employeeId }: { open: boolean; onOpenChange: (v: boolean) => void; employeeId?: string }) {
  const createLeave = useCreateLeave();
  const [type, setType] = useState("ANNUAL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");

  function submit() {
    if (!from || !to) {
      toast.error("Please select dates");
      return;
    }
    createLeave.mutate({ employeeId, type, from, to, reason }, {
      onSuccess: () => {
        onOpenChange(false);
        setFrom(""); setTo(""); setReason("");
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Leave Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ANNUAL">Annual Leave</SelectItem>
                <SelectItem value="SICK">Sick Leave</SelectItem>
                <SelectItem value="UNPAID">Unpaid Leave</SelectItem>
                <SelectItem value="EMERGENCY">Emergency Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" /></div>
          </div>
          <div><Label>Reason</Label><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason for leave" className="mt-1" /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={createLeave.isPending}>
            {createLeave.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseHoursToMins(s: string): number {
  if (!s || s === "—") return 0;
  const m = s.match(/(\d+)h\s*(\d+)?m?/);
  if (!m) return 0;
  return parseInt(m[1] ?? "0") * 60 + parseInt(m[2] ?? "0");
}
