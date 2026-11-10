import React from 'react';
import { Mic, Loader2 } from 'lucide-react';

interface PushToTalkMicProps {
  isRecording: boolean;
  isProcessing: boolean;
  onStart: () => void;
  onStop: () => void;
  language?: 'ta' | 'en';
}

export const PushToTalkMic: React.FC<PushToTalkMicProps> = ({
  isRecording,
  isProcessing,
  onStart,
  onStop,
  language = 'en'
}) => {
  return (
    <div className="flex flex-col items-center justify-center my-4">
      <div className="relative flex items-center justify-center">
        {/* Pulsing ring animation when recording */}
        {isRecording && (
          <>
            <div className="absolute w-36 h-36 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="absolute w-28 h-28 rounded-full bg-emerald-500/30 animate-pulse" />
          </>
        )}

        <button
          onMouseDown={onStart}
          onMouseUp={onStop}
          onTouchStart={(e) => {
            e.preventDefault();
            onStart();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            onStop();
          }}
          disabled={isProcessing}
          className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-200 select-none cursor-pointer ${
            isProcessing
              ? 'bg-slate-400 cursor-not-allowed'
              : isRecording
              ? 'bg-amber-600 scale-105 shadow-amber-600/40'
              : 'bg-emerald-700 hover:bg-emerald-800 active:scale-95 shadow-emerald-900/25'
          }`}
          aria-label="Push to talk microphone"
        >
          {isProcessing ? (
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          ) : (
            <Mic className={`w-8 h-8 text-white ${isRecording ? 'animate-bounce' : ''}`} />
          )}
        </button>
      </div>

      <p className="mt-3 text-xs font-semibold text-center text-slate-700 select-none">
        {isProcessing
          ? language === 'ta'
            ? 'குரல் பகுப்பாய்வு செய்யப்படுகிறது...'
            : 'Processing Voice Statement...'
          : isRecording
          ? language === 'ta'
            ? 'பேசவும்... விட்டுவிட்டால் சமர்ப்பிக்கப்படும்'
            : 'Listening... Release to submit'
          : language === 'ta'
          ? 'அழுத்திப் பிடித்து பேசவும்'
          : 'Press and Hold to Speak'}
      </p>
    </div>
  );
};
