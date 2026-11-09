import React from 'react';
import { MapPin } from 'lucide-react';
import type { GPSCoords } from '../hooks/useCameraGPS';

interface GPSIndicatorProps {
  gps: GPSCoords;
}

export const GPSIndicator: React.FC<GPSIndicatorProps> = ({ gps }) => {
  let badgeColor = 'bg-red-100 text-red-800 border-red-300';
  let dotColor = 'bg-red-500';
  let statusText = 'இருப்பிடம் பெறப்படுகிறது...';

  if (gps.isLocked) {
    statusText = `இருப்பிட தகவல் (±${Math.round(gps.accuracy)} மீ)`;
    if (gps.accuracy <= 15) {
      badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      dotColor = 'bg-emerald-500';
    } else {
      badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
      dotColor = 'bg-amber-500';
    }
  }

  return (
    <div
      title="விவசாயி ஒப்புதலின்படி சாதனத்தால் பதிவு செய்யப்பட்ட இருப்பிட தகவல்"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${badgeColor}`}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${dotColor} ${gps.isLocked ? '' : 'animate-ping'}`} />
      <MapPin className="w-3.5 h-3.5" />
      <span>{statusText}</span>
      <span className="text-gray-500 font-mono text-[11px]">
        {gps.latitude.toFixed(4)}°N, {gps.longitude.toFixed(4)}°E
      </span>
    </div>
  );
};
