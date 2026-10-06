"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

// Fix default marker icon issue with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeAvatarIcon(initials: string, color: string) {
  return L.divIcon({
    className: "wt-marker",
    html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${initials}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function makeProjectIcon() {
  return L.divIcon({
    className: "wt-project-marker",
    html: `<div style="background:#2563eb;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,0.3),0 2px 8px rgba(0,0,0,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
    } else {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  initials?: string;
  color?: string;
  label?: string;
  description?: string;
  type?: "employee" | "project";
}

export interface MapGeofence {
  lat: number;
  lng: number;
  radiusM: number;
  name?: string;
}

export function RealMap({
  markers,
  geofence,
  height = 480,
  center,
  zoom = 12,
}: {
  markers: MapMarker[];
  geofence?: MapGeofence;
  height?: number | string;
  center?: [number, number];
  zoom?: number;
}) {
  const positions: [number, number][] = markers
    .filter((m) => m.lat && m.lng)
    .map((m) => [m.lat, m.lng]);
  if (geofence) positions.push([geofence.lat, geofence.lng]);

  const fallbackCenter: [number, number] = center ?? positions[0] ?? [25.2048, 55.2708];

  return (
    <div
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        width: "100%",
      }}
      className="overflow-hidden rounded-lg"
    >
      <MapContainer
        center={fallbackCenter}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geofence && (
          <>
            <Circle
              center={[geofence.lat, geofence.lng]}
              radius={geofence.radiusM}
              pathOptions={{
                color: "#2563eb",
                fillColor: "#2563eb",
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
            <Marker position={[geofence.lat, geofence.lng]} icon={makeProjectIcon()}>
              {geofence.name && (
                <Popup>
                  <strong>{geofence.name}</strong>
                  <br />
                  Geofence: {geofence.radiusM}m
                </Popup>
              )}
            </Marker>
          </>
        )}

        {markers
          .filter((m) => m.lat && m.lng)
          .map((m) => (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={
                m.type === "project"
                  ? makeProjectIcon()
                  : makeAvatarIcon(m.initials ?? "?", m.color ?? "#2563eb")
              }
            >
              {m.label && (
                <Popup>
                  <strong>{m.label}</strong>
                  {m.description && (
                    <>
                      <br />
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {m.description}
                      </span>
                    </>
                  )}
                </Popup>
              )}
            </Marker>
          ))}

        <FitBounds positions={positions} />
      </MapContainer>
    </div>
  );
}
