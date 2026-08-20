'use client';

import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/shared/services/auth.api';
import { z } from 'zod';

const companySetupSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  industry: z.string().min(1, 'Please select an industry'),
  companySize: z.string().min(1, 'Please select company size'),
  businessWebsite: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

interface CompanySetupPageProps {
  onNavigate: (path: string) => void;
}

export default function CompanySetupPage({ onNavigate }: CompanySetupPageProps): React.ReactElement {
  const [formData, setFormData] = useState({
    companyName: '',
    industry: '',
    companySize: '',
    businessWebsite: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      companySetupSchema.parse(formData);
    } catch (err: unknown) {
      const zodErr = err as z.ZodError;
      const newErrors: Record<string, string> = {};
      zodErr.errors.forEach((error) => {
        if (error.path[0]) {
          newErrors[error.path[0] as string] = error.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.completeOAuthProfile({
        companyName: formData.companyName,
        industry: formData.industry,
        companySize: formData.companySize,
        country: 'US', // Default or could be added to form
      });
      
      if (response?.success || (response as any)?.data?.success) {
        toast.success('Company profile completed!');
        onNavigate('dashboard');
      } else {
        setErrors({ general: 'Failed to save company profile. Please try again.' });
      }
    } catch (err: unknown) {
      setErrors({ general: err instanceof Error ? err.message : 'An error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

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

          {/* Center content */}
          <div className="space-y-6">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-6">
              <Building2 className="text-white" size={40} />
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight">
              Complete Your Profile
            </h1>
            <p className="text-blue-100 text-lg max-w-md">
              Tell us about your company to personalize your LeadCRM experience. This helps us tailor features and recommendations for your business.
            </p>
            
            {/* Benefits */}
            <div className="space-y-4 mt-8">
              {['Industry-specific insights', 'Customized workflows', 'Relevant integrations', 'Better support'].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-blue-50">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div></div>
        </div>
      </div>

      {/* Right side - Setup form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-slate-950">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div>
            <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Company Details
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Complete your profile to get started
            </p>
          </div>

          {errors.general && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm">
              {errors.general}
            </div>
          )}

          {/* Setup form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="companyName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Company Name *
              </label>
              <input
                id="companyName"
                type="text"
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className="w-full h-11 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/8 rounded-xl px-4 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Your Company Inc."
                required
                autoFocus
              />
              {errors.companyName && <p className="text-xs text-red-500 mt-1">{errors.companyName}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="industry" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Industry *
                </label>
                <select
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => handleChange('industry', e.target.value)}
                  className="w-full h-11 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/8 rounded-xl px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  required
                >
                  <option value="">Select...</option>
                  <option value="IT Solutions">IT Solutions</option>
                  <option value="Telecom">Telecom</option>
                  <option value="Security">Security</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Finance">Finance</option>
                  <option value="Retail">Retail</option>
                  <option value="Other">Other</option>
                </select>
                {errors.industry && <p className="text-xs text-red-500 mt-1">{errors.industry}</p>}
              </div>

              <div>
                <label htmlFor="companySize" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Company Size *
                </label>
                <select
                  id="companySize"
                  value={formData.companySize}
                  onChange={(e) => handleChange('companySize', e.target.value)}
                  className="w-full h-11 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/8 rounded-xl px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  required
                >
                  <option value="">Select...</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="500+">500+</option>
                </select>
                {errors.companySize && <p className="text-xs text-red-500 mt-1">{errors.companySize}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="businessWebsite" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Business Website
              </label>
              <input
                id="businessWebsite"
                type="url"
                value={formData.businessWebsite}
                onChange={(e) => handleChange('businessWebsite', e.target.value)}
                className="w-full h-11 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/8 rounded-xl px-4 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="https://yourcompany.com"
              />
              {errors.businessWebsite && <p className="text-xs text-red-500 mt-1">{errors.businessWebsite}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>

          {/* Note */}
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            You can update these details later in your settings
          </p>
        </div>
      </div>
    </div>
  );
}
