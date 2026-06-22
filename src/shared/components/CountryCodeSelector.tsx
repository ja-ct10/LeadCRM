import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface Country {
  name: string;
  flag: string;
  code: string;
}

export const COUNTRIES: Country[] = [
  { name: 'United States', flag: '🇺🇸', code: '+1' },
  { name: 'United Kingdom', flag: '🇬🇧', code: '+44' },
  { name: 'Philippines', flag: '🇵🇭', code: '+63' },
  { name: 'Australia', flag: '🇦🇺', code: '+61' },
  { name: 'Canada', flag: '🇨🇦', code: '+1' },
  { name: 'Germany', flag: '🇩🇪', code: '+49' },
  { name: 'France', flag: '🇫🇷', code: '+33' },
  { name: 'Singapore', flag: '🇸🇬', code: '+65' },
  { name: 'Japan', flag: '🇯🇵', code: '+81' },
  { name: 'India', flag: '🇮🇳', code: '+91' },
  { name: 'New Zealand', flag: '🇳🇿', code: '+64' },
  { name: 'United Arab Emirates', flag: '🇦🇪', code: '+971' },
  { name: 'Saudi Arabia', flag: '🇸🇦', code: '+966' },
  { name: 'South Africa', flag: '🇿🇦', code: '+27' },
];

interface Props {
  selectedCode: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  id?: string;
}

export const CountryCodeSelector = ({ selectedCode, onChange, disabled, id }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filtered = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.code.includes(search)
  );

  const activeCountry = COUNTRIES.find(c => c.code === selectedCode) || COUNTRIES[2]; // Default Philippines

  return (
    <div className="relative inline-block text-left" ref={containerRef} id={id}>
      <button 
        type="button" 
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 h-[38px] px-3 border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-white/[0.02] rounded-l-lg text-xs md:text-sm text-slate-800 dark:text-slate-205 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="text-sm md:text-base">{activeCountry.flag}</span>
        <span className="font-semibold">{activeCountry.code}</span>
        <ChevronDown size={12} className="opacity-60" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 mt-1 w-60 bg-white dark:bg-[#080d19] border border-gray-200 dark:border-white/[0.1] rounded-xl shadow-2xl z-55 p-2 animate-in fade-in duration-100">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input 
              type="text" 
              placeholder="Search code..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="w-full text-[11px] px-2.5 pl-7 py-1.5 rounded-lg border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-slate-900 focus:outline-none text-slate-800 dark:text-white"
            />
          </div>
          <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-0.5">
            {filtered.map(c => (
              <button
                key={c.name}
                type="button"
                onClick={() => {
                  onChange(c.code);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between text-left text-[11px] px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-xs">{c.flag}</span>
                  <span className="truncate max-w-[100px]">{c.name}</span>
                </span>
                <span className="font-semibold text-slate-500">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
