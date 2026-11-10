import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Crosshair } from 'lucide-react';
import type { Language } from '../i18n/translations';

interface LocationMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  source?: 'consent_device_gps' | 'farmer_map_pin' | 'default';
  language?: Language;
  onChange: (lat: number, lng: number, accuracy: number, source: 'consent_device_gps' | 'farmer_map_pin') => void;
  onRequestDeviceGps?: () => void;
}

export const LocationMapPicker: React.FC<LocationMapPickerProps> = ({
  latitude,
  longitude,
  accuracy,
  source = 'farmer_map_pin',
  language = 'en',
  onChange,
  onRequestDeviceGps
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Default coordinate: Valparai / Anamalai agricultural zone
  const defaultLat = 10.3275;
  const defaultLng = 76.9554;

  const currentLat = latitude ?? defaultLat;
  const currentLng = longitude ?? defaultLng;

  const isTa = language === 'ta';

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Custom SVG Pin Icon to avoid missing asset issues in Vite
      const pinSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
          <path fill="#047857" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="3" fill="#ffffff"/>
        </svg>
      `;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: pinSvg,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
      });

      const map = L.map(mapContainerRef.current, {
        center: [currentLat, currentLng],
        zoom: 13,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      const marker = L.marker([currentLat, currentLng], {
        icon: customIcon,
        draggable: true
      }).addTo(map);

      marker.bindPopup(isTa ? '<b>பயிர்ச்சேத இடம்</b>' : '<b>Damage Location Pin</b>').openPopup();

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange(Number(pos.lat.toFixed(5)), Number(pos.lng.toFixed(5)), 5.0, 'farmer_map_pin');
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onChange(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)), 5.0, 'farmer_map_pin');
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    } else {
      const map = mapInstanceRef.current;
      const marker = markerRef.current;
      if (marker && (latitude !== null || longitude !== null)) {
        marker.setLatLng([currentLat, currentLng]);
        map.setView([currentLat, currentLng], map.getZoom() || 13);
      }
    }
  }, []);

  // Update marker if coordinates change from GPS
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && latitude !== null && longitude !== null) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.panTo([latitude, longitude]);
    }
  }, [latitude, longitude]);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div>
          <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-700" />
            <span>{isTa ? 'கள வரைபடம்' : 'Incident Location Map'}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isTa
              ? 'வரைபடத்தில் தட்டி சேதமடைந்த இடத்தின் அட்சரேகை மற்றும் தீர்க்கரேகையைக் குறிக்கவும்.'
              : 'Click on map to set exact coordinates or use device GPS.'}
          </p>
        </div>

        {onRequestDeviceGps && (
          <button
            type="button"
            onClick={onRequestDeviceGps}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
          >
            <Navigation className="w-3.5 h-3.5 text-emerald-700" />
            <span>{isTa ? 'சாதன ஜிபிஎஸ்' : 'Device GPS'}</span>
          </button>
        )}
      </div>

      {/* Map Canvas */}
      <div className="relative w-full flex-1 min-h-[300px] md:min-h-[360px] rounded-xl overflow-hidden border border-slate-200 shadow-inner z-0">
        <div ref={mapContainerRef} className="w-full h-full min-h-[300px] md:min-h-[360px]" />
        
        {/* Floating helper chip */}
        <div className="absolute top-2.5 right-2.5 z-[400] bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-medium text-slate-700 border border-slate-200 shadow-sm flex items-center gap-1.5">
          <Crosshair className="w-3 h-3 text-emerald-600" />
          <span>{isTa ? 'வரைபடத்தில் குறியிட தட்டவும்' : 'Click to pin location'}</span>
        </div>
      </div>

      {/* Coordinate Display Cards */}
      <div className="grid grid-cols-2 gap-3 mt-3.5 text-xs">
        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200">
          <span className="block text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
            {isTa ? 'அட்சரேகை' : 'Latitude'}
          </span>
          <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
            {latitude !== null ? `${latitude.toFixed(5)}° N` : (isTa ? 'குறிக்கப்படவில்லை' : 'Not set')}
          </span>
        </div>

        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200">
          <span className="block text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
            {isTa ? 'தீர்க்கரேகை' : 'Longitude'}
          </span>
          <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
            {longitude !== null ? `${longitude.toFixed(5)}° E` : (isTa ? 'குறிக்கப்படவில்லை' : 'Not set')}
          </span>
        </div>
      </div>

      {/* Provenance note */}
      <div className="mt-2.5 text-xs text-slate-500 flex items-center justify-between px-1">
        <span>
          {isTa
            ? `மூலம்: ${source === 'consent_device_gps' ? 'சாதன ஜிபிஎஸ்' : 'வரைபடக் குறியீடு'}`
            : `Source: ${source === 'consent_device_gps' ? 'Device GPS' : 'Map Pinpoint'}`}
        </span>
        {accuracy && (
          <span className="font-medium text-emerald-700">
            {isTa ? `துல்லியம்: ±${Math.round(accuracy)} மீ` : `Accuracy: ±${Math.round(accuracy)}m`}
          </span>
        )}
      </div>
    </div>
  );
};
