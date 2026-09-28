export type Language = 'id' | 'en';

export const defaultLanguage: Language = 'id';

export const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];
