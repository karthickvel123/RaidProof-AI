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
    accuracy: 12,
    isLocked: false
  });
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Poll geolocation with consent
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
          console.warn('Geolocation consent not granted or unavailable:', err.message);
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
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraActive(false);
        return;
      }
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
      console.warn('Camera stream unavailable, switching to simulated field photo capture mode:', err);
      setCameraActive(false);
      setError('கேமரா இயங்கவில்லை. மாதிரி களப் புகைப்படம் அல்லது கோப்பு பதிவேற்றத்தைப் பயன்படுத்தலாம்.');
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
      const canvas = document.createElement('canvas');
      const maxDim = 1200;
      let width = 1200;
      let height = 800;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      const video = videoRef.current;
      const hasActiveVideo = cameraActive && video && video.videoWidth > 0;

      if (hasActiveVideo) {
        // Capture live video frame
        width = video.videoWidth;
        height = video.videoHeight;
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
        ctx.drawImage(video, 0, 0, width, height);
      } else {
        // Fallback: Generate realistic agricultural field simulation
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#2d5a27');
        grad.addColorStop(0.4, '#4a7c36');
        grad.addColorStop(0.7, '#6b4423');
        grad.addColorStop(1, '#3b2512');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Crop rows simulation
        ctx.fillStyle = 'rgba(74, 124, 54, 0.4)';
        for (let y = 100; y < height - 60; y += 70) {
          ctx.beginPath();
          ctx.ellipse(width / 2, y, width / 2.2, 25, 0, 0, 2 * Math.PI);
          ctx.fill();
        }

        // Damage indicator
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🌾 பயிர்ச்சேத சான்று புகைப்படம் (Evidence Photo)', width / 2, height / 2 - 20);
        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('வாழைத்தோட்டம் / கள ஆய்வு மாதிரிப் படம்', width / 2, height / 2 + 20);
        ctx.textAlign = 'left';
      }

      // Watermark metadata on canvas
      const bannerHeight = 44;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px sans-serif';
      const timeStr = new Date().toLocaleString();
      const gpsLabel = gps.isLocked
        ? `GPS: ${gps.latitude.toFixed(4)}°N, ${gps.longitude.toFixed(4)}°E (±${Math.round(gps.accuracy)}m)`
        : 'GPS: இருப்பிடம் பதிவு செய்யப்படவில்லை (No GPS)';
      const text = `RAIDPROOF AI | ${gpsLabel} | ${timeStr}`;
      ctx.fillText(text, 14, height - 16);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, dataUrl, gps });
          } else {
            resolve(null);
          }
        },
        'image/jpeg',
        0.85
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
