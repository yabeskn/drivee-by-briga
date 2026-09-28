'use client';

import { useLanguage } from '@/i18n/LanguageContext';
import { languages } from '@/i18n/config';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            language === lang.code
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          {lang.flag} {lang.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
