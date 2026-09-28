'use client';

import Link from 'next/link';
import { useLanguage } from '@/i18n/LanguageContext';

export function CTA() {
  const { t } = useLanguage();

  return (
    <section className="py-20 bg-emerald-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-zinc-900">{t.cta.title}</h2>
          <p className="mt-4 text-zinc-600 max-w-xl mx-auto">{t.cta.subtitle}</p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register/driver"
              className="w-full sm:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors text-center"
            >
              {t.cta.driver}
            </Link>
            <Link
              href="/register/vehicle"
              className="w-full sm:w-auto px-8 py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-medium rounded-lg transition-colors border border-zinc-200 text-center"
            >
              {t.cta.vehicle}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
