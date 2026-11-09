import { useState, useRef, useCallback } from 'react';

export interface AudioRecorderState {
  isRecording: boolean;
  volume: number;
  duration: number;
  audioBlob: Blob | null;
  error: string | null;
}

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<number | null>(null);

  const encodeWAV = (samples: Float32Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // Write RIFF header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);        // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);         // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true);         // NumChannels (1 = Mono)
    view.setUint32(24, sampleRate, true);// SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true);         // BlockAlign
    view.setUint16(34, 16, true);        // BitsPerSample
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write 16-bit PCM samples with clipping protection
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      // ScriptProcessor buffer size 4096
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioChunksRef.current.push(new Float32Array(inputData));

        // Compute RMS volume for visual wave animation
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setVolume(Math.min(1, rms * 5));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsRecording(true);
      setDuration(0);
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 200);

    } catch (err: any) {
      setError(err.message || 'Microphone access denied or unavailable.');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!isRecording) {
        resolve(null);
        return;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (processorRef.current && audioContextRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      const sampleRate = audioContextRef.current?.sampleRate || 16000;
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }

      // Merge chunks into a single Float32Array
      const totalSamples = audioChunksRef.current.reduce((acc, c) => acc + c.length, 0);
      const mergedSamples = new Float32Array(totalSamples);
      let offset = 0;
      for (const chunk of audioChunksRef.current) {
        mergedSamples.set(chunk, offset);
        offset += chunk.length;
      }

      if (totalSamples > 0) {
        const wav = encodeWAV(mergedSamples, sampleRate);
        setAudioBlob(wav);
        setIsRecording(false);
        setVolume(0);
        resolve(wav);
      } else {
        setIsRecording(false);
        setVolume(0);
        resolve(null);
      }
    });
  }, [isRecording]);

  return {
    isRecording,
    volume,
    duration,
    audioBlob,
    error,
    startRecording,
    stopRecording
  };
};
