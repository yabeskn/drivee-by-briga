'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrigaCoinWidget } from '@/components/BrigaCoinWidget';

function EmbedContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || searchParams.get('user_id') || '';
  const apiKey = searchParams.get('apiKey') || searchParams.get('token') || '';
  const theme = (searchParams.get('theme') as 'dark' | 'light') || 'dark';
  const showDetails = searchParams.get('details') !== 'false';

  if (!userId) {
    return (
      <div className="p-4 bg-slate-900 text-rose-400 rounded-xl text-xs font-mono">
        Error: Parameter ?userId=... wajib disertakan pada iframe embed.
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto p-1">
      <BrigaCoinWidget
        userId={userId}
        apiKey={apiKey}
        theme={theme}
        showDetails={showDetails}
      />
    </div>
  );
}

export default function BrigaCoinEmbedPage() {
  return (
    <main className="min-h-screen bg-transparent flex items-center justify-center p-2 font-sans antialiased">
      <Suspense fallback={<div className="p-4 text-xs text-slate-400">Memuat widget...</div>}>
        <EmbedContent />
      </Suspense>
    </main>
  );
}
