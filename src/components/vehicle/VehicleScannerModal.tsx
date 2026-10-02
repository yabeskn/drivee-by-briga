'use client';

import React, { useState, useEffect } from 'react';
import {
  Radio,
  QrCode,
  Bluetooth,
  X,
  CheckCircle2,
  AlertCircle,
  Car,
  Camera,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useVehicleDetector } from '@/hooks/useVehicleDetector';
import type { EVVehicle } from '@/types/telematics';

interface VehicleScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableVehicles: EVVehicle[];
  onVehicleSelected: (vehicle: EVVehicle) => void;
}

export function VehicleScannerModal({
  isOpen,
  onClose,
  availableVehicles,
  onVehicleSelected,
}: VehicleScannerModalProps) {
  const [activeMode, setActiveMode] = useState<'nfc' | 'qr' | 'bluetooth'>('nfc');
  const [manualCode, setManualCode] = useState<string>('');
  const [detectedBtDevices, setDetectedBtDevices] = useState<string[]>([]);
  const [isScanningBt, setIsScanningBt] = useState<boolean>(false);

  const {
    isNfcSupported,
    isScanning,
    detectedCode,
    error,
    sensorType,
    startNfcScan,
    stopNfcScan,
    handleQrDetected,
    resetDetector,
  } = useVehicleDetector({
    onDetected: (code, method) => {
      // Find matching vehicle
      const matched = availableVehicles.find(
        (v) =>
          v.code.toLowerCase() === code.toLowerCase() ||
          v.licensePlate.toLowerCase() === code.toLowerCase() ||
          v.qrCodeToken?.toLowerCase() === code.toLowerCase() ||
          v.bluetoothName?.toLowerCase() === code.toLowerCase()
      );
      if (matched) {
        onVehicleSelected(matched);
        onClose();
      }
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isNfcSupported) {
        setActiveMode('nfc');
        startNfcScan();
      } else {
        setActiveMode('qr');
      }
    } else {
      stopNfcScan();
      resetDetector();
    }
  }, [isOpen, isNfcSupported, startNfcScan, stopNfcScan, resetDetector]);

  // Scan Bluetooth audio sinks from browser media devices
  const scanBluetoothAudio = async () => {
    setIsScanningBt(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const btLabels = devices
          .filter((d) => d.kind === 'audiooutput' || d.kind === 'audioinput')
          .map((d) => d.label)
          .filter((label) => label.length > 0);

        setDetectedBtDevices(Array.from(new Set(btLabels)));
      }
    } catch (err) {
      console.warn('Bluetooth audio scan error:', err);
    } finally {
      setIsScanningBt(false);
    }
  };

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim().toUpperCase();
    const matched = availableVehicles.find(
      (v) =>
        v.code.toUpperCase() === clean ||
        v.licensePlate.toUpperCase().replace(/\s+/g, '') === clean.replace(/\s+/g, '') ||
        v.bluetoothName?.toUpperCase() === clean
    );
    if (matched) {
      onVehicleSelected(matched);
      onClose();
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
            <Car className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Deteksi Fisik Mobil</h3>
            <p className="text-[11px] text-zinc-400">Hubungkan HP ke kendaraan armada</p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-xl mb-4 text-[11px] font-medium">
          {isNfcSupported && (
            <button
              onClick={() => {
                setActiveMode('nfc');
                startNfcScan();
              }}
              className={`py-1.5 rounded-lg flex items-center justify-center space-x-1 transition-colors ${
                activeMode === 'nfc' ? 'bg-zinc-800 text-emerald-400 shadow' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>NFC Tap</span>
            </button>
          )}

          <button
            onClick={() => {
              setActiveMode('qr');
              stopNfcScan();
            }}
            className={`py-1.5 rounded-lg flex items-center justify-center space-x-1 transition-colors ${
              activeMode === 'qr' ? 'bg-zinc-800 text-emerald-400 shadow' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Stiker QR</span>
          </button>

          <button
            onClick={() => {
              setActiveMode('bluetooth');
              stopNfcScan();
              scanBluetoothAudio();
            }}
            className={`py-1.5 rounded-lg flex items-center justify-center space-x-1 transition-colors ${
              activeMode === 'bluetooth' ? 'bg-zinc-800 text-sky-400 shadow' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Bluetooth className="w-3.5 h-3.5" />
            <span>Bluetooth</span>
          </button>
        </div>

        {/* Content by Mode */}
        {activeMode === 'nfc' && (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
            {/* Radar wave animation */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-28 h-28 rounded-full bg-emerald-500/10 animate-ping opacity-75" />
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Radio className="w-9 h-9 animate-pulse" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Tempelkan HP ke Phone Holder</p>
              <p className="text-[11px] text-zinc-400 max-w-[220px] mt-1">
                Sensor NFC membaca tag identitas armada di kabin mobil secara instan.
              </p>
            </div>
            {isScanning && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                ● Menunggu sentuhan tag...
              </span>
            )}
          </div>
        )}

        {activeMode === 'qr' && (
          <div className="space-y-4">
            <div className="border border-zinc-800 bg-zinc-950/70 rounded-2xl p-4 text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-emerald-400">
                <QrCode className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium text-white">Pindai Stiker QR di Dashboard</p>
              <p className="text-[10px] text-zinc-400">
                Arahkan kamera ke stiker QR unit di dekat spion tengah atau dashboard.
              </p>
            </div>

            {/* Quick selector of fleet units as demo / camera mock */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                Pilih Kode Unit Langsung:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {availableVehicles.map((v) => (
                  <button
                    key={v.id || v.code}
                    onClick={() => {
                      onVehicleSelected(v);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 text-left transition-colors"
                  >
                    <div className="font-mono text-xs font-bold text-white">{v.code}</div>
                    <div className="text-[10px] text-zinc-400 truncate">{v.licensePlate}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeMode === 'bluetooth' && (
          <div className="space-y-3">
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl space-y-1 text-left">
              <div className="flex items-center space-x-1.5 text-sky-400 text-xs font-semibold">
                <Bluetooth className="w-3.5 h-3.5" />
                <span>Pencocokan Audio Bluetooth</span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Pastikan HP sudah terhubung ke audio Bluetooth mobil armada.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                Kendaraan dengan Bluetooth Terdaftar:
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {availableVehicles
                  .filter((v) => v.bluetoothName)
                  .map((v) => (
                    <button
                      key={v.id || v.code}
                      onClick={() => {
                        onVehicleSelected(v);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-sky-500/40 text-left transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                          <span>{v.name}</span>
                          <span className="text-[10px] font-mono text-zinc-400">({v.code})</span>
                        </div>
                        <div className="text-[10px] text-sky-300 font-mono mt-0.5">
                          BT: {v.bluetoothName}
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-medium px-2 py-0.5 bg-emerald-500/10 rounded-md">
                        Pilih
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center space-x-2 text-rose-400 text-[11px]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
