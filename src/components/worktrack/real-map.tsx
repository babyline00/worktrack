"use client";

import { useEffect, useState, useRef } from "react";
import { Crosshair, Maximize2, Minimize2, Layers, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

// Lazy-load leaflet only on client side (prevents SSR `window is not defined`)
let L: any = null;
let RL: any = null;
let leafletLoaded = false;

async function loadLeaflet() {
  if (leafletLoaded) return;
  const leaflet = await import("leaflet");
  await import("leaflet/dist/leaflet.css");
  const reactLeaflet = await import("react-leaflet");
  L = leaflet.default || leaflet;
  RL = reactLeaflet;
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
  leafletLoaded = true;
}

function makeAvatarIcon(initials: string, color: string, status?: string) {
  const pulse = status === "working"
    ? `<span style="position:absolute;inset:-4px;border-radius:50%;background:${color};opacity:0.3;animation:wt-pulse 2s ease-in-out infinite;"></span>`
    : "";
  return L.divIcon({
    className: "wt-marker",
    html: `<div style="position:relative;width:36px;height:36px;">${pulse}<div style="position:relative;background:${color};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);">${initials}</div></div>`,
    iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -18],
  });
}

function makeProjectIcon() {
  return L.divIcon({
    className: "wt-project-marker",
    html: `<div style="position:relative;width:32px;height:32px;"><span style="position:absolute;inset:-6px;border-radius:50%;background:#2563eb;opacity:0.2;animation:wt-pulse 3s ease-in-out infinite;"></span><div style="position:relative;background:#2563eb;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;border:3px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,0.3),0 2px 8px rgba(0,0,0,0.3);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div></div>`,
    iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16],
  });
}

const LAYERS: Record<string, { name: string; url: string; attribution: string; maxZoom: number }> = {
  street: { name: "Street", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 },
  satellite: { name: "Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles &copy; Esri", maxZoom: 19 },
  dark: { name: "Dark", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attribution: '&copy; CARTO', maxZoom: 19 },
  light: { name: "Light", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attribution: '&copy; CARTO', maxZoom: 19 },
};

export interface MapMarker {
  id: string; lat: number; lng: number; initials?: string; color?: string;
  label?: string; description?: string; status?: string; type?: "employee" | "project";
}
export interface MapGeofence { lat: number; lng: number; radiusM: number; name?: string; }

function FitBounds({ positions, manualCenter, manualZoom }: any) {
  const map = RL.useMap();
  const hasFit = useRef(false);
  useEffect(() => {
    if (hasFit.current || positions.length === 0) return;
    hasFit.current = true;
    if (positions.length === 1) map.setView(positions[0], 14);
    else map.fitBounds(L.latLngBounds(positions), { padding: [60, 60] });
  }, [positions, map]);
  useEffect(() => { if (manualCenter && manualZoom) map.setView(manualCenter, manualZoom); }, [manualCenter, manualZoom, map]);
  return null;
}

function MapBridge({ onReady }: any) {
  const map = RL.useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

export function RealMap({ markers, geofence, height = 480, center, zoom = 12, showControls = true, emptyMessage = "No employees are currently checked in." }: any) {
  const [layer, setLayer] = useState("street");
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [locating, setLocating] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const locateMarkerRef = useRef<any>(null);

  useEffect(() => { loadLeaflet().then(() => setLoaded(true)); }, []);

  const validMarkers = markers?.filter((m: MapMarker) => m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng)) ?? [];
  const positions: [number, number][] = validMarkers.map((m: MapMarker) => [m.lat, m.lng]);
  if (geofence) positions.push([geofence.lat, geofence.lng]);
  const fallbackCenter: [number, number] = center ?? positions[0] ?? [25.2048, 55.2708];
  const hasContent = validMarkers.length > 0 || geofence;

  function handleLocate() {
    if (!mapInstance || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      mapInstance.setView(latlng, 15);
      if (locateMarkerRef.current) locateMarkerRef.current.remove();
      locateMarkerRef.current = L.marker(latlng, { icon: L.divIcon({ className: "wt-locate", html: `<div style="width:20px;height:20px;border-radius:50%;background:#0ea5e9;border:3px solid #fff;box-shadow:0 0 0 6px rgba(14,165,233,0.3);"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(mapInstance);
      locateMarkerRef.current.bindPopup("<strong>Your location</strong><br/>±" + Math.round(pos.coords.accuracy) + "m");
      setLocating(false);
    }, () => setLocating(false), { enableHighAccuracy: true, timeout: 10000 });
  }

  function handleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  if (!loaded) return <div style={{ height: typeof height === "number" ? `${height}px` : height }} className="rounded-lg bg-muted animate-pulse" />;

  const { MapContainer, TileLayer, Marker, Popup, Circle, ScaleControl, ZoomControl } = RL;

  return (
    <div ref={containerRef} style={{ height: typeof height === "number" ? `${height}px` : height, width: "100%" }} className="relative overflow-hidden rounded-lg border border-border bg-muted">
      <style>{`@keyframes wt-pulse { 0%,100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.4); opacity: 0.1; } }`}</style>
      <MapContainer center={fallbackCenter} zoom={zoom} style={{ height: "100%", width: "100%", background: "#e5e7eb" }} scrollWheelZoom zoomControl={false}>
        <ZoomControl position="topright" />
        <ScaleControl position="bottomright" imperial={false} />
        <MapBridge onReady={setMapInstance} />
        <TileLayer key={layer} url={LAYERS[layer].url} attribution={LAYERS[layer].attribution} maxZoom={LAYERS[layer].maxZoom} />
        {geofence && (
          <>
            <Circle center={[geofence.lat, geofence.lng]} radius={geofence.radiusM} pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.08, weight: 2, dashArray: "6 4" }} />
            <Marker position={[geofence.lat, geofence.lng]} icon={makeProjectIcon()}>
              {geofence.name && <Popup><strong>{geofence.name}</strong><br/>Geofence: {geofence.radiusM}m</Popup>}
            </Marker>
          </>
        )}
        {validMarkers.map((m: MapMarker) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={m.type === "project" ? makeProjectIcon() : makeAvatarIcon(m.initials ?? "?", m.color ?? "#2563eb", m.status)}>
            {m.label && <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: m.color ?? "#2563eb", color: "#fff", fontSize: 11, fontWeight: 700 }}>{m.initials ?? "?"}</span>
                  <strong style={{ color: "#0f172a", fontSize: 14 }}>{m.label}</strong>
                </div>
                {m.description && <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{m.description}</div>}
                {m.status && <div style={{ marginTop: 6 }}><span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 500, textTransform: "capitalize", background: m.status === "working" ? "#dcfce7" : m.status === "late" || m.status === "break" ? "#fef3c7" : "#f1f5f9", color: m.status === "working" ? "#16a34a" : m.status === "late" || m.status === "break" ? "#f59e0b" : "#64748b" }}>{m.status.replace("_", " ")}</span></div>}
              </div>
            </Popup>}
          </Marker>
        ))}
        <FitBounds positions={positions} manualCenter={center} manualZoom={center ? zoom : undefined} />
      </MapContainer>
      {showControls && mapInstance && (
        <>
          <button onClick={handleLocate} className="absolute right-3 top-20 z-[400] flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-navy shadow-md transition hover:bg-muted" title="Find my location">
            {locating ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Crosshair size={16} />}
          </button>
          <button onClick={handleFullscreen} className="absolute right-3 top-32 z-[400] flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-navy shadow-md transition hover:bg-muted" title={isFs ? "Exit fullscreen" : "Fullscreen"}>
            {isFs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <div className="absolute right-3 bottom-10 z-[400]">
            {layerOpen && <div className="mb-2 overflow-hidden rounded-lg border border-border bg-white shadow-md">
              {Object.keys(LAYERS).map((key) => <button key={key} onClick={() => { setLayer(key); setLayerOpen(false); }} className={cn("block w-full px-4 py-2 text-left text-xs font-medium transition hover:bg-muted", layer === key ? "bg-accent text-primary" : "text-navy")}>{LAYERS[key].name}</button>)}
            </div>}
            <button onClick={() => setLayerOpen(!layerOpen)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-medium text-navy shadow-md transition hover:bg-muted" title="Change map layer"><Layers size={14} /> {LAYERS[layer].name}</button>
          </div>
          {(validMarkers.length > 0 || geofence) && (
            <div className="absolute bottom-3 left-3 z-[400] rounded-lg border border-border bg-white/95 p-3 text-xs shadow-md backdrop-blur">
              <p className="mb-2 font-semibold text-navy">Legend</p>
              <div className="space-y-1.5">
                {validMarkers.length > 0 && (<><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-success ring-2 ring-success/30" /><span className="text-muted-foreground">Working</span></div><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-warning ring-2 ring-warning/30" /><span className="text-muted-foreground">Late / Break</span></div><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-muted-foreground ring-2 ring-muted-foreground/30" /><span className="text-muted-foreground">Checked Out</span></div></>)}
                {geofence && <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-primary bg-primary/20" /><span className="text-muted-foreground">Project Geofence</span></div>}
              </div>
            </div>
          )}
        </>
      )}
      {validMarkers.length > 0 && <div className="absolute left-3 top-3 z-[400] rounded-lg border border-border bg-white/95 px-3 py-1.5 text-xs font-medium text-navy shadow-md backdrop-blur"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-success pulse-live" />{validMarkers.length} {validMarkers.length === 1 ? "employee" : "employees"} on map</div>}
      {!hasContent && <div className="absolute inset-0 z-[300] flex items-center justify-center bg-navy/5 backdrop-blur-sm"><div className="rounded-xl bg-white/95 p-6 text-center shadow-lg"><MapPin size={32} className="mx-auto text-muted-foreground/50" /><p className="mt-2 text-sm font-medium text-navy">No locations to display</p><p className="mt-1 text-xs text-muted-foreground">{emptyMessage}</p></div></div>}
    </div>
  );
}

export function LiveTrailMap({ trail, latestLocation, employeeName, employeeInitials, avatarColor, geofence, height = 400 }: any) {
  const [layer, setLayer] = useState("street");
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const polylineRef = useRef<any>(null);

  useEffect(() => { loadLeaflet().then(() => setLoaded(true)); }, []);

  const trailPositions: [number, number][] = trail?.filter((p: any) => p.latitude && p.longitude).map((p: any) => [p.latitude, p.longitude]) ?? [];
  const positions: [number, number][] = [...trailPositions];
  if (geofence) positions.push([geofence.lat, geofence.lng]);
  const fallbackCenter: [number, number] = latestLocation ? [latestLocation.latitude, latestLocation.longitude] : geofence ? [geofence.lat, geofence.lng] : trailPositions[0] ?? [25.2048, 55.2708];

  useEffect(() => {
    if (!mapInstance || trailPositions.length < 2) return;
    if (polylineRef.current) polylineRef.current.remove();
    polylineRef.current = L.polyline(trailPositions, { color: avatarColor, weight: 3, opacity: 0.7, dashArray: "8 4" }).addTo(mapInstance);
    return () => { polylineRef.current?.remove(); };
  }, [mapInstance, trailPositions, avatarColor]);

  if (!loaded) return <div style={{ height: typeof height === "number" ? `${height}px` : height }} className="rounded-lg bg-muted animate-pulse" />;

  const { MapContainer, TileLayer, Marker, Popup, Circle, ScaleControl, ZoomControl } = RL;

  return (
    <div ref={containerRef} style={{ height: typeof height === "number" ? `${height}px` : height, width: "100%" }} className="relative overflow-hidden rounded-lg border border-border bg-muted">
      <style>{`@keyframes wt-pulse { 0%,100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.4); opacity: 0.1; } }`}</style>
      <MapContainer center={fallbackCenter} zoom={15} style={{ height: "100%", width: "100%", background: "#e5e7eb" }} scrollWheelZoom zoomControl={false}>
        <ZoomControl position="topright" />
        <ScaleControl position="bottomright" imperial={false} />
        <MapBridge onReady={setMapInstance} />
        <TileLayer key={layer} url={LAYERS[layer].url} attribution={LAYERS[layer].attribution} maxZoom={LAYERS[layer].maxZoom} />
        {geofence && (<><Circle center={[geofence.lat, geofence.lng]} radius={geofence.radiusM} pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.08, weight: 2, dashArray: "6 4" }} /><Marker position={[geofence.lat, geofence.lng]} icon={makeProjectIcon()}>{geofence.name && <Popup><strong>{geofence.name}</strong><br/>Geofence: {geofence.radiusM}m</Popup>}</Marker></>)}
        {trailPositions.length > 0 && <Marker position={trailPositions[0]} icon={L.divIcon({ className: "wt-trail-start", html: `<div style="width:14px;height:14px;border-radius:50%;background:#16a34a;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] })}><Popup><strong>Trail start</strong><br/>{new Date(trail[0].recordedAt).toLocaleTimeString()}</Popup></Marker>}
        {latestLocation && latestLocation.latitude && <Marker position={[latestLocation.latitude, latestLocation.longitude]} icon={makeAvatarIcon(employeeInitials, avatarColor, "working")}><Popup><div style={{ minWidth: 160 }}><strong style={{ color: "#0f172a", fontSize: 14 }}>{employeeName}</strong><div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Latest • {new Date(latestLocation.recordedAt).toLocaleTimeString()}</div>{latestLocation.insideGeofence !== undefined && <div style={{ marginTop: 6, fontSize: 11 }}><span style={{ color: latestLocation.insideGeofence ? "#16a34a" : "#dc2626" }}>{latestLocation.insideGeofence ? "✓ Inside geofence" : "✗ Outside"}{latestLocation.distanceFromProject != null && ` (${latestLocation.distanceFromProject}m)`}</span></div>}</div></Popup></Marker>}
        <FitBounds positions={positions} />
      </MapContainer>
      {mapInstance && <div className="absolute right-3 bottom-10 z-[400]">{layerOpen && <div className="mb-2 overflow-hidden rounded-lg border border-border bg-white shadow-md">{Object.keys(LAYERS).map((key) => <button key={key} onClick={() => { setLayer(key); setLayerOpen(false); }} className={cn("block w-full px-4 py-2 text-left text-xs font-medium transition hover:bg-muted", layer === key ? "bg-accent text-primary" : "text-navy")}>{LAYERS[key].name}</button>)}</div>}<button onClick={() => setLayerOpen(!layerOpen)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-medium text-navy shadow-md transition hover:bg-muted" title="Change map layer"><Layers size={14} /> {LAYERS[layer].name}</button></div>}
      {trailPositions.length > 0 && <div className="absolute left-3 top-3 z-[400] rounded-lg border border-border bg-white/95 px-3 py-1.5 text-xs font-medium text-navy shadow-md backdrop-blur"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-success pulse-live" />{trailPositions.length} location points</div>}
      {trailPositions.length === 0 && !geofence && <div className="absolute inset-0 z-[300] flex items-center justify-center bg-navy/5 backdrop-blur-sm"><div className="rounded-xl bg-white/95 p-6 text-center shadow-lg"><MapPin size={32} className="mx-auto text-muted-foreground/50" /><p className="mt-2 text-sm font-medium text-navy">No location data</p><p className="mt-1 text-xs text-muted-foreground">No live location updates recorded.</p></div></div>}
    </div>
  );
}
