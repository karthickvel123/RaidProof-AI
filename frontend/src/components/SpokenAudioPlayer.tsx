import React, { useRef, useState, useEffect } from 'react';
import { Volume2, Pause, Play } from 'lucide-react';

interface SpokenAudioPlayerProps {
  audioUrl?: string;
  autoPlay?: boolean;
  label?: string;
}

export const SpokenAudioPlayer: React.FC<SpokenAudioPlayerProps> = ({
  audioUrl,
  autoPlay = false,
  label = "Listen to Response"
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (audioUrl && autoPlay) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  }, [audioUrl, autoPlay]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  if (!audioUrl) return null;

  return (
    <div className="flex items-center gap-3 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3 my-2.5">
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      />
      <button
        type="button"
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center hover:bg-emerald-800 transition shadow-sm active:scale-95 shrink-0 cursor-pointer"
        aria-label="Play spoken response"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 text-xs font-semibold text-emerald-950">
        <span className="flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{label}</span>
        </span>
      </div>
    </div>
  );
};
