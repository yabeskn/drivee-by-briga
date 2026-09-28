import type { Metadata } from 'next';
import { LanguageProvider } from '@/i18n/LanguageContext';

export const metadata: Metadata = {
  title: 'Drivee by Briga — Smart EV Fleet Telematics',
  description: 'Drivee by Briga — Smart EV Fleet Telematics PWA for eco-driving and rewards.',
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-white text-zinc-900">
        {children}
      </div>
    </LanguageProvider>
  );
}
