'use client';

import React, { useState, useEffect } from 'react';
import { MobileShell } from '@/components/layout/MobileShell';
import { BottomNav, ScreenType } from '@/components/layout/BottomNav';
import { LoginVehicleScreen } from '@/components/screens/LoginVehicleScreen';
import { ActiveDrivingHUD } from '@/components/screens/ActiveDrivingHUD';
import { EndTripDashboard } from '@/components/screens/EndTripDashboard';
import { InstallBanner } from '@/components/InstallBanner';
import { MOCK_VEHICLES, MOCK_END_TRIP_RECORD } from '@/lib/mock-data';
import { EVVehicle, TripRecord, PhotoEvidence } from '@/types/telematics';
import { TelematicsState } from '@/hooks/useTelematics';
import { registerServiceWorker, skipWaiting } from '@/lib/sw-register';
import { setupOnlineSync } from '@/lib/offline-sync';

export default function Home() {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('login');
  const [isDrivingActive, setIsDrivingActive] = useState<boolean>(false);
  const [selectedVehicle, setSelectedVehicle] = useState<EVVehicle>(MOCK_VEHICLES[0]);
  const [currentTripData, setCurrentTripData] = useState<TripRecord>(MOCK_END_TRIP_RECORD);
  const [finalTelemetry, setFinalTelemetry] = useState<TelematicsState | null>(null);
  const [tripStartTime, setTripStartTime] = useState<string>(new Date().toISOString());
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  // Photo evidence from start trip
  const [startPhotoEvidence, setStartPhotoEvidence] = useState<PhotoEvidence>({
    odometerPhoto: null,
    batteryPhoto: null,
    capturedAt: 0,
    gpsLocation: null,
  });

  // ── PWA: Register Service Worker ──────────────────────────
  useEffect(() => {
    registerServiceWorker();

    // Listen for SW updates
    const handleUpdate = () => setSwUpdateAvailable(true);
    window.addEventListener('sw-update-available', handleUpdate);

    // ── PWA: Setup offline sync ──
    const cleanupSync = setupOnlineSync();

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate);
      cleanupSync();
    };
  }, []);

  // Transition from Login/Pre-drive to Active HUD
  const handleStartTrip = (config: {
    vehicle: EVVehicle;
    startSoc: number;
    startOdo: number;
    corridor: string;
    photoEvidence: PhotoEvidence;
  }) => {
    setSelectedVehicle(config.vehicle);
    setTripStartTime(new Date().toISOString());
    setStartPhotoEvidence(config.photoEvidence);
    setIsDrivingActive(true);
    setActiveScreen('hud');
  };

  // Transition from Active HUD to End Trip Summary
  const handleEndTrip = (telemetry: TelematicsState) => {
    setIsDrivingActive(false);
    setFinalTelemetry(telemetry);
    setActiveScreen('end-trip');
  };

  // Transition from End Trip back to Start / Login
  const handleStartNewTrip = () => {
    setActiveScreen('login');
    setFinalTelemetry(null);
    setStartPhotoEvidence({
      odometerPhoto: null,
      batteryPhoto: null,
      capturedAt: 0,
      gpsLocation: null,
    });
  };

  // Handle SW update
  const handleUpdateApp = async () => {
    await skipWaiting();
    window.location.reload();
  };

  return (
    <MobileShell
      activeScreen={activeScreen}
      isOledBlack={activeScreen === 'hud'}
    >
      <div className="flex-1 flex flex-col w-full h-full">
        {/* Screen 1: Layar Login & Pilih Kendaraan */}
        {activeScreen === 'login' && (
          <LoginVehicleScreen onStartTrip={handleStartTrip} />
        )}

        {/* Screen 2: Tampilan 'Active Driving' khusus (Dark HUD Mode OLED) */}
        {activeScreen === 'hud' && (
          <ActiveDrivingHUD
            onEndTrip={handleEndTrip}
            tripId={currentTripData.trip_id}
          />
        )}

        {/* Screen 3: Dashboard 'End Trip' untuk melihat Eco Score */}
        {activeScreen === 'end-trip' && (
          <EndTripDashboard
            tripData={{...currentTripData, start_time: tripStartTime}}
            finalTelemetry={finalTelemetry}
            onStartNewTrip={handleStartNewTrip}
            startPhotoEvidence={startPhotoEvidence}
          />
        )}
      </div>

      {/* Bottom Navigation for seamless evaluation between screens */}
      <BottomNav
        currentScreen={activeScreen}
        onNavigate={(screen) => setActiveScreen(screen)}
        isDrivingActive={isDrivingActive}
      />

      {/* PWA Install Banner */}
      <InstallBanner />

      {/* SW Update Notification */}
      {swUpdateAvailable && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
          <div className="bg-zinc-900 border border-emerald-700 rounded-xl p-3 shadow-lg flex items-center justify-between">
            <span className="text-sm text-zinc-200">Update tersedia!</span>
            <button
              onClick={handleUpdateApp}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Update
            </button>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
