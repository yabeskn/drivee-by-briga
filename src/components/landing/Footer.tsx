'use client';

import Link from 'next/link';
import { useLanguage } from '@/i18n/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-zinc-900 text-zinc-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <svg viewBox="0 0 512 512" className="w-5 h-5">
                  <rect width="512" height="512" rx="128" fill="#000000"/>
                  <circle cx="256" cy="256" r="200" fill="#052e16" stroke="#10b981" strokeWidth="12"/>
                  <path d="M280 120L190 280H270L230 400L350 240H270L280 120Z" fill="#34d399"/>
                  <path d="M200 150 L200 362 L280 362 Q350 362 350 256 Q350 150 280 150 Z" fill="none" stroke="#ffffff" strokeWidth="16" strokeLinejoin="round"/>
                  <path d="M380 380 Q400 360 380 340 Q360 360 380 380" fill="#10b981"/>
                </svg>
              </div>
              <span className="text-lg font-semibold text-white">
                Drifee
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-normal ml-1">
                  by Briga
                </span>
              </span>
            </div>
            <p className="text-sm max-w-sm">{t.footer.description}</p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">{t.footer.product}</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">{t.nav.features}</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">{t.nav.howItWorks}</a></li>
              <li><Link href="/register/driver" className="hover:text-white transition-colors">{t.cta.driver}</Link></li>
              <li><Link href="/register/vehicle" className="hover:text-white transition-colors">{t.cta.vehicle}</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">{t.footer.company}</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">{t.footer.contact}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{t.footer.privacy}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{t.footer.terms}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 text-center text-sm">
          {t.footer.copyright}
        </div>
      </div>
    </footer>
  );
}
