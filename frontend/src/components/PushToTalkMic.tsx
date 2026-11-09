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
  language = 'ta'
}) => {
  return (
    <div className="flex flex-col items-center justify-center my-6">
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
          className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-200 select-none ${
            isProcessing
              ? 'bg-gray-400 cursor-not-allowed'
              : isRecording
              ? 'bg-amber-600 scale-110 shadow-amber-600/40'
              : 'bg-emerald-700 hover:bg-emerald-800 active:scale-95 shadow-emerald-900/30'
          }`}
          aria-label="Push to talk microphone"
        >
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : (
            <Mic className={`w-10 h-10 text-white ${isRecording ? 'animate-bounce' : ''}`} />
          )}
        </button>
      </div>

      <p className="mt-4 font-medium text-center text-gray-800 select-none">
        {isProcessing
          ? language === 'ta'
            ? 'அறிக்கை உருவாக்கப்படுகிறது...'
            : 'Processing Voice...'
          : isRecording
          ? language === 'ta'
            ? '🔴 பேசவும், கேட்கிறேன்...'
            : '🔴 Listening... Release to submit'
          : language === 'ta'
          ? 'அழுத்திப் பிடித்து பேசவும் (Hold to Speak)'
          : 'Press and Hold to Speak'}
      </p>
    </div>
  );
};
