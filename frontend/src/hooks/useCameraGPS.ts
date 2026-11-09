import { useState, useEffect, useRef, useCallback } from 'react';

export interface GPSCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  isLocked: boolean;
}

export const useCameraGPS = () => {
  const [gps, setGps] = useState<GPSCoords>({
    latitude: 10.3245,
    longitude: 76.9512,
    accuracy: 15,
    isLocked: false
  });
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Poll geolocation
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGps({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            isLocked: true
          });
        },
        (err) => {
          console.warn('Geolocation error/denied, using fallback coordinates:', err.message);
          setGps((prev) => ({ ...prev, isLocked: false }));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setError('Camera access denied or unavailable: ' + err.message);
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback((): Promise<{ blob: Blob; dataUrl: string; gps: GPSCoords } | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !cameraActive) {
        resolve(null);
        return;
      }

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const maxDim = 1600;
      let width = video.videoWidth || 1280;
      let height = video.videoHeight || 720;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(video, 0, 0, width, height);

      // Watermark metadata on canvas
      const bannerHeight = 36;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px sans-serif';
      const timeStr = new Date().toLocaleString();
      const text = `RAIDPROOF AI | GPS: ${gps.latitude.toFixed(4)}N, ${gps.longitude.toFixed(4)}E (±${Math.round(gps.accuracy)}m) | ${timeStr}`;
      ctx.fillText(text, 12, height - 12);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, dataUrl, gps });
          } else {
            resolve(null);
          }
        },
        'image/jpeg',
        0.8
      );
    });
  }, [cameraActive, gps]);

  return {
    videoRef,
    cameraActive,
    gps,
    error,
    startCamera,
    stopCamera,
    capturePhoto
  };
};

