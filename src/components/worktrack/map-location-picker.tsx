"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Crosshair, Layers, MapPin, Search, X, Loader2 } from "lucide-react";
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

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

// Nominatim geocoding (OpenStreetMap's free geocoding service)
async function searchLocations(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// Reverse geocoding — get place name from coordinates
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data.display_name || data.address?.city || data.address?.town || data.address?.village || "";
  } catch {
    return "";
  }
}

function MapClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  const map = RL.useMap();
  const cbRef = useRef(onLocationChange);
  useEffect(() => { cbRef.current = onLocationChange; }, [onLocationChange]);
  useEffect(() => {
    function handleClick(e: any) { cbRef.current(e.latlng.lat, e.latlng.lng); }
    map.on("click", handleClick);
    return () => map.off("click", handleClick);
  }, [map]);
  return null;
}

// Component that centers map when coords change externally
function MapController({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = RL.useMap();
  useEffect(() => {
    if (center && center[0] !== 0 && center[1] !== 0) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

function DraggableMarker({ position, onDragEnd }: { position: [number, number]; onDragEnd: (lat: number, lng: number) => void }) {
  const markerRef = useRef<any>(null);
  const cbRef = useRef(onDragEnd);
  useEffect(() => { cbRef.current = onDragEnd; }, [onDragEnd]);
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.on("dragend", (e: any) => {
        const ll = e.target.getLatLng();
        cbRef.current(ll.lat, ll.lng);
      });
    }
  }, []);
  return (
    <RL.Marker ref={markerRef} position={position} icon={makeProjectIcon()} draggable>
      <RL.Popup>
        <div style={{ minWidth: 140 }}>
          <strong>Project Location</strong><br />
          <span style={{ fontSize: 11, color: "#64748b" }}>{position[0].toFixed(5)}, {position[1].toFixed(5)}</span><br />
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
  noLimit,
  onLocationChange,
  onLocationNameChange,
  onRadiusChange,
  onNoLimitChange,
}: {
  lat: string;
  lng: string;
  radius: number;
  noLimit: boolean;
  onLocationChange: (lat: number, lng: number) => void;
  onLocationNameChange?: (name: string) => void;
  onRadiusChange?: (r: number) => void;
  onNoLimitChange?: (v: boolean) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [layer, setLayer] = useState("street");
  const [layerOpen, setLayerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // External centering state (when user selects from search or GPS)
  const [externalCenter, setExternalCenter] = useState<[number, number] | null>(null);
  const [externalZoom, setExternalZoom] = useState(15);

  useEffect(() => { loadLeaflet().then(() => setLoaded(true)); }, []);

  const hasCoords = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
  const currentCenter: [number, number] = hasCoords
    ? [parseFloat(lat), parseFloat(lng)]
    : [25.2048, 55.2708];

  // Debounced search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 3) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchLocations(query);
      setSearchResults(results);
      setSearching(false);
      setShowResults(true);
    }, 500);
  }, []);

  // Select a search result — center map + set coords + set location name
  const selectSearchResult = useCallback(async (result: SearchResult) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    onLocationChange(newLat, newLng);
    if (onLocationNameChange) {
      // Use the display_name but shorten it
      const shortName = result.display_name.split(",").slice(0, 3).join(", ");
      onLocationNameChange(shortName);
    }
    setExternalCenter([newLat, newLng]);
    setExternalZoom(16);
    setShowResults(false);
    setSearchQuery("");
  }, [onLocationChange, onLocationNameChange]);

  // Handle map click — also reverse geocode to get place name
  const handleMapClick = useCallback(async (newLat: number, newLng: number) => {
    onLocationChange(newLat, newLng);
    if (onLocationNameChange) {
      const name = await reverseGeocode(newLat, newLng);
      if (name) onLocationNameChange(name);
    }
    setExternalCenter([newLat, newLng]);
    setExternalZoom(16);
  }, [onLocationChange, onLocationNameChange]);

  // Handle GPS locate
  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const newLat = pos.coords.latitude;
      const newLng = pos.coords.longitude;
      onLocationChange(newLat, newLng);
      if (onLocationNameChange) {
        const name = await reverseGeocode(newLat, newLng);
        if (name) onLocationNameChange(name);
      }
      setExternalCenter([newLat, newLng]);
      setExternalZoom(16);
    });
  }, [onLocationChange, onLocationNameChange]);

  if (!loaded) {
    return <div className="h-[350px] rounded-lg bg-muted animate-pulse" />;
  }

  const { MapContainer, TileLayer, Circle, ScaleControl } = RL;
  const showGeofence = hasCoords && !noLimit;

  return (
    <div className="space-y-3">
      {/* Location search bar */}
      <div className="relative">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder="Search location by name (e.g. Dubai, Lahore, New York)..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {searching && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />
          )}
          {searchQuery && !searching && (
            <button
              onClick={() => { setSearchQuery(""); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-[500] mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
            {searchResults.map((result, i) => (
              <button
                key={i}
                onClick={() => selectSearchResult(result)}
                className="flex w-full items-start gap-2 border-b border-border/50 px-3 py-2.5 text-left transition hover:bg-muted last:border-0"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy">
                    {result.display_name.split(",")[0]}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {result.display_name.split(",").slice(1).join(",").trim()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div ref={containerRef} className="relative h-[300px] overflow-hidden rounded-lg border border-border">
        <style>{`@keyframes wt-pulse { 0%,100% { transform: scale(1); opacity: 0.2; } 50% { transform: scale(1.5); opacity: 0.05; } }`}</style>
        <MapContainer
          center={currentCenter}
          zoom={hasCoords ? 15 : 10}
          style={{ height: "100%", width: "100%", background: "#e5e7eb", cursor: "crosshair" }}
          scrollWheelZoom
          zoomControl={false}
        >
          <ScaleControl position="bottomright" imperial={false} />
          <RL.ZoomControl position="topright" />
          <MapClickHandler onLocationChange={handleMapClick} />
          <MapController center={externalCenter} zoom={externalZoom} />

          <TileLayer key={layer} url={LAYERS[layer].url} attribution={LAYERS[layer].attribution} maxZoom={LAYERS[layer].maxZoom} />

          {/* Geofence circle (hidden if No Limit) */}
          {showGeofence && (
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
              onDragEnd={(lat, lng) => onLocationChange(lat, lng)}
            />
          )}
        </MapContainer>

        {/* Instructions overlay */}
        {!hasCoords && (
          <div className="absolute inset-0 z-[300] flex items-center justify-center bg-navy/5 backdrop-blur-[2px] pointer-events-none">
            <div className="rounded-lg bg-white/95 px-4 py-3 text-center shadow-lg">
              <MapPin size={24} className="mx-auto text-primary" />
              <p className="mt-1 text-sm font-medium text-navy">Click on map or search to set location</p>
            </div>
          </div>
        )}

        {/* Coordinates display */}
        {hasCoords && (
          <div className="absolute left-3 top-3 z-[400] rounded-lg border border-border bg-white/95 px-3 py-1.5 text-xs font-mono font-medium text-navy shadow-md backdrop-blur">
            📍 {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
            {noLimit ? " • No geofence limit" : ` • R: ${radius}m`}
          </div>
        )}

        {/* Locate me */}
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
                <button key={key} onClick={() => { setLayer(key); setLayerOpen(false); }}
                  className={cn("block w-full px-4 py-2 text-left text-xs font-medium transition hover:bg-muted",
                    layer === key ? "bg-accent text-primary" : "text-navy")}>
                  {LAYERS[key].name}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setLayerOpen(!layerOpen)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-medium text-navy shadow-md transition hover:bg-muted">
            <Layers size={14} /> {LAYERS[layer].name}
          </button>
        </div>
      </div>

      {/* Radius controls — slider + No Limit toggle */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-navy">Geofence Radius</span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={noLimit}
              onChange={(e) => onNoLimitChange?.(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-primary"
            />
            <span className="text-xs font-medium text-muted-foreground">No Limit</span>
          </label>
        </div>

        {!noLimit ? (
          <>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{radius >= 1000 ? `${(radius / 1000).toFixed(1)}km` : `${radius}m`}</span>
              <span>{(radius * 3.14159 * 2 / 1000).toFixed(2)} km circumference</span>
            </div>
            <input
              type="range"
              min="50"
              max="8000"
              step="50"
              value={radius}
              onChange={(e) => onRadiusChange?.(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>50m</span>
              <span>2km</span>
              <span>5km</span>
              <span>8km (~50km circ.)</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No geofence restriction — employees can check in from anywhere.</p>
        )}
      </div>
    </div>
  );
}
