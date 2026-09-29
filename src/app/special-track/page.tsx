'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import Link from 'next/link';

interface SpecialTrackJob {
  id: string;
  companyId: string;
  title: string;
  description: string;
  requirements: string[];
  vehicleCategory?: string;
  minEcoScore?: number;
  status: string;
  createdAt: string;
}

export default function SpecialTrackPage() {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<SpecialTrackJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      // TODO: Replace with actual API call
      setJobs([
        {
          id: 'st_001',
          companyId: 'comp_001',
          title: 'EV Fleet Driver - Premium Route',
          description: 'Join our premium EV shuttle service with competitive rates and flexible schedule.',
          requirements: ['Valid SIM B1', 'Min 1 year driving experience', 'Clean driving record'],
          vehicleCategory: 'premium',
          minEcoScore: 85,
          status: 'open',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'st_002',
          companyId: 'comp_002',
          title: 'Corporate Shuttle Driver',
          description: 'Provide shuttle service for corporate clients with professional standards.',
          requirements: ['Valid SIM B1', 'Professional appearance', 'Good communication skills'],
          vehicleCategory: 'professional',
          minEcoScore: 80,
          status: 'open',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (jobId: string) => {
    setApplying(jobId);
    setMessage(null);

    try {
      // TODO: Replace with actual API call
      setMessage({ type: 'success', text: 'Application submitted successfully!' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to submit application' });
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg viewBox="0 0 512 512" className="w-5 h-5">
                <rect width="512" height="512" rx="128" fill="#000000"/>
                <circle cx="256" cy="256" r="200" fill="#052e16" stroke="#10b981" stroke-width="12"/>
                <path d="M280 120L190 280H270L230 400L350 240H270L280 120Z" fill="#10b981"/>
                <path d="M200 150 L200 362 L280 362 Q350 362 350 256 Q350 150 280 150 Z" fill="none" stroke="#ffffff" stroke-width="16" stroke-linejoin="round"/>
                <circle cx="380" cy="380" r="24" fill="#F59E0B"/>
                <text x="380" y="388" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#052e16" text-anchor="middle">$</text>
                <path d="M130 380 Q150 360 130 340 Q110 360 130 380" fill="#34d399"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">Drifee</span>
          </div>
          <LanguageSwitcher />
        </div>

        {/* Info Banner */}
        <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-4 mb-8">
          <h2 className="text-lg font-semibold text-emerald-300 mb-2">Special Track</h2>
          <p className="text-sm text-emerald-400/80">
            Exclusive job opportunities for Drifee drivers. Your eco-driving score and vehicle category give you priority access.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {/* Jobs List */}
        <h2 className="text-xl font-semibold text-white mb-4">Open Positions</h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">Loading jobs...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{job.title}</h3>
                    <p className="text-sm text-zinc-400 mt-1">{job.description}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    job.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700'
                  }`}>
                    {job.status}
                  </span>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-zinc-500 mb-2">Requirements:</p>
                  <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                    {job.requirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    {job.vehicleCategory && (
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {job.vehicleCategory}
                      </span>
                    )}
                    {job.minEcoScore && (
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        Min Score: {job.minEcoScore}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleApply(job.id)}
                    disabled={applying === job.id || job.status !== 'open'}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      job.status === 'open'
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {applying === job.id ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-emerald-400 hover:text-emerald-300 text-sm">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
