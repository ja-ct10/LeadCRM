'use client';

import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import { FormSettings } from '../types/form.types';

interface FormSettingsPanelProps {
  settings: FormSettings;
  onChange: (s: FormSettings) => void;
}

export function FormSettingsPanel({ settings, onChange }: FormSettingsPanelProps): React.ReactElement {
  const update = (patch: Partial<FormSettings>) => onChange({ ...settings, ...patch });

  const updateUtm = (idx: number, key: 'key' | 'mapTo', val: string) => {
    const next = settings.utmParams.map((p, i) => (i === idx ? { ...p, [key]: val } : p));
    update({ utmParams: next });
  };

  const addUtm = () => update({ utmParams: [...settings.utmParams, { key: '', mapTo: '' }] });

  const removeUtm = (idx: number) => update({ utmParams: settings.utmParams.filter((_, i) => i !== idx) });

  return (
    <div className="max-w-xl space-y-6">
      {/* Email notification */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Email notification for form submissions</h3>
          <span className="text-[10px] text-slate-400 font-medium">Optional</span>
        </div>
        <input type="email" value={settings.notificationEmail} onChange={(e) => update({ notificationEmail: e.target.value })}
          placeholder="e.g. alerts@yourcompany.com"
          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-400" />
      </div>

      {/* UTM / URL parameters */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <input type="checkbox" id="track-url-params" checked={settings.trackUrlParams}
            onChange={(e) => update({ trackUrlParams: e.target.checked })}
            className="mt-0.5 w-4 h-4 accent-blue-500 cursor-pointer" />
          <div>
            <label htmlFor="track-url-params" className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">Track URL Parameters</label>
            <p className="text-xs text-slate-400 mt-0.5">Automatically save URL parameters e.g. Google Analytics utm_campaign, utm_medium, etc.</p>
          </div>
        </div>

        {settings.trackUrlParams && (
          <div className="space-y-3 pt-1">
            {settings.utmParams.map((param, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Parameter key</label>
                  <input type="text" value={param.key} onChange={(e) => updateUtm(idx, 'key', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div className="flex items-end pb-1 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
                <div className="flex-1 space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Map to CRM Field <span className="text-slate-300 dark:text-slate-600 normal-case font-normal">Optional</span></label>
                  <select value={param.mapTo} onChange={(e) => updateUtm(idx, 'mapTo', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-blue-500 transition-colors appearance-none">
                    <option value="">Select a field</option>
                    <option value="source">Lead Source</option>
                    <option value="medium">Medium</option>
                    <option value="campaign">Campaign</option>
                    <option value="content">Content</option>
                    <option value="keyword">Keyword</option>
                  </select>
                </div>
                <button onClick={() => removeUtm(idx)} className="shrink-0 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer mt-5">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button onClick={addUtm} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">
              <Plus size={14} /> Add parameter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
