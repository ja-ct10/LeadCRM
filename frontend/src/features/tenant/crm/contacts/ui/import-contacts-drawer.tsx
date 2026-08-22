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
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CircleCheck,
  CircleX,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createContactImport } from '@/shared/services/contact-imports.api';
import type { ContactImportRow } from '@/shared/services/contact-imports.api';

// ── Types ────────────────────────────────────────────────────────────────────

interface ImportContactsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type WizardStep = 1 | 2 | 3;

interface CsvColumn {
  index: number;
  name: string;
}

interface ColumnMapping {
  csvColumnIndex: number | null;
  csvColumnName: string | null;
}

type LeadField = 'firstName' | 'lastName' | 'email' | 'phone' | 'companyName' | 'address';

const LEAD_FIELDS: { key: LeadField; label: string }[] = [
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

function autoMapColumns(csvColumns: CsvColumn[]): Record<LeadField, ColumnMapping> {
  const mappings: Record<LeadField, ColumnMapping> = {
    firstName: { csvColumnIndex: null, csvColumnName: null },
    lastName: { csvColumnIndex: null, csvColumnName: null },
    email: { csvColumnIndex: null, csvColumnName: null },
    phone: { csvColumnIndex: null, csvColumnName: null },
    companyName: { csvColumnIndex: null, csvColumnName: null },
    address: { csvColumnIndex: null, csvColumnName: null },
  };

  const rules: Record<LeadField, string[]> = {
    firstName: ['first name', 'firstname', 'first_name', 'given name'],
    lastName: ['last name', 'lastname', 'last_name', 'surname', 'family name'],
    email: ['email', 'email address', 'email_address', 'e-mail'],
    phone: ['phone number', 'phone', 'mobile', 'mobile number', 'phone_number', 'telephone', 'tel', 'mobile_number'],
    companyName: ['company name', 'company', 'company_name', 'organization', 'org'],
    address: ['full address', 'address', 'full_address', 'street address', 'location'],
  };

  const used = new Set<number>();

  for (const field of LEAD_FIELDS) {
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

function validateRow(row: Record<LeadField, string>, rowNumber: number): ValidatedRow {
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

// ── Component ────────────────────────────────────────────────────────────────

export function ImportContactsDrawer({ isOpen, onClose, onImportComplete }: ImportContactsDrawerProps): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<LeadField, ColumnMapping>>({
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
    () => LEAD_FIELDS.every((f) => mappings[f.key].csvColumnIndex !== null),
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

  // Map a row using current mappings
  const mapRow = useCallback((row: string[]): Record<LeadField, string> => {
    const result: Record<LeadField, string> = {
      firstName: '', lastName: '', email: '', phone: '', companyName: '', address: '',
    };
    for (const field of LEAD_FIELDS) {
      const idx = mappings[field.key].csvColumnIndex;
      result[field.key] = idx !== null ? (row[idx] || '') : '';
    }
    return result;
  }, [mappings]);

  // Live preview (first 10 rows, updates when mappings change)
  const previewRows = useMemo(() => {
    return csvRows.slice(0, 10).map((row) => mapRow(row));
  }, [csvRows, mapRow]);

  // Validated rows for Review step
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

  const handleClose = useCallback(() => {
    if (!isImporting) resetState();
    onClose();
  }, [isImporting, onClose, resetState]);

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

      // Auto-map columns
      const columns: CsvColumn[] = headers.map((name, index) => ({ index, name }));
      setMappings(autoMapColumns(columns));

      // Move to step 2
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
      // Reset file input so same file can be re-selected
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

  // ── Mapping Change (dropdown) ──────────────────────────────────────────
  const handleMappingChange = useCallback(
    (field: LeadField, value: string) => {
      setMappings((prev) => {
        const updated = { ...prev };
        if (value === '') {
          // Unmapped
          updated[field] = { csvColumnIndex: null, csvColumnName: null };
        } else {
          const colIndex = Number(value);
          // Remove this column from any other field
          for (const key of Object.keys(updated) as LeadField[]) {
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

  // ── Download Template ──────────────────────────────────────────────────
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

  // ── Import Now ─────────────────────────────────────────────────────────
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
      onImportComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      toast.error(message);
      setIsImporting(false);
    }
  }, [file, allMapped, isImporting, csvRows, mapRow, onImportComplete]);

  // ── Format Helpers ─────────────────────────────────────────────────────
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── First unmapped field (for validation message) ──────────────────────
  const firstUnmappedField = useMemo(
    () => LEAD_FIELDS.find((f) => mappings[f.key].csvColumnIndex === null),
    [mappings],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SlidingDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Contacts"
      subtitle="Upload your CSV, map your columns, and review your data before importing."
      width="w-full max-w-lg md:max-w-2xl lg:max-w-3xl"
    >
      <div className="flex flex-col h-full">
        {/* Import Result View */}
        {importResult ? (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <ImportResultView
              result={importResult}
              onViewDetails={() => {
                handleClose();
                router.push(`/crm/contacts/imports/${importResult.id}`);
              }}
              onClose={handleClose}
            />
          </div>
        ) : (
          <>
            {/* Step Indicator */}
            <div className="px-6 pt-4 pb-2">
              <StepIndicator currentStep={step} hasErrors={step === 3 && errorCount > 0} />
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
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
            </div>

            {/* Fixed Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
              <StepFooter
                step={step}
                canContinueStep1={!!file && csvRows.length > 0}
                canContinueStep2={allMapped}
                isImporting={isImporting}
                onBack={() => setStep((s) => Math.max(1, s - 1) as WizardStep)}
                onContinue={() => setStep((s) => Math.min(3, s + 1) as WizardStep)}
                onImport={handleImport}
                onCancel={handleClose}
              />
            </div>
          </>
        )}

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
    </SlidingDrawer>
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
      {/* Section Header */}
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Upload Your CSV</h3>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
          Upload your existing CSV file containing the contacts you want to import.
        </p>
      </div>

      {/* Upload Area or File Info */}
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

      {/* Download Template — Optional */}
      <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-slate-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
              Don&apos;t have a CSV template?
            </p>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
              Use our template to see the required Lead fields. Already have your own CSV? Upload it directly above.
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
  mappings: Record<LeadField, ColumnMapping>;
  unmappedColumns: { name: string; index: number }[];
  allMapped: boolean;
  previewRows: Record<LeadField, string>[];
  firstUnmappedField: { key: LeadField; label: string } | undefined;
  onMappingChange: (field: LeadField, value: string) => void;
}): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Map Your Columns</h3>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
          Match each LeadCRM Field to the corresponding column in your CSV file.
        </p>
      </div>

      {/* Column Mapping Dropdowns */}
      <div className="space-y-3">
        {LEAD_FIELDS.map((field) => {
          const mapping = mappings[field.key];
          const isMapped = mapping.csvColumnIndex !== null;

          return (
            <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label className="text-[13px] font-medium text-slate-700 dark:text-slate-300 sm:w-36 shrink-0">
                {field.label} <span className="text-red-500">*</span>
              </label>
              <div className="flex-1 relative">
                <select
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

      {/* Validation Message */}
      {!allMapped && firstUnmappedField && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-700/40">
          <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[12px] text-amber-700 dark:text-amber-400">
            <span className="font-medium">{firstUnmappedField.label}</span> is required. Map a CSV column to continue.
          </p>
        </div>
      )}

      {/* Unmapped Columns Notice */}
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

      {/* Live Data Preview */}
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
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  {LEAD_FIELDS.map((f) => (
                    <th key={f.key} className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {previewRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                    {LEAD_FIELDS.map((f) => (
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
    return filtered.slice(0, 50); // Limit render for performance
  }, [validatedRows, filter]);

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">Review & Validate</h3>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
          Review your data before importing. Records with errors will not be imported.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total Records" value={totalCount} variant="neutral" />
        <SummaryCard label="Valid Records" value={validCount} variant="success" />
        <SummaryCard label="Records with Errors" value={errorCount} variant={errorCount > 0 ? 'danger' : 'neutral'} />
      </div>

      {/* Filter Tabs */}
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

      {/* Review Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 w-12">Row</th>
              {LEAD_FIELDS.map((f) => (
                <th key={f.key} className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {f.label}
                </th>
              ))}
              <th className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 w-16">Status</th>
              <th className="px-2.5 py-2 text-left font-semibold text-slate-600 dark:text-slate-400 min-w-[180px]">Remarks</th>
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
                      <CircleCheck size={11} /> Valid
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
                      <CircleX size={11} /> Error
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
  onClose,
}: {
  result: { id: string; fileName: string; totalRecords: number; successfulRecords: number; failedRecords: number; status: string };
  onViewDetails: () => void;
  onClose: () => void;
}): React.ReactElement {
  const statusLabel = result.status === 'completed' ? 'Completed' : result.status === 'completed_with_errors' ? 'Completed with Errors' : result.status === 'failed' ? 'Failed' : 'Importing';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Import Started</h3>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">Your lead import has started processing.</p>
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
        <button onClick={onClose} className="h-9 px-4 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}
