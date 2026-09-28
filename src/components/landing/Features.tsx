'use client';

import { MapPin, TrendingUp, Coins, WifiOff } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

export function Features() {
  const { t } = useLanguage();

  const features = [
    { icon: MapPin, title: t.features.gps.title, desc: t.features.gps.desc },
    { icon: TrendingUp, title: t.features.eco.title, desc: t.features.eco.desc },
    { icon: Coins, title: t.features.rewards.title, desc: t.features.rewards.desc },
    { icon: WifiOff, title: t.features.offline.title, desc: t.features.offline.desc },
  ];

  return (
    <section id="features" className="py-20 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-zinc-900">{t.features.title}</h2>
          <p className="mt-4 text-zinc-600">{t.features.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-white rounded-xl p-6 border border-zinc-200">
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
