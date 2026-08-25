'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
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
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createContactImport } from '@/shared/services/contact-imports.api';
import type { ContactImportRow } from '@/shared/services/contact-imports.api';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { ImportHistoryList } from './import-history-list';

// ── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3;
type PageView = 'wizard' | 'history';

interface CsvColumn {
  index: number;
  name: string;
}

interface ColumnMapping {
  csvColumnIndex: number | null;
  csvColumnName: string | null;
}

type ContactField = 'firstName' | 'lastName' | 'email' | 'phone' | 'companyName' | 'address';

const CONTACT_FIELDS: { key: ContactField; label: string }[] = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'companyName', label: 'Company Name' },
  { key: 'address', label: 'Full Address' },
];

const TEMPLATE_HEADERS = ['First Name', 'Last Name', 'Email', 'Phone Number', 'Company Name', 'Full Address'];

// ── Email validation ─────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Auto-mapping rules ───────────────────────────────────────────────────────

function autoMapColumns(csvColumns: CsvColumn[]): Record<ContactField, ColumnMapping> {
  const mappings: Record<ContactField, ColumnMapping> = {
    firstName: { csvColumnIndex: null, csvColumnName: null },
    lastName: { csvColumnIndex: null, csvColumnName: null },
    email: { csvColumnIndex: null, csvColumnName: null },
    phone: { csvColumnIndex: null, csvColumnName: null },
    companyName: { csvColumnIndex: null, csvColumnName: null },
    address: { csvColumnIndex: null, csvColumnName: null },
  };

  const rules: Record<ContactField, string[]> = {
    firstName: ['first name', 'firstname', 'first_name', 'given name'],
    lastName: ['last name', 'lastname', 'last_name', 'surname', 'family name'],
    email: ['email', 'email address', 'email_address', 'e-mail'],
    phone: ['phone number', 'phone', 'mobile', 'mobile number', 'phone_number', 'telephone', 'tel', 'mobile_number'],
    companyName: ['company name', 'company', 'company_name', 'organization', 'org'],
    address: ['full address', 'address', 'full_address', 'street address', 'location'],
  };

  const used = new Set<number>();

  for (const field of CONTACT_FIELDS) {
    const patterns = rules[field.key];
    for (const col of csvColumns) {
      if (used.has(col.index)) continue;
      const normalized = col.name.toLowerCase().trim();
      if (patterns.includes(normalized)) {
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
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      if (current.length > 0 || lines.length > 0) {
        lines.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current.length > 0) lines.push(current);

  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (ch === ',' && !quoted) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow).filter((r) => r.some((cell) => cell.length > 0));

  return { headers, rows };
}

// ── Row Validation ───────────────────────────────────────────────────────────

interface ValidatedRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  address: string;
  isValid: boolean;
  errors: string[];
}

function validateRow(row: Record<ContactField, string>, rowNumber: number): ValidatedRow {
  const errors: string[] = [];

  if (!row.firstName.trim()) errors.push('First Name is required.');
  if (!row.lastName.trim()) errors.push('Last Name is required.');
  if (!row.email.trim()) {
    errors.push('Email is required.');
  } else if (!isValidEmail(row.email.trim())) {
    errors.push('Invalid email address.');
  }
  if (!row.phone.trim()) errors.push('Phone Number is required.');
  if (!row.companyName.trim()) errors.push('Company Name is required.');
  if (!row.address.trim()) errors.push('Full Address is required.');

  return {
    rowNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    companyName: row.companyName,
    address: row.address,
    isValid: errors.length === 0,
    errors,
  };
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function ImportContactsPage(): React.ReactElement {
  const router = useRouter();
  const canCreate = useHasPermission('contacts.create');
  const [activeView, setActiveView] = useState<PageView>('wizard');

  const [step, setStep] = useState<WizardStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<ContactField, ColumnMapping>>({
    firstName: { csvColumnIndex: null, csvColumnName: null },
    lastName: { csvColumnIndex: null, csvColumnName: null },
    email: { csvColumnIndex: null, csvColumnName: null },
    phone: { csvColumnIndex: null, csvColumnName: null },
    companyName: { csvColumnIndex: null, csvColumnName: null },
    address: { csvColumnIndex: null, csvColumnName: null },
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    id: string;
    fileName: string;
    totalRecords: number;
    successfulRecords: number;
    failedRecords: number;
    status: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Derived State ──────────────────────────────────────────────────────
  const allMapped = useMemo(
    () => CONTACT_FIELDS.every((f) => mappings[f.key].csvColumnIndex !== null),
    [mappings],
  );

  const unmappedColumns = useMemo(() => {
    const mappedIndices = new Set(
      Object.values(mappings)
        .map((m) => m.csvColumnIndex)
        .filter((i): i is number => i !== null),
    );
    return csvHeaders
      .map((name, index) => ({ name, index }))
      .filter((col) => !mappedIndices.has(col.index));
  }, [mappings, csvHeaders]);

  const mapRow = useCallback((row: string[]): Record<ContactField, string> => {
    const result: Record<ContactField, string> = {
      firstName: '', lastName: '', email: '', phone: '', companyName: '', address: '',
    };
    for (const field of CONTACT_FIELDS) {
      const idx = mappings[field.key].csvColumnIndex;
      result[field.key] = idx !== null ? (row[idx] || '') : '';
    }
    return result;
  }, [mappings]);

  const previewRows = useMemo(() => {
    return csvRows.slice(0, 10).map((row) => mapRow(row));
  }, [csvRows, mapRow]);

  const validatedRows = useMemo(() => {
    if (!allMapped) return [];
    return csvRows.map((row, index) => validateRow(mapRow(row), index + 2));
  }, [csvRows, mapRow, allMapped]);

  const validCount = useMemo(() => validatedRows.filter((r) => r.isValid).length, [validatedRows]);
  const errorCount = useMemo(() => validatedRows.filter((r) => !r.isValid).length, [validatedRows]);

  // ── Reset ──────────────────────────────────────────────────────────────
  const resetState = useCallback(() => {
    setStep(1);
    setFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setMappings({
      firstName: { csvColumnIndex: null, csvColumnName: null },
      lastName: { csvColumnIndex: null, csvColumnName: null },
      email: { csvColumnIndex: null, csvColumnName: null },
      phone: { csvColumnIndex: null, csvColumnName: null },
      companyName: { csvColumnIndex: null, csvColumnName: null },
      address: { csvColumnIndex: null, csvColumnName: null },
    });
    setIsImporting(false);
    setImportResult(null);
    setIsDragging(false);
  }, []);

  // ── File Processing ────────────────────────────────────────────────────
  const processFile = useCallback((selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text || text.trim().length === 0) {
        toast.error('The uploaded CSV file does not contain any data.');
        return;
      }
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0) {
        toast.error("We couldn't read this CSV file. Please check its formatting and try again.");
        return;
      }
      if (rows.length === 0) {
        toast.error('The uploaded CSV file does not contain any data rows.');
        return;
      }

      setFile(selectedFile);
      setCsvHeaders(headers);
      setCsvRows(rows);

      const columns: CsvColumn[] = headers.map((name, index) => ({ index, name }));
      setMappings(autoMapColumns(columns));
      setStep(2);
    };
    reader.onerror = () => {
      toast.error("We couldn't read this CSV file. Please check its formatting and try again.");
    };
    reader.readAsText(selectedFile);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) processFile(selectedFile);
      if (e.target) e.target.value = '';
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) processFile(droppedFile);
    },
    [processFile],
  );

  const handleReplaceFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleMappingChange = useCallback(
    (field: ContactField, value: string) => {
      setMappings((prev) => {
        const updated = { ...prev };
        if (value === '') {
          updated[field] = { csvColumnIndex: null, csvColumnName: null };
        } else {
          const colIndex = Number(value);
          for (const key of Object.keys(updated) as ContactField[]) {
            if (updated[key].csvColumnIndex === colIndex) {
              updated[key] = { csvColumnIndex: null, csvColumnName: null };
            }
          }
          updated[field] = { csvColumnIndex: colIndex, csvColumnName: csvHeaders[colIndex] };
        }
        return updated;
      });
    },
    [csvHeaders],
  );

  const handleDownloadTemplate = useCallback(() => {
    const csvContent = TEMPLATE_HEADERS.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contact-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(async () => {
    if (!file || !allMapped || isImporting) return;
    setIsImporting(true);

    try {
      const rows: ContactImportRow[] = csvRows.map((row, index) => ({
        rowNumber: index + 2,
        ...mapRow(row),
      }));

      const response = await createContactImport({ fileName: file.name, rows });
      setImportResult(response.data);
      toast.success('Import completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      toast.error(message);
      setIsImporting(false);
    }
  }, [file, allMapped, isImporting, csvRows, mapRow]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const firstUnmappedField = useMemo(
    () => CONTACT_FIELDS.find((f) => mappings[f.key].csvColumnIndex === null),
    [mappings],
  );

  // ── RBAC Guard ─────────────────────────────────────────────────────────
  if (!canCreate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle size={24} className="text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Access Denied</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          You don&apos;t have permission to import contacts. Contact your administrator for access.
        </p>
        <button
          onClick={() => router.push('/crm/contacts')}
          className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Contacts
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-700/60 bg-white dark:bg-[var(--surface)] px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/crm/contacts')}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Back to contacts"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Import Contacts</h1>
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                {activeView === 'wizard'
                  ? 'Upload your CSV, map your columns, and review your data before importing.'
                  : 'View your past contact imports and their results.'}
              </p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => { setActiveView('wizard'); }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                activeView === 'wizard'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
              )}
              aria-label="New import wizard"
              aria-pressed={activeView === 'wizard'}
            >
              <Upload size={13} />
              New Import
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                activeView === 'history'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
              )}
              aria-label="View import history"
              aria-pressed={activeView === 'history'}
            >
              <Clock size={13} />
              History
            </button>
          </div>
        </div>
      </div>

      {/* ── Page Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          {activeView === 'history' ? (
            <ImportHistoryList />
          ) : importResult ? (
            <ImportResultView
              result={importResult}
              onViewDetails={() => router.push(`/crm/contacts/imports/${importResult.id}`)}
              onStartNew={resetState}
            />
          ) : (
            <div className="space-y-6">
              {/* Step Indicator */}
              <StepIndicator currentStep={step} hasErrors={step === 3 && errorCount > 0} />

              {/* Step Content */}
              {step === 1 && (
                <Step1Upload
                  file={file}
                  recordCount={csvRows.length}
                  isDragging={isDragging}
                  fileInputRef={fileInputRef}
                  onFileChange={handleFileChange}
                  onDrop={handleDrop}
                  onDragEnter={() => setIsDragging(true)}
                  onDragLeave={() => setIsDragging(false)}
                  onReplaceFile={handleReplaceFile}
                  onDownloadTemplate={handleDownloadTemplate}
                  formatFileSize={formatFileSize}
                />
              )}
              {step === 2 && (
                <Step2MapColumns
                  csvHeaders={csvHeaders}
                  mappings={mappings}
                  unmappedColumns={unmappedColumns}
                  allMapped={allMapped}
                  previewRows={previewRows}
                  firstUnmappedField={firstUnmappedField}
                  onMappingChange={handleMappingChange}
                />
              )}
              {step === 3 && (
                <Step3Review
                  validatedRows={validatedRows}
                  validCount={validCount}
                  errorCount={errorCount}
                  totalCount={csvRows.length}
                />
              )}

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700/60">
                <StepFooter
                  step={step}
                  canContinueStep1={!!file && csvRows.length > 0}
                  canContinueStep2={allMapped}
                  isImporting={isImporting}
                  onBack={() => setStep((s) => Math.max(1, s - 1) as WizardStep)}
                  onContinue={() => setStep((s) => Math.min(3, s + 1) as WizardStep)}
                  onImport={handleImport}
                  onCancel={() => router.push('/crm/contacts')}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep, hasErrors }: { currentStep: WizardStep; hasErrors?: boolean }): React.ReactElement {
  const steps = [
    { num: 1, label: 'Upload CSV' },
    { num: 2, label: 'Map Columns' },
    { num: 3, label: 'Review & Validate' },
  ];

  return (
    <div className="flex items-center gap-1" role="navigation" aria-label="Import steps">
      {steps.map((s, i) => {
        const isCompleted = currentStep > s.num;
        const isActive = currentStep === s.num;
        const showError = isActive && s.num === 3 && hasErrors;

        return (
          <React.Fragment key={s.num}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all',
                  isCompleted && 'bg-emerald-500 text-white',
                  isActive && !showError && 'bg-blue-600 text-white ring-2 ring-blue-600/20',
                  isActive && showError && 'bg-amber-500 text-white ring-2 ring-amber-500/20',
                  !isCompleted && !isActive && 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? <CheckCircle2 size={14} /> : s.num}
              </div>
              <span
                className={cn(
                  'text-[12px] font-medium hidden sm:inline',
                  isActive ? 'text-slate-900 dark:text-white' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('flex-1 h-px mx-2', isCompleted ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step Footer ──────────────────────────────────────────────────────────────

function StepFooter({
  step,
  canContinueStep1,
  canContinueStep2,
  isImporting,
  onBack,
  onContinue,
  onImport,
  onCancel,
}: {
  step: WizardStep;
  canContinueStep1: boolean;
  canContinueStep2: boolean;
  isImporting: boolean;
  onBack: () => void;
  onContinue: () => void;
  onImport: () => void;
  onCancel: () => void;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <div>
        {step === 1 && (
          <button onClick={onCancel} className="h-9 px-4 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
            Cancel
          </button>
        )}
        {step > 1 && (
          <button onClick={onBack} className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft size={14} />
            Back
          </button>
        )}
      </div>
      <div>
        {step < 3 && (
          <button
            onClick={onContinue}
            disabled={(step === 1 && !canContinueStep1) || (step === 2 && !canContinueStep2)}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-5 text-[13px] font-semibold rounded-lg transition-colors',
              ((step === 1 && canContinueStep1) || (step === 2 && canContinueStep2))
                ? 'text-white bg-blue-600 hover:bg-blue-700'
                : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed',
            )}
          >
            Continue
            <ArrowRight size={14} />
          </button>
        )}
        {step === 3 && (
          <button
            onClick={onImport}
            disabled={isImporting}
            className={cn(
              'inline-flex items-center gap-2 h-9 px-5 text-[13px] font-semibold rounded-lg transition-colors',
              !isImporting
                ? 'text-white bg-blue-600 hover:bg-blue-700'
                : 'text-white bg-blue-400 cursor-not-allowed',
            )}
          >
            {isImporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Importing...
              </>
            ) : (
              'Import Now'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Step 1: Upload CSV ───────────────────────────────────────────────────────

function Step1Upload({
  file,
  recordCount,
  isDragging,
  fileInputRef,
  onFileChange,
  onDrop,
  onDragEnter,
  onDragLeave,
  onReplaceFile,
  onDownloadTemplate,
  formatFileSize,
}: {
  file: File | null;
  recordCount: number;
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onReplaceFile: () => void;
  onDownloadTemplate: () => void;
  formatFileSize: (bytes: number) => string;
}): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Upload Your CSV</h3>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
          Upload your existing CSV file containing the contacts you want to import.
        </p>
      </div>

      {file ? (
        <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
              <FileText size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{file.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {formatFileSize(file.size)} &middot; {recordCount.toLocaleString()} records detected
              </p>
            </div>
            <button
              onClick={onReplaceFile}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap"
            >
              Replace File
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
            isDragging
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/5 dark:border-blue-500'
              : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-white/[0.02]',
          )}
          role="button"
          tabIndex={0}
          aria-label="Upload CSV file"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
            <Upload size={22} className="text-blue-500" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {isDragging ? 'Drop your CSV here' : 'Drag and drop your CSV here'}
          </p>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1.5">or</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="mt-2 inline-flex items-center h-8 px-4 text-[12px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800/50 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
          >
            Browse Files
          </button>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">CSV files only &middot; Max 10MB</p>
        </div>
      )}

      <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-slate-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
              Don&apos;t have a CSV template?
            </p>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
              Use our template to see the required Contact fields. Already have your own CSV? Upload it directly above.
            </p>
            <button
              onClick={onDownloadTemplate}
              className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <Download size={13} />
              Download CSV Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Map Columns ──────────────────────────────────────────────────────

function Step2MapColumns({
  csvHeaders,
  mappings,
  unmappedColumns,
  allMapped,
  previewRows,
  firstUnmappedField,
  onMappingChange,
}: {
  csvHeaders: string[];
  mappings: Record<ContactField, ColumnMapping>;
  unmappedColumns: { name: string; index: number }[];
  allMapped: boolean;
  previewRows: Record<ContactField, string>[];
  firstUnmappedField: { key: ContactField; label: string } | undefined;
  onMappingChange: (field: ContactField, value: string) => void;
}): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Map Your Columns</h3>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
          Match each LeadCRM Field to the corresponding column in your CSV file.
        </p>
      </div>

      <div className="space-y-3">
        {CONTACT_FIELDS.map((field) => {
          const mapping = mappings[field.key];
          const isMapped = mapping.csvColumnIndex !== null;

          return (
            <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label htmlFor={`map-${field.key}`} className="text-[13px] font-medium text-slate-700 dark:text-slate-300 sm:w-36 shrink-0">
                {field.label} <span className="text-red-500">*</span>
              </label>
              <div className="flex-1 relative">
                <select
                  id={`map-${field.key}`}
                  value={mapping.csvColumnIndex !== null ? String(mapping.csvColumnIndex) : ''}
                  onChange={(e) => onMappingChange(field.key, e.target.value)}
                  className={cn(
                    'w-full h-9 px-3 pr-8 text-[13px] rounded-lg border appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                    isMapped
                      ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-700/50 text-emerald-800 dark:text-emerald-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
                  )}
                  aria-label={`Map CSV column for ${field.label}`}
                >
                  <option value="">— Select CSV Column —</option>
                  {csvHeaders.map((h, i) => (
                    <option key={i} value={i}>{h}</option>
                  ))}
                </select>
                {isMapped && (
                  <CheckCircle2 size={14} className="absolute right-8 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!allMapped && firstUnmappedField && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-700/40">
          <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[12px] text-amber-700 dark:text-amber-400">
            <span className="font-medium">{firstUnmappedField.label}</span> is required. Map a CSV column to continue.
          </p>
        </div>
      )}

      {unmappedColumns.length > 0 && allMapped && (
        <div className="px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-700/50">
          <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400 mb-1.5">Unmapped Columns</p>
          <div className="flex flex-wrap gap-1.5">
            {unmappedColumns.map((col) => (
              <span key={col.index} className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {col.name}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">These columns will not be imported.</p>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Uploaded Data Preview
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Showing first {previewRows.length} records
            </p>
          </div>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="w-full text-[11px]" aria-label="Data preview">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  {CONTACT_FIELDS.map((f) => (
                    <th key={f.key} scope="col" className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {previewRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                    {CONTACT_FIELDS.map((f) => (
                      <td key={f.key} className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                        {row[f.key] || <span className="text-slate-300 dark:text-slate-600 italic">empty</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Review & Validate ────────────────────────────────────────────────

function Step3Review({
  validatedRows,
  validCount,
  errorCount,
  totalCount,
}: {
  validatedRows: ValidatedRow[];
  validCount: number;
  errorCount: number;
  totalCount: number;
}): React.ReactElement {
  const [filter, setFilter] = useState<'all' | 'valid' | 'errors'>('all');

  const displayedRows = useMemo(() => {
    const filtered = filter === 'all' ? validatedRows : filter === 'valid' ? validatedRows.filter((r) => r.isValid) : validatedRows.filter((r) => !r.isValid);
    return filtered.slice(0, 50);
  }, [validatedRows, filter]);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Review & Validate</h3>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
          Review your data before importing. Records with errors will not be imported.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total Records" value={totalCount} variant="neutral" />
        <SummaryCard label="Valid Records" value={validCount} variant="success" />
        <SummaryCard label="Records with Errors" value={errorCount} variant={errorCount > 0 ? 'danger' : 'neutral'} />
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
        {(['all', 'valid', 'errors'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              'px-3 py-2 text-[12px] font-medium transition-colors relative',
              filter === tab
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {tab === 'all' ? `All (${totalCount})` : tab === 'valid' ? `Valid (${validCount})` : `Errors (${errorCount})`}
            {filter === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
        <table className="w-full text-[11px]" aria-label="Validation results">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th scope="col" className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 w-12">Row</th>
              {CONTACT_FIELDS.map((f) => (
                <th key={f.key} scope="col" className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {f.label}
                </th>
              ))}
              <th scope="col" className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 w-16">Status</th>
              <th scope="col" className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 min-w-[180px]">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {displayedRows.map((row) => (
              <tr key={row.rowNumber} className={cn('transition-colors', !row.isValid && 'bg-red-50/30 dark:bg-red-500/[0.02]')}>
                <td className="px-2.5 py-1.5 text-slate-400 dark:text-slate-500 font-mono text-[10px]">{row.rowNumber}</td>
                <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{row.firstName || '—'}</td>
                <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{row.lastName || '—'}</td>
                <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{row.email || '—'}</td>
                <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[110px]">{row.phone || '—'}</td>
                <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{row.companyName || '—'}</td>
                <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{row.address || '—'}</td>
                <td className="px-2.5 py-1.5">
                  {row.isValid ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CircleCheck size={11} aria-hidden="true" /> Valid
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
                      <CircleX size={11} aria-hidden="true" /> Error
                    </span>
                  )}
                </td>
                <td className="px-2.5 py-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                  {row.isValid ? 'Ready to import' : row.errors.join(' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validatedRows.length > 50 && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
          Showing first 50 rows. Full results will be available after import.
        </p>
      )}
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, variant }: { label: string; value: number; variant: 'neutral' | 'success' | 'danger' }): React.ReactElement {
  return (
    <div className={cn(
      'rounded-lg border p-3 text-center',
      variant === 'success' && 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800/40',
      variant === 'danger' && 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-800/40',
      variant === 'neutral' && 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-slate-700',
    )}>
      <p className={cn(
        'text-xl font-bold',
        variant === 'success' && 'text-emerald-600 dark:text-emerald-400',
        variant === 'danger' && 'text-red-600 dark:text-red-400',
        variant === 'neutral' && 'text-slate-900 dark:text-white',
      )}>
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

// ── Import Result View ───────────────────────────────────────────────────────

function ImportResultView({
  result,
  onViewDetails,
  onStartNew,
}: {
  result: { id: string; fileName: string; totalRecords: number; successfulRecords: number; failedRecords: number; status: string };
  onViewDetails: () => void;
  onStartNew: () => void;
}): React.ReactElement {
  const statusLabel = result.status === 'completed' ? 'Completed' : result.status === 'completed_with_errors' ? 'Completed with Errors' : result.status === 'failed' ? 'Failed' : 'Importing';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Import Complete</h3>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">Your contact import has finished processing.</p>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-slate-500 dark:text-slate-400">File</span>
          <span className="font-medium text-slate-900 dark:text-white">{result.fileName}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-slate-500 dark:text-slate-400">Total Records</span>
          <span className="font-medium text-slate-900 dark:text-white">{result.totalRecords.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-slate-500 dark:text-slate-400">Imported</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{result.successfulRecords.toLocaleString()}</span>
        </div>
        {result.failedRecords > 0 && (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-slate-500 dark:text-slate-400">Failed</span>
            <span className="font-medium text-red-600 dark:text-red-400">{result.failedRecords.toLocaleString()}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-slate-500 dark:text-slate-400">Status</span>
          <span className={cn(
            'px-2 py-0.5 rounded text-[11px] font-semibold',
            result.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
            result.status === 'completed_with_errors' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' :
            'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
          )}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onViewDetails} className="inline-flex items-center gap-2 h-9 px-5 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          View Details
          <ArrowRight size={14} />
        </button>
        <button onClick={onStartNew} className="h-9 px-4 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
          Start New Import
        </button>
      </div>
    </div>
  );
}
