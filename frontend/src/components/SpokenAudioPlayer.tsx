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
  label = "மீண்டும் கேட்க (Listen Again)"
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
    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 my-3">
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      />
      <button
        onClick={togglePlay}
        className="w-11 h-11 rounded-full bg-emerald-700 text-white flex items-center justify-center hover:bg-emerald-800 transition shadow-sm active:scale-95 shrink-0"
        aria-label="Play spoken response"
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>
      <div className="flex-1 text-sm font-medium text-emerald-950">
        <span className="flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-emerald-700" />
          {label}
        </span>
      </div>
    </div>
  );
};

