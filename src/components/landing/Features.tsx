'use client';

import { useLanguage } from '@/i18n/LanguageContext';

export function Features() {
  const { t } = useLanguage();

  const pillars = [
    {
      key: 'drive',
      title: 'Drive',
      desc: 'GPS tracking real-time, dynamic polling, dan WakeLock untuk perjalanan yang aman dan efisien.',
      color: 'emerald',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      key: 'earn',
      title: 'Earn',
      desc: 'BrigaCoins untuk setiap perjalanan eco-friendly. Skor tinggi = reward lebih besar.',
      color: 'amber',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'track',
      title: 'Track',
      desc: 'Pantau emisi karbon, skor eco-driving, dan riwayat perjalanan secara transparan.',
      color: 'emerald',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
  ];

  return (
    <section id="features" className="py-20 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-zinc-900">Cara Kerja Kami</h2>
          <p className="mt-4 text-zinc-600">Tiga pilar value proposition Drifee</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pillars.map((pillar) => (
            <div key={pillar.key} className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                pillar.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {pillar.icon}
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">{pillar.title}</h3>
              <p className="text-sm text-zinc-600">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
