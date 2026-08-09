import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, InfoWindow, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { hasRoadPath, pathBounds, resolveRoutePath, type LatLng } from '@carpool/shared';
import { Alert, Icon } from '@carpool/ui';
import { config } from '../lib/api';
import { LeafletRouteMap } from './LeafletRouteMap';

/**
 * The route map: pickup marker, destination marker and the road path between
 * them, drawn from the coordinates in `@carpool/shared/path`.
 *
 * Two things it deliberately will not do. It never renders an empty grey box:
 * without an API key, or for a location the path table does not know, it says
 * why in place of the map. And it never animates a vehicle it has not been
 * given a position for — `vehicle` is drawn only when a caller passes one.
 */

/** Loaded once for the whole app; `useJsApiLoader` dedupes across mounts. */
const LIBRARIES: 'geometry'[] = ['geometry'];

/**
 * Google reports a rejected key *after* the script has loaded successfully, so
 * `loadError` never fires for an expired, unauthorised or over-quota key —
 * instead Maps paints its own grey "can't load Google Maps correctly" panel
 * over ours. `gm_authFailure` is the documented hook for that moment; catching
 * it lets every mounted map switch to a plain explanation instead of showing
 * a broken tile surface the user cannot act on.
 */
let mapsAuthFailed = false;
const authFailureListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    mapsAuthFailed = true;
    authFailureListeners.forEach((notify) => notify());
  };
}

function useMapsAuthFailed(): boolean {
  const [failed, setFailed] = useState(mapsAuthFailed);
  useEffect(() => {
    if (mapsAuthFailed) {
      setFailed(true);
      return;
    }
    const notify = () => setFailed(true);
    authFailureListeners.add(notify);
    return () => {
      authFailureListeners.delete(notify);
    };
  }, []);
  return failed;
}

const CONTAINER_STYLE = { width: '100%', height: '100%' };

/* Muted styling so the route reads as the subject, not the basemap. */
const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'cooperative',
  clickableIcons: false,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  ],
};

export interface RouteMapProps {
  from: string;
  to: string;
  /** Live or last-known vehicle position. Omit and no vehicle is drawn. */
  vehicle?: LatLng | null;
  /** Shown on the vehicle marker, e.g. "Last seen 4 minutes ago". */
  vehicleLabel?: string;
  height?: number;
  className?: string;
}

/**
 * Picks the renderer, before any hook runs — a conditional hook is not an
 * option inside one component.
 *
 * Google is used only when a key is configured *and* it has authenticated.
 * Everything else — no key, a key whose project has not enabled the Maps
 * JavaScript API, an expired key, a referrer or quota rejection — falls
 * through to OpenStreetMap, which needs no key at all. The route is the point
 * of this component, so it should never disappear because of a billing
 * console.
 */
export function RouteMap(props: RouteMapProps) {
  const { from, to, className } = props;
  const authFailed = useMapsAuthFailed();
  const path = resolveRoutePath(from, to);

  if (!path) {
    return (
      <Alert tone="info" className={className}>
        No route geometry is stored for {from} → {to}, so the map cannot draw this path.
      </Alert>
    );
  }

  if (!config.googleMapsApiKey || authFailed) {
    return <LeafletRouteMap {...props} />;
  }

  return <LoadedRouteMap {...props} />;
}

function LoadedRouteMap({ from, to, vehicle, vehicleLabel, height = 300, className }: RouteMapProps) {
  const path = useMemo(() => resolveRoutePath(from, to), [from, to]);
  const bounds = useMemo(() => (path ? pathBounds(path) : null), [path]);
  const approximate = useMemo(() => Boolean(path) && !hasRoadPath(from, to), [path, from, to]);

  const mapRef = useRef<google.maps.Map | null>(null);
  const authFailed = useMapsAuthFailed();

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'ridesync-google-maps',
    googleMapsApiKey: config.googleMapsApiKey,
    libraries: LIBRARIES,
    // The design system supplies its own typography; the Maps script does not
    // need to pull Google Fonts in on top of it.
    preventGoogleFontsLoading: true,
  });

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (!bounds) return;
      // Fit the whole route rather than trusting a guessed zoom level.
      const box = new google.maps.LatLngBounds(
        { lat: bounds.south, lng: bounds.west },
        { lat: bounds.north, lng: bounds.east },
      );
      map.fitBounds(box, 48);
    },
    [bounds],
  );

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // Re-checked for the type narrowing; `RouteMap` already refused the null case.
  if (!path || !bounds) return null;

  // Script blocked or offline, or the key was rejected after loading: draw the
  // same route on OpenStreetMap rather than showing the user a dead panel.
  if (loadError || authFailed) {
    return (
      <LeafletRouteMap
        from={from}
        to={to}
        vehicle={vehicle}
        vehicleLabel={vehicleLabel}
        height={height}
        className={className}
      />
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={className}
        style={{
          height,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface-inset)',
        }}
        aria-busy="true"
      >
        <span className="t-caption row" style={{ gap: 8 }}>
          <Icon name="pin" size={14} />
          Loading map…
        </span>
      </div>
    );
  }

  const start = path[0]!;
  const end = path[path.length - 1]!;

  return (
    <div className={className}>
      <div style={{ height, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <GoogleMap
          mapContainerStyle={CONTAINER_STYLE}
          center={bounds.center}
          zoom={12}
          options={MAP_OPTIONS}
          onLoad={onLoad}
          onUnmount={onUnmount}
        >
          <Polyline
            path={path}
            options={{
              strokeColor: '#1e5631',
              strokeOpacity: approximate ? 0 : 0.9,
              strokeWeight: 4,
              // A dashed line is how an approximated straight line announces
              // itself as an approximation.
              icons: approximate
                ? [
                    {
                      icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, scale: 3 },
                      offset: '0',
                      repeat: '12px',
                    },
                  ]
                : undefined,
            }}
          />

          <Marker
            position={start}
            title={`Pickup — ${from}`}
            label={{ text: 'A', color: '#ffffff', fontSize: '12px', fontWeight: '700' }}
          />
          <Marker
            position={end}
            title={`Destination — ${to}`}
            label={{ text: 'B', color: '#ffffff', fontSize: '12px', fontWeight: '700' }}
          />

          {vehicle ? (
            <>
              <Marker
                position={vehicle}
                title={vehicleLabel ?? 'Vehicle'}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#e4a700',
                  fillOpacity: 1,
                  strokeColor: '#143019',
                  strokeWeight: 2,
                }}
              />
              {vehicleLabel ? (
                <InfoWindow position={vehicle} options={{ disableAutoPan: true }}>
                  <span style={{ fontSize: 12 }}>{vehicleLabel}</span>
                </InfoWindow>
              ) : null}
            </>
          ) : null}
        </GoogleMap>
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
