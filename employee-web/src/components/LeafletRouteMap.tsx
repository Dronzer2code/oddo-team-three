import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { hasRoadPath, pathBounds, resolveRoutePath, type LatLng } from '@carpool/shared';
import { Icon } from '@carpool/ui';

/**
 * The keyless route renderer: OpenStreetMap tiles through Leaflet.
 *
 * This is what draws the path when Google is unavailable — no API key, no
 * billing account, no per-project API enablement. It is the default precisely
 * so a working map never depends on somebody having finished a Cloud console
 * setup, and so every member of the team sees the same thing from a fresh
 * clone.
 */

/* Leaflet's default marker icons are resolved from a CDN path that Vite does
   not bundle, so they 404 and the markers vanish. Drawing them as inline SVG
   divIcons keeps the map self-contained and lets them match the palette. */
function pinIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: 'route-pin',
    html: `
      <span style="
        display:grid;place-items:center;
        width:26px;height:26px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${color};border:2px solid #ffffff;
        box-shadow:0 2px 6px rgba(20,48,25,0.35);
      ">
        <span style="
          transform:rotate(45deg);
          color:#ffffff;font-size:11px;font-weight:700;
          font-family:system-ui,sans-serif;line-height:1;
        ">${label}</span>
      </span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
}

const PICKUP_ICON = pinIcon('A', '#1e5631');
const DESTINATION_ICON = pinIcon('B', '#143019');
const VEHICLE_ICON = L.divIcon({
  className: 'route-vehicle',
  html: `
    <span style="
      display:block;width:16px;height:16px;border-radius:50%;
      background:#e4a700;border:3px solid #143019;
      box-shadow:0 0 0 4px rgba(228,167,0,0.25);
    "></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Fits the viewport to the whole route once the map is mounted. */
function FitBounds({ path }: { path: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (path.length === 0) return;
    const bounds = L.latLngBounds(path.map((point) => [point.lat, point.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [36, 36] });
  }, [map, path]);
  return null;
}

export interface LeafletRouteMapProps {
  from: string;
  to: string;
  vehicle?: LatLng | null;
  vehicleLabel?: string;
  height?: number;
  className?: string;
}

export function LeafletRouteMap({
  from,
  to,
  vehicle,
  vehicleLabel,
  height = 300,
  className,
}: LeafletRouteMapProps) {
  const path = useMemo(() => resolveRoutePath(from, to), [from, to]);
  const bounds = useMemo(() => (path ? pathBounds(path) : null), [path]);
  const approximate = useMemo(() => Boolean(path) && !hasRoadPath(from, to), [path, from, to]);

  if (!path || !bounds) return null;

  const positions = path.map((point) => [point.lat, point.lng] as [number, number]);
  const start = path[0]!;
  const end = path[path.length - 1]!;

  return (
    <div className={className}>
      <div style={{ height, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <MapContainer
          center={[bounds.center.lat, bounds.center.lng]}
          zoom={12}
          scrollWheelZoom={false}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {/* A casing stroke under the route line, so the path stays legible
              over both pale streets and dark parkland. */}
          <Polyline positions={positions} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.9 }} />
          <Polyline
            positions={positions}
            pathOptions={{
              color: '#1e5631',
              weight: 4,
              opacity: 0.95,
              // A dashed line is how a straight-line approximation announces
              // that it is not a real road path.
              dashArray: approximate ? '8 8' : undefined,
            }}
          />

          <Marker position={[start.lat, start.lng]} icon={PICKUP_ICON}>
            <Popup>
              <strong>Pickup</strong>
              <br />
              {from}
            </Popup>
          </Marker>
          <Marker position={[end.lat, end.lng]} icon={DESTINATION_ICON}>
            <Popup>
              <strong>Destination</strong>
              <br />
              {to}
            </Popup>
          </Marker>

          {vehicle ? (
            <Marker position={[vehicle.lat, vehicle.lng]} icon={VEHICLE_ICON}>
              {vehicleLabel ? <Popup>{vehicleLabel}</Popup> : null}
            </Marker>
          ) : null}

          <FitBounds path={path} />
        </MapContainer>
      </div>

      {approximate ? (
        <p className="t-caption" style={{ marginTop: 'var(--space-2)' }}>
          <Icon name="info" size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
          Straight-line approximation — no road path is stored for this pair.
        </p>
      ) : null}
    </div>
  );
}
