'use client';

import Link from 'next/link';
import { useLanguage } from '@/i18n/LanguageContext';

export function Hero() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-sm font-medium text-emerald-700">Drive, Earn, and Track safely</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-zinc-900 tracking-tight">
            Drive, Earn, and Track
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-zinc-600 max-w-2xl mx-auto">
            Smart EV Fleet Telematics Platform
          </p>

          {/* Three Pillars */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-white rounded-xl p-5 border border-zinc-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">Drive</h3>
              <p className="text-xs text-zinc-500 mt-1">GPS tracking real-time untuk setiap perjalanan</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-zinc-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">Earn</h3>
              <p className="text-xs text-zinc-500 mt-1">BrigaCoins untuk setiap perjalanan eco-friendly</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-zinc-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">Track</h3>
              <p className="text-xs text-zinc-500 mt-1">Pantau emisi karbon & skor eco-driving</p>
            </div>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register/driver"
              className="w-full sm:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors text-center"
            >
              {t.hero.ctaPrimary}
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto px-8 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium rounded-lg transition-colors text-center"
            >
              {t.hero.ctaSecondary}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
