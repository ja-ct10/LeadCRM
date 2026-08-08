'use client';

import React, { useState, useCallback, useRef } from 'react';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { FormRecord, FormField, FormFieldType } from '../types/form.types';
import { updateForm, publishForm, getShareLink, getEmbedCode } from '../services/forms.service';
import { FormCanvas } from './form-canvas';
import { FieldPalette } from './field-palette';
import { FormSettingsPanel } from './form-settings-panel';
import { FormSharePanel } from './form-share-panel';
import { FormPublishedModal } from './form-published-modal';

type BuilderTab = 'Builder' | 'Settings' | 'Share';

interface FormBuilderPageProps {
  form: FormRecord;
  onBack: () => void;
  onFormUpdate: (updated: FormRecord) => void;
}

export function FormBuilderPage({ form, onBack, onFormUpdate }: FormBuilderPageProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<BuilderTab>('Builder');
  const [localForm, setLocalForm] = useState<FormRecord>(form);
  const [isDirty, setIsDirty] = useState(false);
  const [isPublishedModalOpen, setIsPublishedModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'Fields' | 'Design'>('Fields');

  // Stable ref so callbacks don't stale-close over localForm
  const localFormRef = useRef(localForm);
  localFormRef.current = localForm;

  const handleFieldsChange = useCallback((fields: FormField[]) => {
    const updated = { ...localFormRef.current, fields };
    setLocalForm(updated);
    setIsDirty(true);
    try { updateForm(localFormRef.current.id, { fields }); } catch { /* noop */ }
  }, []);

  const handleDesignChange = useCallback((design: FormRecord['design']) => {
    const updated = { ...localFormRef.current, design };
    setLocalForm(updated);
    setIsDirty(true);
    try { updateForm(localFormRef.current.id, { design }); } catch { /* noop */ }
  }, []);

  const handleSettingsChange = useCallback((settings: FormRecord['settings']) => {
    const updated = { ...localFormRef.current, settings };
    setLocalForm(updated);
    setIsDirty(true);
    try { updateForm(localFormRef.current.id, { settings }); } catch { /* noop */ }
  }, []);

  const handlePublish = () => {
    try {
      const published = publishForm(localForm.id);
      setLocalForm(published);
      setIsDirty(false);
      onFormUpdate(published);
      setIsPublishedModalOpen(true);
    } catch {
      toast.error('Failed to publish form');
    }
  };

  const handleCancel = () => {
    setLocalForm(form);
    setIsDirty(false);
  };

  const shareLink = getShareLink(localForm.id);
  const embedCode = getEmbedCode(localForm.id);

  return (
    <div className="flex flex-col h-full -m-4 lg:-m-8 min-h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-white/[0.07] bg-white dark:bg-slate-950 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shrink-0">
            <ArrowLeft size={14} /> <span>Forms</span>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">{localForm.name}</h1>
            {isDirty ? (
              <span className="shrink-0 px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded border border-amber-500/20 uppercase">Unpublished Edits</span>
            ) : localForm.status === 'draft' ? (
              <span className="shrink-0 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded uppercase">Draft</span>
            ) : (
              <span className="shrink-0 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/20 uppercase">Published</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <button onClick={handleCancel} className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Cancel
            </button>
          )}
          <button onClick={handlePublish} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-md shadow-blue-500/20 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            Publish
          </button>
          <div className="relative">
            <button onClick={() => setIsMoreMenuOpen((v) => !v)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer">
              <MoreHorizontal size={16} />
            </button>
            <AnimatePresence>
              {isMoreMenuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-lg z-50 py-1 overflow-hidden"
                  onMouseLeave={() => setIsMoreMenuOpen(false)}>
                  <button onClick={() => { toast.info('Restored to published version'); setIsMoreMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.61"/></svg>
                    Restore published version
                  </button>
                  <button onClick={() => { toast.info('Switched to published version'); setIsMoreMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 8 12 12 16"/><line x1="16" y1="12" x2="8" y2="12"/></svg>
                    Switch to published version
                  </button>
                  <div className="h-px bg-gray-100 dark:bg-white/[0.06] my-1" />
                  <button onClick={() => setIsMoreMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex gap-0 px-5 border-b border-gray-200 dark:border-white/[0.07] bg-white dark:bg-slate-950 shrink-0">
        {(['Builder', 'Settings', 'Share'] as BuilderTab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === tab
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="form-builder-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {activeTab === 'Builder' && (
          <>
            {/* Canvas */}
            <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-900/60 p-6">
              <FormCanvas fields={localForm.fields} design={localForm.design} onChange={handleFieldsChange} />
            </div>
            {/* Right panel */}
            <div className="w-64 shrink-0 border-l border-gray-200 dark:border-white/[0.07] bg-white dark:bg-slate-950 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="flex gap-0 border-b border-gray-200 dark:border-white/[0.07] shrink-0">
                {(['Fields', 'Design'] as const).map((t) => (
                  <button key={t} onClick={() => setRightPanelTab(t)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${rightPanelTab === t ? 'text-slate-900 dark:text-white border-b-2 border-blue-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
              {rightPanelTab === 'Fields' ? (
                <FieldPalette onAddField={(type: FormFieldType) => {
                  const newField: FormField = {
                    id: `field_${Date.now()}`,
                    type,
                    label: type === 'heading' ? 'Heading' : type === 'paragraph' ? 'Paragraph' : type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                    placeholder: ['heading', 'paragraph', 'checkbox'].includes(type) ? undefined : `e.g. ${type === 'email' || type === 'contact-email' ? 'john@example.com' : 'Enter value'}`,
                    required: false,
                  };
                  handleFieldsChange([...localForm.fields, newField]);
                }} />
              ) : (
                <FieldPalette onAddField={() => { /* no-op in design mode */ }} design={localForm.design} onDesignChange={handleDesignChange} mode="design" />
              )}
            </div>
          </>
        )}
        {activeTab === 'Settings' && (
          <div className="flex-1 overflow-y-auto p-6">
            <FormSettingsPanel settings={localForm.settings} onChange={handleSettingsChange} />
          </div>
        )}
        {activeTab === 'Share' && (
          <div className="flex-1 overflow-y-auto p-6">
            <FormSharePanel form={localForm} shareLink={shareLink} embedCode={embedCode} />
          </div>
        )}
      </div>

      {/* Publish success modal */}
      <FormPublishedModal
        isOpen={isPublishedModalOpen}
        onClose={() => setIsPublishedModalOpen(false)}
        shareLink={shareLink}
        embedCode={embedCode}
      />
    </div>
  );
}
