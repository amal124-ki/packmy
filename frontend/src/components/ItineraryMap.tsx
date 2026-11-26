'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapStop {
  name: string;
  lat: number;
  lng: number;
  time: string;
}

export interface MapData {
  hotel: { name: string; lat: number; lng: number } | null;
  days: MapStop[][];
}

export const DAY_COLORS = [
  '#0d9488',
  '#2563eb',
  '#d97706',
  '#7c3aed',
  '#e11d48',
  '#059669',
  '#4f46e5',
];

const HOTEL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 22v-6.57"/><path d="M12 11h.01"/><path d="M12 7h.01"/><path d="M14 15.43V22"/><path d="M15 16a5 5 0 0 0-6 0"/><path d="M16 11h.01"/><path d="M16 7h.01"/><path d="M8 11h.01"/><path d="M8 7h.01"/><rect x="4" y="2" width="16" height="20" rx="2"/></svg>';

function makePin(html: string | number, bg: string) {
  return L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div style="background:${bg};color:#ffffff;width:26px;height:26px;border-radius:999px;display:flex;align-items:center;justify-content:center;font:600 11px Inter,system-ui,sans-serif;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.28)">${html}</div>`,
  });
}

export default function ItineraryMap({
  data,
  activeDay,
}: {
  data: MapData;
  activeDay: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Record<string, L.LayerGroup>>({});

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, { scrollWheelZoom: false });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const layers: Record<string, L.LayerGroup> = {};
    const all: [number, number][] = [];

    if (data.hotel) {
      L.marker([data.hotel.lat, data.hotel.lng], { icon: makePin(HOTEL_SVG, '#18181b') })
        .addTo(map)
        .bindPopup(`<strong>${data.hotel.name}</strong><br/>Accommodation`);
      all.push([data.hotel.lat, data.hotel.lng]);
    }

    data.days.forEach((stops, d) => {
      const g = L.layerGroup();
      const color = DAY_COLORS[d % DAY_COLORS.length];
      const line: [number, number][] = stops.map((s) => [s.lat, s.lng]);
      if (data.hotel && line.length) {
        line.unshift([data.hotel.lat, data.hotel.lng]);
        line.push([data.hotel.lat, data.hotel.lng]);
      }
      if (line.length > 1) {
        L.polyline(line, { color, weight: 3.5, opacity: 0.85, dashArray: '5 6' }).addTo(g);
      }
      stops.forEach((s, i) => {
        L.marker([s.lat, s.lng], { icon: makePin(i + 1, color) })
          .addTo(g)
          .bindPopup(`<strong>Day ${d + 1}, Stop ${i + 1}: ${s.name}</strong><br/>${s.time}`);
        all.push([s.lat, s.lng]);
      });
      layers[String(d + 1)] = g;
      g.addTo(map);
    });

    layersRef.current = layers;

    if (all.length) {
      map.fitBounds(all, { padding: [28, 28] });
    } else {
      map.setView([4.2, 101.9], 6);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = {};
    };
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const pts: [number, number][] = [];
    Object.entries(layersRef.current).forEach(([d, g]) => {
      if (activeDay === 'all' || d === activeDay) {
        if (!map.hasLayer(g)) g.addTo(map);
        (data.days[Number(d) - 1] || []).forEach((s) => pts.push([s.lat, s.lng]));
      } else if (map.hasLayer(g)) {
        map.removeLayer(g);
      }
    });
    if (data.hotel) pts.push([data.hotel.lat, data.hotel.lng]);
    if (pts.length) {
      map.fitBounds(pts, { padding: [28, 28] });
    }
  }, [activeDay, data]);

  return <div ref={containerRef} className="h-80 lg:h-[360px] w-full z-0" />;
}
