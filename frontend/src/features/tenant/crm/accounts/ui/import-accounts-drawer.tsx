'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CircleCheck,
  CircleX,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createAccountImport } from '@/shared/services/account-imports.api';
import type { AccountImportRow } from '@/shared/services/account-imports.api';

// ── Types ────────────────────────────────────────────────────────────────────

interface ImportAccountsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type WizardStep = 1 | 2 | 3;

interface CsvColumn { index: number; name: string; }
interface ColumnMapping { csvColumnIndex: number | null; csvColumnName: string | null; }

type AccountField = 'name' | 'industry' | 'website' | 'address' | 'city' | 'province' | 'country';

const ACCOUNT_FIELDS: { key: AccountField; label: string; required: boolean }[] = [
  { key: 'name', label: 'Company Name', required: true },
  { key: 'industry', label: 'Industry', required: false },
  { key: 'website', label: 'Website', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'province', label: 'Province', required: false },
  { key: 'country', label: 'Country', required: false },
];

const TEMPLATE_HEADERS = ['Company Name', 'Industry', 'Website', 'Address', 'City', 'Province', 'Country'];

// ── Auto-mapping ─────────────────────────────────────────────────────────────

function autoMapColumns(csvColumns: CsvColumn[]): Record<AccountField, ColumnMapping> {
  const mappings: Record<AccountField, ColumnMapping> = {
    name: { csvColumnIndex: null, csvColumnName: null },
    industry: { csvColumnIndex: null, csvColumnName: null },
    website: { csvColumnIndex: null, csvColumnName: null },
    address: { csvColumnIndex: null, csvColumnName: null },
    city: { csvColumnIndex: null, csvColumnName: null },
    province: { csvColumnIndex: null, csvColumnName: null },
    country: { csvColumnIndex: null, csvColumnName: null },
  };

  const rules: Record<AccountField, string[]> = {
    name: ['company name', 'company', 'name', 'company_name', 'organization', 'org', 'account name', 'account'],
    industry: ['industry', 'sector', 'business type'],
    website: ['website', 'url', 'web', 'site'],
    address: ['address', 'street', 'street address', 'full address'],
    city: ['city', 'town', 'municipality'],
    province: ['province', 'state', 'region'],
    country: ['country', 'nation'],
  };

  const used = new Set<number>();
  for (const field of ACCOUNT_FIELDS) {
    const patterns = rules[field.key];
    for (const col of csvColumns) {
      if (used.has(col.index)) continue;
      if (patterns.includes(col.name.toLowerCase().trim())) {
        mappings[field.key] = { csvColumnIndex: col.index, csvColumnName: col.name };
        used.add(col.index);
        break;
      }
    }
  }
  return mappings;
}

// ── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      if (current.length > 0 || lines.length > 0) { lines.push(current); current = ''; }
    } else { current += char; }
  }
  if (current.length > 0) lines.push(current);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const cells: string[] = []; let cell = ''; let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else { quoted = !quoted; } }
      else if (ch === ',' && !quoted) { cells.push(cell.trim()); cell = ''; }
      else { cell += ch; }
    }
    cells.push(cell.trim());
    return cells;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow).filter((r) => r.some((c) => c.length > 0));
  return { headers, rows };
}

// ── Row Validation ───────────────────────────────────────────────────────────

interface ValidatedRow {
  rowNumber: number;
  name: string; industry: string; website: string; address: string; city: string; province: string; country: string;
  isValid: boolean;
  errors: string[];
}

function validateRow(row: Record<AccountField, string>, rowNumber: number): ValidatedRow {
  const errors: string[] = [];
  if (!row.name.trim()) errors.push('Company Name is required.');
  return { rowNumber, ...row, isValid: errors.length === 0, errors };
}

// ── Component ────────────────────────────────────────────────────────────────

export function ImportAccountsDrawer({ isOpen, onClose, onImportComplete }: ImportAccountsDrawerProps): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<AccountField, ColumnMapping>>({
    name: { csvColumnIndex: null, csvColumnName: null },
    industry: { csvColumnIndex: null, csvColumnName: null },
    website: { csvColumnIndex: null, csvColumnName: null },
    address: { csvColumnIndex: null, csvColumnName: null },
    city: { csvColumnIndex: null, csvColumnName: null },
    province: { csvColumnIndex: null, csvColumnName: null },
    country: { csvColumnIndex: null, csvColumnName: null },
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ id: string; fileName: string; totalRecords: number; successfulRecords: number; failedRecords: number; status: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiredMapped = useMemo(() => mappings.name.csvColumnIndex !== null, [mappings]);

  const mapRow = useCallback((row: string[]): Record<AccountField, string> => {
    const result: Record<AccountField, string> = { name: '', industry: '', website: '', address: '', city: '', province: '', country: '' };
    for (const field of ACCOUNT_FIELDS) {
      const idx = mappings[field.key].csvColumnIndex;
      result[field.key] = idx !== null ? (row[idx] || '') : '';
    }
    return result;
  }, [mappings]);

  const previewRows = useMemo(() => csvRows.slice(0, 10).map((row) => mapRow(row)), [csvRows, mapRow]);

  const validatedRows = useMemo(() => {
    if (!requiredMapped) return [];
    return csvRows.map((row, index) => validateRow(mapRow(row), index + 2));
  }, [csvRows, mapRow, requiredMapped]);

  const validCount = useMemo(() => validatedRows.filter((r) => r.isValid).length, [validatedRows]);
  const errorCount = useMemo(() => validatedRows.filter((r) => !r.isValid).length, [validatedRows]);

  const resetState = useCallback(() => {
    setStep(1); setFile(null); setCsvHeaders([]); setCsvRows([]);
    setMappings({ name: { csvColumnIndex: null, csvColumnName: null }, industry: { csvColumnIndex: null, csvColumnName: null }, website: { csvColumnIndex: null, csvColumnName: null }, address: { csvColumnIndex: null, csvColumnName: null }, city: { csvColumnIndex: null, csvColumnName: null }, province: { csvColumnIndex: null, csvColumnName: null }, country: { csvColumnIndex: null, csvColumnName: null } });
    setIsImporting(false); setImportResult(null); setIsDragging(false);
  }, []);

  const handleClose = useCallback(() => { if (!isImporting) resetState(); onClose(); }, [isImporting, onClose, resetState]);

  const processFile = useCallback((selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) { toast.error('Please upload a CSV file.'); return; }
    if (selectedFile.size > 10 * 1024 * 1024) { toast.error('File size exceeds 10MB limit.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text || text.trim().length === 0) { toast.error('The uploaded CSV file does not contain any data.'); return; }
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0) { toast.error("We couldn't read this CSV file."); return; }
      if (rows.length === 0) { toast.error('The CSV file does not contain any data rows.'); return; }
      setFile(selectedFile); setCsvHeaders(headers); setCsvRows(rows);
      setMappings(autoMapColumns(headers.map((name, index) => ({ index, name }))));
      setStep(2);
    };
    reader.onerror = () => { toast.error("We couldn't read this CSV file."); };
    reader.readAsText(selectedFile);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) processFile(f); if (e.target) e.target.value = '';
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f);
  }, [processFile]);

  const handleMappingChange = useCallback((field: AccountField, value: string) => {
    setMappings((prev) => {
      const updated = { ...prev };
      if (value === '') { updated[field] = { csvColumnIndex: null, csvColumnName: null }; }
      else {
        const colIndex = Number(value);
        for (const key of Object.keys(updated) as AccountField[]) { if (updated[key].csvColumnIndex === colIndex) updated[key] = { csvColumnIndex: null, csvColumnName: null }; }
        updated[field] = { csvColumnIndex: colIndex, csvColumnName: csvHeaders[colIndex] };
      }
      return updated;
    });
  }, [csvHeaders]);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([TEMPLATE_HEADERS.join(',') + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'account-import-template.csv'; link.click(); URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(async () => {
    if (!file || !requiredMapped || isImporting) return;
    setIsImporting(true);
    try {
      const rows: AccountImportRow[] = csvRows.map((row, index) => ({ rowNumber: index + 2, ...mapRow(row) }));
      const response = await createAccountImport({ fileName: file.name, rows });
      setImportResult(response.data);
      toast.success('Import completed');
      onImportComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
      setIsImporting(false);
    }
  }, [file, requiredMapped, isImporting, csvRows, mapRow, onImportComplete]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <SlidingDrawer isOpen={isOpen} onClose={handleClose} title="Import Accounts" subtitle="Upload your CSV, map your columns, and review your data before importing." width="w-full max-w-lg md:max-w-2xl lg:max-w-3xl">
      <div className="flex flex-col h-full">
        {importResult ? (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400" /></div>
                <div><h3 className="text-base font-semibold text-slate-900 dark:text-white">Import Started</h3><p className="text-[13px] text-slate-500 dark:text-slate-400">Your account import has been processed.</p></div>
              </div>
              <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-[13px]"><span className="text-slate-500 dark:text-slate-400">File</span><span className="font-medium text-slate-900 dark:text-white">{importResult.fileName}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-slate-500 dark:text-slate-400">Total Records</span><span className="font-medium text-slate-900 dark:text-white">{importResult.totalRecords.toLocaleString()}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-slate-500 dark:text-slate-400">Imported</span><span className="font-medium text-emerald-600 dark:text-emerald-400">{importResult.successfulRecords.toLocaleString()}</span></div>
                {importResult.failedRecords > 0 && <div className="flex justify-between text-[13px]"><span className="text-slate-500 dark:text-slate-400">Failed</span><span className="font-medium text-red-600 dark:text-red-400">{importResult.failedRecords.toLocaleString()}</span></div>}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { handleClose(); router.push(`/crm/accounts/imports/${importResult.id}`); }} className="inline-flex items-center gap-2 h-9 px-5 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">View Details<ArrowRight size={14} /></button>
                <button onClick={handleClose} className="h-9 px-4 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">Close</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Step Indicator */}
            <div className="px-6 pt-4 pb-2">
              <div className="flex items-center gap-1" role="navigation" aria-label="Import steps">
                {[{ num: 1, label: 'Upload CSV' }, { num: 2, label: 'Map Columns' }, { num: 3, label: 'Review & Validate' }].map((s, i) => (
                  <React.Fragment key={s.num}>
                    <div className="flex items-center gap-2">
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all', step > s.num && 'bg-emerald-500 text-white', step === s.num && 'bg-blue-600 text-white ring-2 ring-blue-600/20', step < s.num && 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500')}>{step > s.num ? <CheckCircle2 size={14} /> : s.num}</div>
                      <span className={cn('text-[12px] font-medium hidden sm:inline', step === s.num ? 'text-slate-900 dark:text-white' : step > s.num ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500')}>{s.label}</span>
                    </div>
                    {i < 2 && <div className={cn('flex-1 h-px mx-2', step > s.num ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700')} />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {step === 1 && (
                <div className="space-y-6">
                  <div><h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Upload Your CSV</h3><p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">Upload your CSV file containing the accounts you want to import.</p></div>
                  {file ? (
                    <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0"><FileText size={20} className="text-emerald-600 dark:text-emerald-400" /></div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-900 dark:text-white truncate">{file.name}</p><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatFileSize(file.size)} &middot; {csvRows.length.toLocaleString()} records</p></div>
                        <button onClick={() => fileInputRef.current?.click()} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap">Replace File</button>
                      </div>
                    </div>
                  ) : (
                    <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onDragEnter={() => setIsDragging(true)} onDragLeave={() => setIsDragging(false)} onClick={() => fileInputRef.current?.click()} className={cn('border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all', isDragging ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/5 dark:border-blue-500' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-white/[0.02]')} role="button" tabIndex={0} aria-label="Upload CSV file" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}>
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto mb-3"><Upload size={22} className="text-blue-500" /></div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{isDragging ? 'Drop your CSV here' : 'Drag and drop your CSV here'}</p>
                      <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1.5">or</p>
                      <button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="mt-2 inline-flex items-center h-8 px-4 text-[12px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800/50 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">Browse Files</button>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">CSV files only &middot; Max 10MB</p>
                    </div>
                  )}
                  <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-start gap-3"><Info size={16} className="text-slate-400 mt-0.5 shrink-0" /><div className="flex-1"><p className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Don&apos;t have a CSV template?</p><p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">Use our template to see the required Account fields.</p><button onClick={handleDownloadTemplate} className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"><Download size={13} />Download CSV Template</button></div></div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div><h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Map Your Columns</h3><p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">Match each field to the corresponding column in your CSV.</p></div>
                  <div className="space-y-3">
                    {ACCOUNT_FIELDS.map((field) => {
                      const mapping = mappings[field.key];
                      const isMapped = mapping.csvColumnIndex !== null;
                      return (
                        <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <label className="text-[13px] font-medium text-slate-700 dark:text-slate-300 sm:w-36 shrink-0">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                          <div className="flex-1 relative">
                            <select value={mapping.csvColumnIndex !== null ? String(mapping.csvColumnIndex) : ''} onChange={(e) => handleMappingChange(field.key, e.target.value)} className={cn('w-full h-9 px-3 pr-8 text-[13px] rounded-lg border appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500', isMapped ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-700/50 text-emerald-800 dark:text-emerald-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300')} aria-label={`Map CSV column for ${field.label}`}>
                              <option value="">— Select CSV Column —</option>
                              {csvHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                            </select>
                            {isMapped && <CheckCircle2 size={14} className="absolute right-8 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!requiredMapped && <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-700/40"><AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" /><p className="text-[12px] text-amber-700 dark:text-amber-400"><span className="font-medium">Company Name</span> is required. Map a CSV column to continue.</p></div>}
                  {previewRows.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><p className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Uploaded Data Preview</p><p className="text-[11px] text-slate-400 dark:text-slate-500">Showing first {previewRows.length} records</p></div>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <table className="w-full text-[11px]">
                          <thead className="bg-slate-50 dark:bg-slate-800/60"><tr>{ACCOUNT_FIELDS.map((f) => <th key={f.key} className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">{f.label}</th>)}</tr></thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {previewRows.map((row, i) => <tr key={i}>{ACCOUNT_FIELDS.map((f) => <td key={f.key} className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{row[f.key] || <span className="text-slate-300 dark:text-slate-600 italic">empty</span>}</td>)}</tr>)}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div><h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Review & Validate</h3><p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">Review your data before importing.</p></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-slate-700 p-3 text-center"><p className="text-xl font-bold text-slate-900 dark:text-white">{csvRows.length.toLocaleString()}</p><p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Total</p></div>
                    <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800/40 p-3 text-center"><p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{validCount.toLocaleString()}</p><p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Valid</p></div>
                    <div className={cn('rounded-lg border p-3 text-center', errorCount > 0 ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-800/40' : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-slate-700')}><p className={cn('text-xl font-bold', errorCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white')}>{errorCount.toLocaleString()}</p><p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Errors</p></div>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 w-12">Row</th>{ACCOUNT_FIELDS.map((f) => <th key={f.key} className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">{f.label}</th>)}<th className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 w-16">Status</th><th className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 min-w-[160px]">Remarks</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {validatedRows.slice(0, 50).map((row) => (
                          <tr key={row.rowNumber} className={cn(!row.isValid && 'bg-red-50/30 dark:bg-red-500/[0.02]')}>
                            <td className="px-2.5 py-1.5 text-slate-400 font-mono text-[10px]">{row.rowNumber}</td>
                            <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{row.name || '—'}</td>
                            <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{row.industry || '—'}</td>
                            <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{row.website || '—'}</td>
                            <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{row.address || '—'}</td>
                            <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{row.city || '—'}</td>
                            <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{row.province || '—'}</td>
                            <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[80px]">{row.country || '—'}</td>
                            <td className="px-2.5 py-1.5">{row.isValid ? <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"><CircleCheck size={11} />Valid</span> : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400"><CircleX size={11} />Error</span>}</td>
                            <td className="px-2.5 py-1.5 text-[10px] text-slate-500 dark:text-slate-400">{row.isValid ? 'Ready to import' : row.errors.join(' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>{step === 1 ? <button onClick={handleClose} className="h-9 px-4 text-[13px] font-medium text-slate-600 dark:text-slate-300">Cancel</button> : <button onClick={() => setStep((s) => Math.max(1, s - 1) as WizardStep)} className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"><ArrowLeft size={14} />Back</button>}</div>
                <div>
                  {step < 3 && <button onClick={() => setStep((s) => Math.min(3, s + 1) as WizardStep)} disabled={(step === 1 && (!file || csvRows.length === 0)) || (step === 2 && !requiredMapped)} className={cn('inline-flex items-center gap-1.5 h-9 px-5 text-[13px] font-semibold rounded-lg transition-colors', ((step === 1 && file && csvRows.length > 0) || (step === 2 && requiredMapped)) ? 'text-white bg-blue-600 hover:bg-blue-700' : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed')}>Continue<ArrowRight size={14} /></button>}
                  {step === 3 && <button onClick={handleImport} disabled={isImporting} className={cn('inline-flex items-center gap-2 h-9 px-5 text-[13px] font-semibold rounded-lg transition-colors', !isImporting ? 'text-white bg-blue-600 hover:bg-blue-700' : 'text-white bg-blue-400 cursor-not-allowed')}>{isImporting ? <><Loader2 size={14} className="animate-spin" />Importing...</> : 'Import Now'}</button>}
                </div>
              </div>
            </div>
          </>
        )}
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" aria-hidden="true" />
      </div>
    </SlidingDrawer>
  );
}
