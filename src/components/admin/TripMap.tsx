'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface TripMapProps {
  /** Array of [lat, lng] tuples — OSRM matched route */
  matchedRoute: [number, number][];
  /** Original raw GPS points from PWA (optional overlay) */
  rawPoints?: [number, number][];
  /** Map height */
  height?: string;
}

export function TripMap({
  matchedRoute,
  rawPoints,
  height = '400px',
}: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || matchedRoute.length === 0) return;

    // Clean up previous instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Calculate center from route
    const lats = matchedRoute.map((p) => p[0]);
    const lngs = matchedRoute.map((p) => p[1]);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    // Create map
    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    mapInstanceRef.current = map;

    // Dark tile layer (matches OLED theme)
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      },
    ).addTo(map);

    // Raw GPS points (red, thin, dashed — shows original noisy trace)
    if (rawPoints && rawPoints.length > 1) {
      L.polyline(rawPoints, {
        color: '#ef4444',
        weight: 2,
        opacity: 0.5,
        dashArray: '6,8',
      }).addTo(map);

      // Small circle markers for raw points
      rawPoints.forEach((p, i) => {
        L.circleMarker(p, {
          radius: 2,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.6,
        }).addTo(map)
          .bindPopup(`Raw GPS #${i + 1}<br>Lat: ${p[0].toFixed(5)}<br>Lng: ${p[1].toFixed(5)}`);
      });
    }

    // Matched route (emerald, solid — OSRM snapped to road)
    const routeLine = L.polyline(matchedRoute, {
      color: '#10b981',
      weight: 4,
      opacity: 0.9,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    // Start marker (green)
    const startIcon = L.divIcon({
      html: '<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:3px solid #022c22;box-shadow:0 0 8px #10b981"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      className: '',
    });

    L.marker(matchedRoute[0], { icon: startIcon })
      .addTo(map)
      .bindPopup('<b>🟢 Start Trip</b>');

    // End marker (red)
    const endIcon = L.divIcon({
      html: '<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:3px solid #450a0a;box-shadow:0 0 8px #ef4444"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      className: '',
    });

    L.marker(matchedRoute[matchedRoute.length - 1], { icon: endIcon })
      .addTo(map)
      .bindPopup('<b>🔴 End Trip</b>');

    // Fit bounds
    map.fitBounds(routeLine.getBounds().pad(0.1));

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [matchedRoute, rawPoints]);

  return (
    <div
      ref={mapRef}
      style={{ height, width: '100%', borderRadius: '12px' }}
      className="border border-zinc-800 overflow-hidden"
    />
  );
}
