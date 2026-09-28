'use client';

import Link from 'next/link';
import { useLanguage } from '@/i18n/LanguageContext';

export function Hero() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-zinc-900 tracking-tight">
            {t.hero.title}
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-zinc-600 max-w-2xl mx-auto">
            {t.hero.subtitle}
          </p>
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
