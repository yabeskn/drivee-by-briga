'use client';

import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { MultiStepForm } from '@/components/forms/MultiStepForm';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import Link from 'next/link';

export default function VehicleRegistrationPage() {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    type: '',
    brand: '',
    model: '',
    year: '',
    color: '',
    ownershipStatus: '',
    leasingCompany: '',
    contractEnd: '',
    consortiumName: '',
    consortiumMembers: '',
    licensePlate: '',
    chassisNumber: '',
    engineNumber: '',
    stnkExpiry: '',
    batteryCapacity: '',
    odometer: '',
    vehiclePhoto: null as File | null,
    stnkPhoto: null as File | null,
    bpkbPhoto: null as File | null,
    leasingContract: null as File | null,
  });

  const steps = [
    { key: 'info', label: t.vehicle.steps.info },
    { key: 'ownership', label: t.vehicle.steps.ownership },
    { key: 'legal', label: t.vehicle.steps.legal },
    { key: 'battery', label: t.vehicle.steps.battery },
    { key: 'upload', label: t.vehicle.steps.upload },
    { key: 'review', label: t.vehicle.steps.review },
  ];

  const updateField = (field: string, value: string | File | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/register/vehicle', {
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
          <h1 className="text-2xl font-bold text-white">{t.vehicle.title}</h1>
          <p className="text-zinc-400 mt-2">{t.vehicle.subtitle}</p>
        </div>

        <MultiStepForm steps={steps} onSubmit={handleSubmit} isSubmitting={isSubmitting}>
          {(step, next, back) => (
            <>
              {step === 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">{t.vehicle.steps.info}</h3>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.type} *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => updateField('type', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    >
                      <option value="">{t.common.select}</option>
                      <option value="mpv">{t.vehicle.types.mpv}</option>
                      <option value="van">{t.vehicle.types.van}</option>
                      <option value="bus">{t.vehicle.types.bus}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.brand} *</label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => updateField('brand', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.model} *</label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => updateField('model', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.year} *</label>
                      <input
                        type="number"
                        value={formData.year}
                        onChange={(e) => updateField('year', e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.color} *</label>
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => updateField('color', e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">{t.vehicle.steps.ownership}</h3>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.ownershipStatus} *</label>
                    <select
                      value={formData.ownershipStatus}
                      onChange={(e) => updateField('ownershipStatus', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    >
                      <option value="">{t.common.select}</option>
                      <option value="company">{t.vehicle.ownership.company}</option>
                      <option value="leased">{t.vehicle.ownership.leased}</option>
                      <option value="personal">{t.vehicle.ownership.personal}</option>
                      <option value="consortium">{t.vehicle.ownership.consortium}</option>
                    </select>
                  </div>

                  {formData.ownershipStatus === 'leased' && (
                    <>
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.leasingCompany} *</label>
                        <input
                          type="text"
                          value={formData.leasingCompany}
                          onChange={(e) => updateField('leasingCompany', e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.contractEnd} *</label>
                        <input
                          type="date"
                          value={formData.contractEnd}
                          onChange={(e) => updateField('contractEnd', e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    </>
                  )}

                  {formData.ownershipStatus === 'consortium' && (
                    <>
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.consortiumName} *</label>
                        <input
                          type="text"
                          value={formData.consortiumName}
                          onChange={(e) => updateField('consortiumName', e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.consortiumMembers} *</label>
                        <textarea
                          value={formData.consortiumMembers}
                          onChange={(e) => updateField('consortiumMembers', e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                          rows={3}
                          required
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">{t.vehicle.steps.legal}</h3>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.licensePlate} *</label>
                    <input
                      type="text"
                      value={formData.licensePlate}
                      onChange={(e) => updateField('licensePlate', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.chassisNumber} *</label>
                    <input
                      type="text"
                      value={formData.chassisNumber}
                      onChange={(e) => updateField('chassisNumber', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.engineNumber} *</label>
                    <input
                      type="text"
                      value={formData.engineNumber}
                      onChange={(e) => updateField('engineNumber', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.stnkExpiry} *</label>
                    <input
                      type="date"
                      value={formData.stnkExpiry}
                      onChange={(e) => updateField('stnkExpiry', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">{t.vehicle.steps.battery}</h3>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.batteryCapacity} *</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.batteryCapacity}
                      onChange={(e) => updateField('batteryCapacity', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.odometer} *</label>
                    <input
                      type="number"
                      value={formData.odometer}
                      onChange={(e) => updateField('odometer', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">{t.vehicle.steps.upload}</h3>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.vehiclePhoto} *</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => updateField('vehiclePhoto', e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-zinc-800 file:text-zinc-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.stnkPhoto} *</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => updateField('stnkPhoto', e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-zinc-800 file:text-zinc-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.bpkbPhoto}</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => updateField('bpkbPhoto', e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-zinc-800 file:text-zinc-300"
                    />
                  </div>
                  {formData.ownershipStatus === 'leased' && (
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">{t.vehicle.fields.leasingContract} *</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => updateField('leasingContract', e.target.files?.[0] || null)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-zinc-800 file:text-zinc-300"
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white mb-4">{t.vehicle.steps.review}</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.vehicle.fields.type}</span>
                      <span className="text-white">{formData.type}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.vehicle.fields.brand}</span>
                      <span className="text-white">{formData.brand}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.vehicle.fields.model}</span>
                      <span className="text-white">{formData.model}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.vehicle.fields.ownershipStatus}</span>
                      <span className="text-white">{formData.ownershipStatus}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.vehicle.fields.licensePlate}</span>
                      <span className="text-white">{formData.licensePlate}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.vehicle.fields.batteryCapacity}</span>
                      <span className="text-white">{formData.batteryCapacity} kWh</span>
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
