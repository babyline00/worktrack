// Server-safe realtime functions (no React hooks)
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (!socket) {
    socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 10000,
    });
  }
  return socket;
}

export function emitCheckin(data: { employeeId: string; employeeName: string }) {
  getSocket()?.emit("checkin", data);
}

export function emitCheckout(data: { employeeId: string; employeeName: string }) {
  getSocket()?.emit("checkout", data);
}

export function emitLeaveUpdate(data: any) {
  getSocket()?.emit("leave-update", data);
}
