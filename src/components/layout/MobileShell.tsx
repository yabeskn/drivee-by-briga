'use client';

import React from 'react';
import { Wifi, BatteryMedium, ShieldCheck } from 'lucide-react';

interface MobileShellProps {
  children: React.ReactNode;
  activeScreen: 'login' | 'hud' | 'end-trip';
  isOledBlack?: boolean;
}

export function MobileShell({ children, activeScreen, isOledBlack = false }: MobileShellProps) {
  const [currentTime, setCurrentTime] = React.useState('07:15');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`min-h-screen ${isOledBlack ? 'bg-black' : 'bg-zinc-950'} flex justify-center text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300`}>
      <div
        className={`w-full max-w-md min-h-screen flex flex-col relative ${
          isOledBlack ? 'bg-black' : 'bg-zinc-950'
        } border-x border-zinc-900/60 shadow-2xl overflow-x-hidden`}
      >
        <header
          className={`w-full flex items-center justify-between px-5 pt-3 pb-2 text-xs font-mono select-none z-30 ${
            isOledBlack ? 'bg-black text-zinc-400' : 'bg-zinc-950/80 backdrop-blur-md text-zinc-400 border-b border-zinc-900/50'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-zinc-200">{currentTime}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
              <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
              Drivee
            </span>
          </div>

          <div className="flex items-center space-x-2.5 text-zinc-400">
            <span className="text-[10px] tracking-tight uppercase font-medium text-emerald-400/90 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              GPS
            </span>
            <Wifi className="w-3.5 h-3.5 text-zinc-300" />
            <div className="flex items-center space-x-1">
              <span className="text-[10px] font-mono">92%</span>
              <BatteryMedium className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col relative w-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
