'use client';

import { useEffect, useRef } from 'react';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { OFFICE_CONFIG } from '@/lib/geofence';

export interface MapProps {
  userLat: number | null;
  userLng: number | null;
}

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const MARKER_ICON_URL =
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const MARKER_SHADOW_URL =
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

/**
 * Leaflet resolves its default marker images relative to the bundle, which
 * bundlers break. Drop the auto-detected URL lookup and point the defaults at
 * an explicit CDN path instead.
 */
function configureDefaultIcon(): void {
  const prototype = L.Icon.Default.prototype as unknown as {
    _getIconUrl?: unknown;
  };
  delete prototype._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconUrl: MARKER_ICON_URL,
    shadowUrl: MARKER_SHADOW_URL,
  });
}

/**
 * Vanilla Leaflet map showing the office safe zone and the user's position.
 *
 * The map instance is created exactly once; subsequent GPS updates only move
 * the marker, so the view never blinks or resets while the user pans.
 */
export default function Map({ userLat, userLng }: MapProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Create the map once, after mount, guarded for the server render pass.
  useEffect((): (() => void) | undefined => {
    if (typeof window === 'undefined' || containerRef.current === null) {
      return undefined;
    }
    if (mapRef.current !== null) {
      return undefined;
    }

    configureDefaultIcon();

    const officeCenter: L.LatLngExpression = [
      OFFICE_CONFIG.latitude,
      OFFICE_CONFIG.longitude,
    ];

    const map = L.map(containerRef.current, {
      center: officeCenter,
      zoom: 16,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);

    L.circle(officeCenter, {
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
      radius: OFFICE_CONFIG.radiusMeters,
    })
      .addTo(map)
      .bindPopup('Office Safe Zone');

    return (): void => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Track the user's position without rebuilding the map.
  useEffect((): void => {
    const map = mapRef.current;
    if (map === null || userLat === null || userLng === null) {
      return;
    }

    const position: L.LatLngExpression = [userLat, userLng];

    if (markerRef.current === null) {
      markerRef.current = L.marker(position)
        .addTo(map)
        .bindPopup('Your Current Location');
      map.setView(position, 16);
    } else {
      markerRef.current.setLatLng(position);
    }
  }, [userLat, userLng]);

  return <div ref={containerRef} className="mt-4 h-64 w-full rounded-lg border shadow-sm" />;
}
