"use client";

import { useEffect, useState } from "react";
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

export function useRealtimeUpdates(channel: string, onUpdate: (data: any) => void) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const onConnect = () => {
      setConnected(true);
      s.emit("subscribe", channel);
    };
    const onDisconnect = () => setConnected(false);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("live-update", onUpdate);

    if (s.connected) {
      Promise.resolve().then(() => setConnected(true));
      s.emit("subscribe", channel);
    }

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("live-update", onUpdate);
      s.emit("unsubscribe", channel);
    };
  }, [channel, onUpdate]);

  return connected;
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
