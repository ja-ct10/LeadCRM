'use client';

import { FormRecord, CreateFormInput, DEFAULT_DESIGN, DEFAULT_SETTINGS, DEFAULT_FIELDS } from '../types/form.types';

const STORAGE_KEY = 'leadcrm_forms';

function loadForms(): FormRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FormRecord[]) : [];
  } catch {
    return [];
  }
}

function saveForms(forms: FormRecord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(forms));
}

export function getFormsByTenant(tenantId: string): FormRecord[] {
  return loadForms().filter((f) => f.tenantId === tenantId);
}

export function getFormById(id: string): FormRecord | undefined {
  return loadForms().find((f) => f.id === id);
}

export function createForm(input: CreateFormInput): FormRecord {
  const now = new Date().toISOString();
  const form: FormRecord = {
    id: `form_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    tenantId: input.tenantId,
    name: input.name,
    status: 'draft',
    fields: DEFAULT_FIELDS.map((f) => ({ ...f, id: `${f.id}_${Date.now()}` })),
    design: { ...DEFAULT_DESIGN },
    settings: {
      ...DEFAULT_SETTINGS,
      utmParams: DEFAULT_SETTINGS.utmParams.map((p) => ({ ...p })),
    },
    createdAt: now,
    updatedAt: now,
  };
  const forms = loadForms();
  forms.push(form);
  saveForms(forms);
  return form;
}

export function updateForm(id: string, updates: Partial<Omit<FormRecord, 'id' | 'tenantId' | 'createdAt'>>): FormRecord {
  const forms = loadForms();
  const idx = forms.findIndex((f) => f.id === id);
  if (idx === -1) throw new Error(`Form ${id} not found`);
  forms[idx] = { ...forms[idx], ...updates, updatedAt: new Date().toISOString() };
  saveForms(forms);
  return forms[idx];
}

export function publishForm(id: string): FormRecord {
  return updateForm(id, { status: 'published', publishedAt: new Date().toISOString() });
}

export function deleteForm(id: string): void {
  const forms = loadForms().filter((f) => f.id !== id);
  saveForms(forms);
}

export function getShareLink(formId: string): string {
  return `https://forms.leadcrm.app/${formId}`;
}

export function getEmbedCode(formId: string): string {
  return `<script src="https://forms.leadcrm.app/embed.js" type="module" crossorigin="anonymous" defer></script><leadcrm-form id="${formId}"></leadcrm-form>`;
}
