import React from 'react';

interface AudioWaveformProps {
  volume: number;       // 0.0 to 1.0
  isRecording: boolean;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ volume, isRecording }) => {
  if (!isRecording) return null;

  const barCount = 12;
  const bars = Array.from({ length: barCount }, (_, i) => {
    // Generate organic pseudo-random heights based on volume level
    const factor = Math.sin((i / barCount) * Math.PI);
    const height = Math.max(8, Math.min(48, volume * 50 * factor + Math.random() * 8));
    return height;
  });

  return (
    <div className="flex items-center justify-center gap-1.5 h-14 my-2">
      {bars.map((h, idx) => (
        <div
          key={idx}
          className="w-1.5 bg-amber-500 rounded-full transition-all duration-75"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
};

