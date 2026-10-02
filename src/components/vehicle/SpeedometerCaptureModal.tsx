'use client';

import React, { useState, useRef } from 'react';
import {
  Camera,
  X,
  Gauge,
  Battery,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface SpeedometerCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleCode: string;
  onSuccess: (result: {
    odometerKm: number;
    batterySoc: number;
    imageBase64: string;
  }) => void;
}

export function SpeedometerCaptureModal({
  isOpen,
  onClose,
  vehicleCode,
  onSuccess,
}: SpeedometerCaptureModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<{
    odometer: number;
    soc: number;
    confidence: number;
    method: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Compress & resize image to ~40KB WebP using browser HTML5 Canvas
  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const webpData = canvas.toDataURL('image/webp', 0.8);
          resolve(webpData);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const compressedBase64 = await processImageFile(file);
      setImagePreview(compressedBase64);

      // Call Vision API
      const res = await fetch('/api/vision/parse-speedometer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: compressedBase64,
          vehicle_code: vehicleCode,
          timestamp: Date.now(),
        }),
      });

      const data = await res.json();

      if (data.success && data.odometer_km !== null && data.battery_soc_percent !== null) {
        setExtractedData({
          odometer: data.odometer_km,
          soc: data.battery_soc_percent,
          confidence: data.confidence,
          method: data.detection_method,
        });
      } else {
        setErrorMessage(data.error || 'AI kesulitan membaca angka speedometer. Pastikan foto tidak blur atau silau.');
      }
    } catch (err) {
      setErrorMessage(`Koneksi gagal: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (extractedData && imagePreview) {
      onSuccess({
        odometerKm: extractedData.odometer,
        batterySoc: extractedData.soc,
        imageBase64: imagePreview,
      });
      onClose();
    }
  };

  const handleRetake = () => {
    setImagePreview(null);
    setExtractedData(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1 rounded-xl"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Scan Speedometer AI</h3>
            <p className="text-[11px] text-zinc-400">Ekstraksi otomatis Odometer & Sisa Baterai</p>
          </div>
        </div>

        {/* Main View Area */}
        {!imagePreview ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-zinc-700/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-zinc-950/40 relative overflow-hidden group">
              {/* Silhouette guide overlay */}
              <div className="w-20 h-20 rounded-full border border-emerald-500/30 flex items-center justify-center mb-3 bg-emerald-500/5">
                <Gauge className="w-10 h-10 text-emerald-400 stroke-[1.5]" />
              </div>
              <p className="text-xs font-medium text-white mb-1">Arahkan Kamera ke Cluster MID</p>
              <p className="text-[10px] text-zinc-400 max-w-[200px]">
                Pastikan angka total km dan persen baterai terlihat jelas tanpa pantulan silau
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-colors shadow-lg shadow-emerald-500/10"
            >
              <Camera className="w-4 h-4" />
              <span>Ambil Foto Speedometer</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image Preview with scanline effect */}
            <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-video flex items-center justify-center">
              <img
                src={imagePreview}
                alt="Speedometer Capture"
                className="w-full h-full object-cover"
              />
              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center space-y-2 text-emerald-400">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <span className="text-[11px] font-mono tracking-wider font-semibold">
                    Menganalisis Model AI Laya...
                  </span>
                </div>
              )}
            </div>

            {/* Extraction Results */}
            {extractedData && (
              <div className="bg-zinc-950 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Terdeteksi Berhasil</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Akurasi {Math.round(extractedData.confidence * 100)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-xl">
                    <div className="flex items-center space-x-1 text-zinc-400 text-[10px]">
                      <Gauge className="w-3 h-3 text-emerald-400" />
                      <span>Odometer</span>
                    </div>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">
                      {extractedData.odometer.toLocaleString('id-ID')} km
                    </div>
                  </div>

                  <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-xl">
                    <div className="flex items-center space-x-1 text-zinc-400 text-[10px]">
                      <Battery className="w-3 h-3 text-emerald-400" />
                      <span>Baterai (SoC)</span>
                    </div>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">
                      {extractedData.soc}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-rose-400 text-[11px]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Foto Ulang</span>
              </button>

              <button
                type="button"
                disabled={!extractedData || isProcessing}
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Gunakan Data</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
