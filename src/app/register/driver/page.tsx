'use client';

import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { MultiStepForm } from '@/components/forms/MultiStepForm';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import Link from 'next/link';

export default function DriverRegistrationPage() {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    nationalId: '',
    phone: '',
    email: '',
    address: '',
    licenseType: '',
    licenseNumber: '',
    licenseExpiry: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  });

  const steps = [
    { key: 'personal', label: t.driver.steps.personal },
    { key: 'license', label: t.driver.steps.license },
    { key: 'emergency', label: t.driver.steps.emergency },
    { key: 'bank', label: t.driver.steps.bank },
    { key: 'review', label: t.driver.steps.review },
  ];

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/register/driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsSuccess(true);
      }
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">{t.form.success}</h2>
          <p className="text-zinc-400 mb-6">{t.form.successDesc}</p>
          <Link
            href="/landing"
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/landing" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg viewBox="0 0 512 512" className="w-5 h-5">
                <rect width="512" height="512" rx="128" fill="#000000"/>
                <circle cx="256" cy="256" r="200" fill="#052e16" stroke="#10b981" stroke-width="12"/>
                <path d="M280 120L190 280H270L230 400L350 240H270L280 120Z" fill="#34d399"/>
                <path d="M200 150 L200 362 L280 362 Q350 362 350 256 Q350 150 280 150 Z" fill="none" stroke="#ffffff" stroke-width="16" stroke-linejoin="round"/>
                <path d="M380 380 Q400 360 380 340 Q360 360 380 380" fill="#10b981"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">Drifee</span>
          </Link>
          <LanguageSwitcher />
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">{t.driver.title}</h1>
          <p className="text-zinc-400 mt-2">{t.driver.subtitle}</p>
        </div>

        <MultiStepForm steps={steps} onSubmit={handleSubmit} isSubmitting={isSubmitting}>
          {(step, next, back) => (
            <>
              {step === 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">{t.driver.steps.personal}</h3>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.fullName} *</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => updateField('fullName', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.nationalId} *</label>
                    <input
                      type="text"
                      value={formData.nationalId}
                      onChange={(e) => updateField('nationalId', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      maxLength={16}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.phone} *</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.email} *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.address} *</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      rows={3}
                      required
                    />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">{t.driver.steps.license}</h3>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.licenseType} *</label>
                    <select
                      value={formData.licenseType}
                      onChange={(e) => updateField('licenseType', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    >
                      <option value="">{t.common.select}</option>
                      <option value="A">{t.driver.licenseTypes.A}</option>
                      <option value="B1">{t.driver.licenseTypes.B1}</option>
                      <option value="B2">{t.driver.licenseTypes.B2}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.licenseNumber} *</label>
                    <input
                      type="text"
                      value={formData.licenseNumber}
                      onChange={(e) => updateField('licenseNumber', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.licenseExpiry} *</label>
                    <input
                      type="date"
                      value={formData.licenseExpiry}
                      onChange={(e) => updateField('licenseExpiry', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">{t.driver.steps.emergency}</h3>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.emergencyName} *</label>
                    <input
                      type="text"
                      value={formData.emergencyName}
                      onChange={(e) => updateField('emergencyName', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.emergencyPhone} *</label>
                    <input
                      type="tel"
                      value={formData.emergencyPhone}
                      onChange={(e) => updateField('emergencyPhone', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.emergencyRelation} *</label>
                    <input
                      type="text"
                      value={formData.emergencyRelation}
                      onChange={(e) => updateField('emergencyRelation', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">{t.driver.steps.bank}</h3>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.bankName} *</label>
                    <select
                      value={formData.bankName}
                      onChange={(e) => updateField('bankName', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    >
                      <option value="">{t.common.select}</option>
                      <option value="BCA">{t.driver.banks.bca}</option>
                      <option value="Mandiri">{t.driver.banks.mandiri}</option>
                      <option value="BNI">{t.driver.banks.bni}</option>
                      <option value="BRI">{t.driver.banks.bri}</option>
                      <option value="other">{t.driver.banks.other}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.accountNumber} *</label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => updateField('accountNumber', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.driver.fields.accountHolder} *</label>
                    <input
                      type="text"
                      value={formData.accountHolder}
                      onChange={(e) => updateField('accountHolder', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">{t.driver.steps.review}</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.driver.fields.fullName}</span>
                      <span className="text-white">{formData.fullName}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.driver.fields.nationalId}</span>
                      <span className="text-white">{formData.nationalId}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.driver.fields.phone}</span>
                      <span className="text-white">{formData.phone}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.driver.fields.email}</span>
                      <span className="text-white">{formData.email}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.driver.fields.licenseType}</span>
                      <span className="text-white">{formData.licenseType}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.driver.fields.bankName}</span>
                      <span className="text-white">{formData.bankName}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </MultiStepForm>
      </div>
    </div>
  );
}
