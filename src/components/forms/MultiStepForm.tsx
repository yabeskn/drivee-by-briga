'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

interface Step {
  key: string;
  label: string;
}

interface MultiStepFormProps {
  steps: Step[];
  children: (step: number, next: () => void, back: () => void) => React.ReactNode;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function MultiStepForm({ steps, children, onSubmit, isSubmitting }: MultiStepFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useLanguage();

  const next = () => setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setCurrentStep((s) => Math.max(s - 1, 0));
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index < currentStep
                      ? 'bg-emerald-500 text-white'
                      : index === currentStep
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span className="mt-2 text-[10px] text-zinc-400 hidden sm:block">
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-emerald-500' : 'bg-zinc-800'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
        {children(currentStep, next, back)}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          disabled={currentStep === 0}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t.form.back}
        </button>

        {isLastStep ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isSubmitting ? '...' : t.form.submit}
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t.form.next}
          </button>
        )}
      </div>
    </div>
  );
}
