'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileShell } from '@/components/layout/MobileShell';
import { BottomNav, ScreenType } from '@/components/layout/BottomNav';
import { LoginVehicleScreen } from '@/components/screens/LoginVehicleScreen';
import { ActiveDrivingHUD } from '@/components/screens/ActiveDrivingHUD';
import { EndTripDashboard } from '@/components/screens/EndTripDashboard';
import { InstallBanner } from '@/components/InstallBanner';
import { EVVehicle, TripRecord, PhotoEvidence } from '@/types/telematics';
import { TelematicsState } from '@/hooks/useTelematics';
import { registerServiceWorker, skipWaiting } from '@/lib/sw-register';
import { setupAutoSync } from '@/lib/sync/engine';
import { supabase } from '@/lib/supabase/client';

function GoApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeScreen, setActiveScreen] = useState<ScreenType>('login');
  const [isDrivingActive, setIsDrivingActive] = useState<boolean>(false);
  const [selectedVehicle, setSelectedVehicle] = useState<EVVehicle | null>(null);
  const [currentTripData, setCurrentTripData] = useState<TripRecord | null>(null);
  const [finalTelemetry, setFinalTelemetry] = useState<TelematicsState | null>(null);
  const [tripStartTime, setTripStartTime] = useState<string>(new Date().toISOString());
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  const [startPhotoEvidence, setStartPhotoEvidence] = useState<PhotoEvidence>({
    odometerPhoto: null,
    batteryPhoto: null,
    capturedAt: 0,
    gpsLocation: null,
  });

  // Check login status
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('drivee_logged_in') === 'true';
    if (!isLoggedIn) {
      const screen = searchParams.get('screen');
      if (screen !== 'login') {
        router.replace('/login');
      }
    }
  }, [router, searchParams]);

  // Register service worker + auto-sync
  useEffect(() => {
    registerServiceWorker();
    const handleUpdate = () => setSwUpdateAvailable(true);
    window.addEventListener('sw-update-available', handleUpdate);
    const cleanupSync = setupAutoSync();
    return () => {
      window.removeEventListener('sw-update-available', handleUpdate);
      cleanupSync();
    };
  }, []);

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

  const handleEndTrip = (telemetry: TelematicsState) => {
    setIsDrivingActive(false);
    setFinalTelemetry(telemetry);
    setActiveScreen('end-trip');
  };

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
        {activeScreen === 'login' && (
          <LoginVehicleScreen onStartTrip={handleStartTrip} />
        )}

        {activeScreen === 'hud' && currentTripData && (
          <ActiveDrivingHUD
            onEndTrip={handleEndTrip}
            tripId={currentTripData.trip_id}
          />
        )}

        {activeScreen === 'end-trip' && currentTripData && (
          <EndTripDashboard
            tripData={{...currentTripData, start_time: tripStartTime}}
            finalTelemetry={finalTelemetry}
            onStartNewTrip={handleStartNewTrip}
            startPhotoEvidence={startPhotoEvidence}
          />
        )}
      </div>

      <BottomNav
        currentScreen={activeScreen}
        onNavigate={(screen) => setActiveScreen(screen)}
        isDrivingActive={isDrivingActive}
      />

      <InstallBanner />

      {swUpdateAvailable && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
          <div className="bg-zinc-900 border border-emerald-700 rounded-xl p-3 shadow-lg flex items-center justify-between">
            <span className="text-sm text-zinc-200">Update available!</span>
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

export default function GoPage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const isLoggedIn = localStorage.getItem('drivee_logged_in') === 'true';
      if (isLoggedIn) {
        if (mounted) {
          setIsAuthorized(true);
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && mounted) {
          localStorage.setItem('drivee_logged_in', 'true');
          setIsAuthorized(true);
        }
      } catch (err) {
        console.warn('Auth check error:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && mounted) {
        localStorage.setItem('drivee_logged_in', 'true');
        setIsAuthorized(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 text-sm mb-4">Please login first</p>
          <a href="/login" className="text-emerald-400 hover:text-emerald-300 text-sm">
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return <GoApp />;
}
