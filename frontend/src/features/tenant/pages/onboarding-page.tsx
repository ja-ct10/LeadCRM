'use client';

import React, { useState } from 'react';
import { ChevronRight, CheckCircle2, Users, Zap, BarChart3 } from 'lucide-react';
import { ONBOARDING_COMPLETE_KEY } from '@/shared/providers/auth-guard';

interface OnboardingPageProps {
  onNavigate: (path: string) => void;
  needsCompanySetup?: boolean;
}

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: 'Welcome to LeadCRM',
    subtitle: 'Your all-in-one CRM solution',
    icon: CheckCircle2,
    description: 'LeadCRM helps you manage contacts, track deals, automate workflows, and grow your business all in one place.',
    features: [
      'Centralized contact and deal management',
      'Powerful automation workflows',
      'Comprehensive reporting and analytics',
      'Team collaboration tools',
    ],
  },
  {
    id: 2,
    title: 'Manage Your Contacts',
    subtitle: 'Build stronger relationships',
    icon: Users,
    description: 'Organize all your contacts and companies in one place. Track interactions, add notes, and never miss a follow-up.',
    features: [
      'Contact and company profiles',
      'Activity timeline and history',
      'Custom fields and tags',
      'Email integration',
    ],
  },
  {
    id: 3,
    title: 'Automate Your Workflow',
    subtitle: 'Work smarter, not harder',
    icon: Zap,
    description: 'Create powerful automation workflows triggered by events. Reduce manual work and ensure consistent processes.',
    features: [
      'Trigger-based automations',
      'Email campaigns and sequences',
      'Task assignment and routing',
      'Custom workflow builder',
    ],
  },
  {
    id: 4,
    title: 'Track Your Performance',
    subtitle: 'Data-driven decisions',
    icon: BarChart3,
    description: 'Get insights into your sales pipeline, campaign performance, and team productivity with comprehensive analytics.',
    features: [
      'Pipeline velocity tracking',
      'Campaign performance metrics',
      'Team activity dashboards',
      'Custom report builder',
    ],
  },
];

export default function OnboardingPage({ onNavigate, needsCompanySetup = false }: OnboardingPageProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = ONBOARDING_STEPS.length;
  const step = ONBOARDING_STEPS[currentStep];
  const StepIcon = step.icon;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = () => {
    // Mark onboarding as complete so it's not shown again on subsequent logins
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    // If the user needs company setup (OAuth users), redirect there
    // Otherwise, go to dashboard
    if (needsCompanySetup) {
      onNavigate('company-setup');
    } else {
      onNavigate('dashboard');
    }
  };

  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="min-h-screen flex">
      {/* Left side - Blue gradient section */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-blue-600 via-blue-700 to-blue-800 relative overflow-hidden">
        {/* Geometric pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-300 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg">
              <img 
                src="/leadcrm_logo.png" 
                alt="LeadCRM Logo" 
                className="w-7 h-7 object-contain"
              />
            </div>
            <span className="text-xl font-bold">LeadCRM</span>
          </div>

          {/* Center content - Large icon */}
          <div className="flex items-center justify-center">
            <div className="w-32 h-32 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center">
              <StepIcon className="text-white" size={64} />
            </div>
          </div>

          {/* Progress indicator */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-100">Step {currentStep + 1} of {totalSteps}</span>
              <span className="text-blue-100">{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Content */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-slate-950">
        <div className="w-full max-w-lg space-y-8">
          {/* Mobile progress indicator */}
          <div className="lg:hidden space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Step {currentStep + 1} of {totalSteps}</span>
              <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Header */}
          <div>
            <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white mb-2">
              {step.title}
            </h1>
            <p className="text-blue-600 dark:text-blue-400 font-semibold text-lg">
              {step.subtitle}
            </p>
          </div>

          {/* Description */}
          <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
            {step.description}
          </p>

          {/* Features list */}
          <div className="space-y-4">
            {step.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="text-blue-600 dark:text-blue-400" size={14} />
                </div>
                <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-4 pt-4">
            {/* Hide Skip button when company setup is required */}
            {!needsCompanySetup && (
              <button
                onClick={handleSkip}
                className="px-6 h-11 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-semibold transition-colors"
              >
                Skip
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors active:scale-95 flex items-center justify-center gap-2"
            >
              {isLastStep ? (needsCompanySetup ? 'Continue to Setup' : 'Get Started') : 'Next'}
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Company setup required notice */}
          {needsCompanySetup && (
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100 text-center">
                <span className="font-semibold">Company profile required:</span> You'll need to complete your company details before accessing your dashboard.
              </p>
            </div>
          )}

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {ONBOARDING_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep 
                    ? 'w-8 bg-blue-600' 
                    : 'w-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
