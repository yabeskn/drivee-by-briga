'use client';

import React from 'react';
import { KeyRound, Gauge, Trophy } from 'lucide-react';

export type ScreenType = 'login' | 'hud' | 'end-trip';

interface BottomNavProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  isDrivingActive: boolean;
}

export function BottomNav({ currentScreen, onNavigate, isDrivingActive }: BottomNavProps) {
  return (
    <nav
      className={`sticky bottom-0 w-full z-40 transition-colors border-t select-none ${
        currentScreen === 'hud'
          ? 'bg-black/95 border-zinc-900/80 backdrop-blur'
          : 'bg-zinc-950/95 border-zinc-900 backdrop-blur'
      }`}
    >
      <div className="flex items-center justify-around py-2 px-2 max-w-md mx-auto">
        <button
          onClick={() => onNavigate('login')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-lg transition-colors ${
            currentScreen === 'login'
              ? 'text-emerald-400 font-medium'
              : 'text-zinc-500'
          }`}
        >
          <KeyRound className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Drive</span>
        </button>

        <button
          onClick={() => onNavigate('hud')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-lg transition-colors ${
            currentScreen === 'hud'
              ? 'text-emerald-400 font-medium'
              : isDrivingActive
              ? 'text-amber-400'
              : 'text-zinc-500'
          }`}
        >
          <Gauge className="w-5 h-5 mb-1" />
          <span className="text-[10px]">HUD</span>
        </button>

        <button
          onClick={() => onNavigate('end-trip')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-lg transition-colors ${
            currentScreen === 'end-trip'
              ? 'text-emerald-400 font-medium'
              : 'text-zinc-500'
          }`}
        >
          <Trophy className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Score</span>
        </button>
      </div>
    </nav>
  );
}
