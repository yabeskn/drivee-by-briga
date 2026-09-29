import { LanguageProvider } from '@/i18n/LanguageContext';

export default function SpecialTrackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-black text-zinc-100">
        {children}
      </div>
    </LanguageProvider>
  );
}
