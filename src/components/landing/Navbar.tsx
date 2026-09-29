'use client';

import Link from 'next/link';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function Navbar() {
  const { t } = useLanguage();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/landing" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg viewBox="0 0 512 512" className="w-5 h-5">
                <rect width="512" height="512" rx="128" fill="#000000"/>
                <circle cx="256" cy="256" r="200" fill="#052e16" stroke="#10b981" stroke-width="12"/>
                <path d="M280 120L190 280H270L230 400L350 240H270L280 120Z" fill="#34d399"/>
                <path d="M200 150 L200 362 L280 362 Q350 362 350 256 Q350 150 280 150 Z" fill="none" stroke="#ffffff" stroke-width="16" stroke-linejoin="round"/>
                <path d="M380 380 Q400 360 380 340 Q360 360 380 380" fill="#10b981"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-zinc-900">
              Drifee
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-normal ml-1">
                by Briga
              </span>
            </span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
              {t.nav.features}
            </a>
            <a href="#how-it-works" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
              {t.nav.howItWorks}
            </a>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-3">
            <LanguageSwitcher />
            <Link
              href="/register/driver"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {t.nav.register}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
