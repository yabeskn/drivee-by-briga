'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, AlertTriangle, Battery, Gauge } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (evidence: {
    odometerPhoto: string | null;
    batteryPhoto: string | null;
    capturedAt: number;
    gpsLocation: { lat: number; lng: number } | null;
  }) => void;
  onCancel: () => void;
  title?: string;
}

type CaptureMode = 'odometer' | 'battery';

export function CameraCapture({
  onCapture,
  onCancel,
  title = 'Capture Bukti Fisik',
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<CaptureMode>('odometer');
  const [odometerPhoto, setOdometerPhoto] = useState<string | null>(null);
  const [batteryPhoto, setBatteryPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // GPS not available — continue without it
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // Start camera
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Camera access denied';
      setCameraError(message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  };

  // FIX B7: Compress photo to max ~200KB to reduce payload size
  const compressPhoto = useCallback((dataUrl: string): string => {
    const img = new Image();
    img.src = dataUrl;

    // Calculate dimensions (max 800px width)
    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / img.width);
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    // Draw to canvas with compression
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, width, height);

    // Compress to JPEG with quality 0.6 (target ~200KB)
    return canvas.toDataURL('image/jpeg', 0.6);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    // FIX B7: Compress to JPEG (max ~200KB)
    const quality = 0.6;
    const base64 = canvas.toDataURL('image/jpeg', quality);

    if (mode === 'odometer') {
      setOdometerPhoto(base64);
      setMode('battery');
    } else {
      setBatteryPhoto(base64);
    }
  }, [mode]);

  const retakePhoto = (photoType: CaptureMode) => {
    if (photoType === 'odometer') {
      setOdometerPhoto(null);
      setMode('odometer');
    } else {
      setBatteryPhoto(null);
      setMode('battery');
    }
  };

  const handleConfirm = () => {
    stopCamera();
    onCapture({
      odometerPhoto,
      batteryPhoto,
      capturedAt: Date.now(),
      gpsLocation,
    });
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  const bothPhotosTaken = odometerPhoto && batteryPhoto;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <p className="text-[10px] text-zinc-400 font-mono">Anti-Spoofing Verification</p>
        </div>
        <button
          onClick={handleCancel}
          className="p-2 text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative">
        {cameraError ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
            <p className="text-sm text-zinc-300 mb-2">Kamera Tidak Tersedia</p>
            <p className="text-xs text-zinc-500 mb-4">{cameraError}</p>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-zinc-800 text-white text-sm rounded-lg"
            >
              Kembali
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay Guide */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Frame guide */}
              <div className="absolute inset-8 border-2 border-dashed border-emerald-400/60 rounded-2xl" />

              {/* Mode indicator */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
                  mode === 'odometer'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {mode === 'odometer' ? (
                    <>
                      <Gauge className="w-3.5 h-3.5" />
                      <span>Foto Odometer</span>
                    </>
                  ) : (
                    <>
                      <Battery className="w-3.5 h-3.5" />
                      <span>Foto Baterai SoC%</span>
                    </>
                  )}
                </div>
              </div>

              {/* GPS indicator */}
              {gpsLocation && (
                <div className="absolute bottom-4 left-4">
                  <div className="flex items-center gap-1 px-2 py-1 bg-black/60 rounded text-[10px] text-emerald-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    GPS: {gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Captured Photos Preview */}
      {(odometerPhoto || batteryPhoto) && (
        <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-800">
          <div className="flex gap-2 justify-center">
            {odometerPhoto && (
              <div className="relative">
                <img
                  src={odometerPhoto}
                  alt="Odometer"
                  className="w-16 h-16 object-cover rounded-lg border border-cyan-500/50"
                />
                <button
                  onClick={() => retakePhoto('odometer')}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-800 rounded-full flex items-center justify-center"
                >
                  <RefreshCw className="w-3 h-3 text-zinc-400" />
                </button>
                <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center text-cyan-400 bg-black/60 rounded-b-lg py-0.5">
                  ODO
                </span>
              </div>
            )}
            {batteryPhoto && (
              <div className="relative">
                <img
                  src={batteryPhoto}
                  alt="Battery"
                  className="w-16 h-16 object-cover rounded-lg border border-emerald-500/50"
                />
                <button
                  onClick={() => retakePhoto('battery')}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-800 rounded-full flex items-center justify-center"
                >
                  <RefreshCw className="w-3 h-3 text-zinc-400" />
                </button>
                <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center text-emerald-400 bg-black/60 rounded-b-lg py-0.5">
                  BATERAI
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="px-4 py-4 bg-zinc-950 border-t border-zinc-800">
        {!bothPhotosTaken ? (
          <button
            onClick={capturePhoto}
            disabled={!isStreaming}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Camera className="w-5 h-5" />
            <span>
              {mode === 'odometer' ? 'Ambil Foto Odometer' : 'Ambil Foto Baterai'}
            </span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => retakePhoto('odometer')}
              className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retake</span>
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Konfirmasi</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
