'use client';

import { UserPlus, Download, Play, Gift } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

export function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    { icon: UserPlus, title: t.howItWorks.step1.title, desc: t.howItWorks.step1.desc },
    { icon: Download, title: t.howItWorks.step2.title, desc: t.howItWorks.step2.desc },
    { icon: Play, title: t.howItWorks.step3.title, desc: t.howItWorks.step3.desc },
    { icon: Gift, title: t.howItWorks.step4.title, desc: t.howItWorks.step4.desc },
  ];

  return (
    <section id="how-it-works" className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-zinc-900">{t.howItWorks.title}</h2>
          <p className="mt-4 text-zinc-600">{t.howItWorks.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="text-sm font-medium text-emerald-600 mb-2">
                {index + 1}
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">{step.title}</h3>
              <p className="text-sm text-zinc-600">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
