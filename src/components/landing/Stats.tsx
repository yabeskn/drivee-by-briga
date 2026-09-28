'use client';

import { useLanguage } from '@/i18n/LanguageContext';

export function Stats() {
  const { t } = useLanguage();

  const stats = [
    { value: '10K+', label: t.stats.trips },
    { value: '500T', label: t.stats.co2 },
    { value: '500+', label: t.stats.drivers },
    { value: '200+', label: t.stats.vehicles },
  ];

  return (
    <section className="py-20 bg-zinc-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white">{t.stats.title}</h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-bold text-emerald-400 mb-2">{stat.value}</div>
              <div className="text-sm text-zinc-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
