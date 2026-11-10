import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Crosshair } from 'lucide-react';

interface LocationMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  source?: 'consent_device_gps' | 'farmer_map_pin' | 'default';
  onChange: (lat: number, lng: number, accuracy: number, source: 'consent_device_gps' | 'farmer_map_pin') => void;
  onRequestDeviceGps?: () => void;
}

export const LocationMapPicker: React.FC<LocationMapPickerProps> = ({
  latitude,
  longitude,
  accuracy,
  source = 'farmer_map_pin',
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

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Custom SVG Pin Icon to avoid missing asset issues in Vite
      const pinSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
          <path fill="#059669" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
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

      marker.bindPopup('<b>பயிர்ச்சேத இடம்</b><br>Incident Pinpoint').openPopup();

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

    return () => {
      // Map stays managed across re-renders
    };
  }, []);

  // Update marker if coordinates change from GPS
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && latitude !== null && longitude !== null) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.panTo([latitude, longitude]);
    }
  }, [latitude, longitude]);

  return (
    <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
        <div>
          <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-700" />
            <span>கள வரைபடம் (Location Map)</span>
          </h3>
          <p className="text-[11px] text-gray-500">
            Click on map to pin exact incident coordinates or use device GPS.
          </p>
        </div>

        {onRequestDeviceGps && (
          <button
            type="button"
            onClick={onRequestDeviceGps}
            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1 transition shrink-0"
            title="சாதனத்தின் நேரடி GPS இருப்பிடத்தைப் பெற"
          >
            <Navigation className="w-3.5 h-3.5 text-emerald-700" />
            <span>சாதன GPS</span>
          </button>
        )}
      </div>

      {/* Map Canvas */}
      <div className="relative w-full flex-1 min-h-[300px] md:min-h-[360px] rounded-2xl overflow-hidden border border-gray-200 shadow-inner z-0">
        <div ref={mapContainerRef} className="w-full h-full min-h-[300px] md:min-h-[360px]" />
        
        {/* Floating helper chip */}
        <div className="absolute top-2 right-2 z-[400] bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-semibold text-gray-700 border border-gray-200 shadow-xs flex items-center gap-1">
          <Crosshair className="w-3 h-3 text-emerald-600" />
          <span>தட்டி இருப்பிடத்தைக் குறிக்கவும்</span>
        </div>
      </div>

      {/* Coordinate Display Cards (matching the user's reference mockup) */}
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
          <span className="block text-[10px] text-gray-500 uppercase font-bold tracking-wider">Latitude</span>
          <span className="font-mono font-bold text-gray-900 text-xs">
            {latitude !== null ? `${latitude.toFixed(5)}° N` : 'Not set'}
          </span>
        </div>

        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
          <span className="block text-[10px] text-gray-500 uppercase font-bold tracking-wider">Longitude</span>
          <span className="font-mono font-bold text-gray-900 text-xs">
            {longitude !== null ? `${longitude.toFixed(5)}° E` : 'Not set'}
          </span>
        </div>
      </div>

      {/* Provenance note */}
      <div className="mt-2 text-[10px] text-gray-500 flex items-center justify-between px-1">
        <span>
          மூலம்: {source === 'consent_device_gps' ? '📱 நேரடி மொபைல் GPS' : '📍 வரைபட பின் இருப்பிடம் (Map Pin)'}
        </span>
        {accuracy && (
          <span className="font-medium text-emerald-700">
            துல்லியம்: ±{Math.round(accuracy)} மீ
          </span>
        )}
      </div>
    </div>
  );
};
