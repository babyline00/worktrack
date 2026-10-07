"use client";

import { useEffect, useState, useRef } from "react";
import { Crosshair, Layers, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

// Lazy-load leaflet
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

const LAYERS: Record<string, { name: string; url: string; attribution: string; maxZoom: number }> = {
  street: { name: "Street", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '&copy; OpenStreetMap', maxZoom: 19 },
  satellite: { name: "Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Esri", maxZoom: 19 },
};

function makeProjectIcon() {
  return L.divIcon({
    className: "wt-project-marker",
    html: `<div style="position:relative;width:36px;height:36px;"><span style="position:absolute;inset:-8px;border-radius:50%;background:#2563eb;opacity:0.2;animation:wt-pulse 3s ease-in-out infinite;"></span><div style="position:relative;background:#2563eb;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="transform:rotate(45deg)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

// Click handler component — adds click event to map
function MapClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  const map = RL.useMap();
  useEffect(() => {
    function handleClick(e: any) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    }
    map.on("click", handleClick);
    return () => map.off("click", handleClick);
  }, [map, onLocationChange]);
  return null;
}

// Draggable marker
function DraggableMarker({ position, onDragEnd }: { position: [number, number]; onDragEnd: (lat: number, lng: number) => void }) {
  const markerRef = useRef<any>(null);
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.on("dragend", (e: any) => {
        const ll = e.target.getLatLng();
        onDragEnd(ll.lat, ll.lng);
      });
    }
  }, [onDragEnd]);
  return (
    <RL.Marker
      ref={markerRef}
      position={position}
      icon={makeProjectIcon()}
      draggable
    >
      <RL.Popup>
        <div style={{ minWidth: 140 }}>
          <strong>Project Location</strong>
          <br />
          <span style={{ fontSize: 11, color: "#64748b" }}>{position[0].toFixed(5)}, {position[1].toFixed(5)}</span>
          <br />
          <span style={{ fontSize: 10, color: "#94a3b8" }}>Drag to reposition</span>
        </div>
      </RL.Popup>
    </RL.Marker>
  );
}

export function MapLocationPicker({
  lat,
  lng,
  radius,
  onLocationChange,
}: {
  lat: string;
  lng: string;
  radius: number;
  onLocationChange: (lat: number, lng: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [layer, setLayer] = useState("street");
  const [layerOpen, setLayerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);

  useEffect(() => { loadLeaflet().then(() => setLoaded(true)); }, []);

  const hasCoords = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
  const center: [number, number] = hasCoords
    ? [parseFloat(lat), parseFloat(lng)]
    : [25.2048, 55.2708];

  // Use a ref to track the latest callback to avoid re-registering map events
  const callbackRef = useRef(onLocationChange);
  useEffect(() => { callbackRef.current = onLocationChange; }, [onLocationChange]);

  function handleLocate() {
    if (!mapInstance || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      mapInstance.setView(ll, 16);
      callbackRef.current(pos.coords.latitude, pos.coords.longitude);
    });
  }

  if (!loaded) {
    return <div className="h-[300px] rounded-lg bg-muted animate-pulse" />;
  }

  const { MapContainer, TileLayer, Circle, ScaleControl } = RL;

  return (
    <div ref={containerRef} className="relative h-[300px] overflow-hidden rounded-lg border border-border">
      <style>{`@keyframes wt-pulse { 0%,100% { transform: scale(1); opacity: 0.2; } 50% { transform: scale(1.5); opacity: 0.05; } }`}</style>
      <MapContainer
        center={center}
        zoom={hasCoords ? 15 : 10}
        style={{ height: "100%", width: "100%", background: "#e5e7eb", cursor: "crosshair" }}
        scrollWheelZoom
        zoomControl={false}
      >
        <ScaleControl position="bottomright" imperial={false} />
        <RL.ZoomControl position="topright" />
        <MapClickHandler onLocationChange={(lat, lng) => callbackRef.current(lat, lng)} />

        <TileLayer key={layer} url={LAYERS[layer].url} attribution={LAYERS[layer].attribution} maxZoom={LAYERS[layer].maxZoom} />

        {/* Geofence circle */}
        {hasCoords && (
          <Circle
            center={[parseFloat(lat), parseFloat(lng)]}
            radius={radius}
            pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.1, weight: 2, dashArray: "6 4" }}
          />
        )}

        {/* Draggable marker */}
        {hasCoords && (
          <DraggableMarker
            position={[parseFloat(lat), parseFloat(lng)]}
            onDragEnd={(lat, lng) => callbackRef.current(lat, lng)}
          />
        )}
      </MapContainer>

      {/* Instructions overlay */}
      {!hasCoords && (
        <div className="absolute inset-0 z-[300] flex items-center justify-center bg-navy/5 backdrop-blur-[2px] pointer-events-none">
          <div className="rounded-lg bg-white/95 px-4 py-3 text-center shadow-lg">
            <MapPin size={24} className="mx-auto text-primary" />
            <p className="mt-1 text-sm font-medium text-navy">Click on the map to set project location</p>
            <p className="text-xs text-muted-foreground">Or use the "My Location" button</p>
          </div>
        </div>
      )}

      {/* Coordinates display */}
      {hasCoords && (
        <div className="absolute left-3 top-3 z-[400] rounded-lg border border-border bg-white/95 px-3 py-1.5 text-xs font-mono font-medium text-navy shadow-md backdrop-blur">
          📍 {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)} • R: {radius}m
        </div>
      )}

      {/* Locate me button */}
      <button
        onClick={handleLocate}
        className="absolute right-3 top-3 z-[400] flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-navy shadow-md transition hover:bg-muted"
        title="Use my current location"
      >
        <Crosshair size={16} />
      </button>

      {/* Layer toggle */}
      <div className="absolute right-3 bottom-3 z-[400]">
        {layerOpen && (
          <div className="mb-2 overflow-hidden rounded-lg border border-border bg-white shadow-md">
            {Object.keys(LAYERS).map((key) => (
              <button
                key={key}
                onClick={() => { setLayer(key); setLayerOpen(false); }}
                className={cn("block w-full px-4 py-2 text-left text-xs font-medium transition hover:bg-muted",
                  layer === key ? "bg-accent text-primary" : "text-navy")}
              >
                {LAYERS[key].name}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setLayerOpen(!layerOpen)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-medium text-navy shadow-md transition hover:bg-muted"
        >
          <Layers size={14} /> {LAYERS[layer].name}
        </button>
      </div>
    </div>
  );
}
