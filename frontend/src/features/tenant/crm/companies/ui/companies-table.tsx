'use client';

import React from 'react';
import { Building2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import type { Company } from '../types/company.types';

interface CompaniesTableProps {
  companies: Company[];
  onEdit: (company: Company) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export default function CompaniesTable({
  companies, onEdit, onDelete, canEdit, canDelete,
}: CompaniesTableProps) {
  if (companies.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 dark:text-slate-500">
        <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No companies found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/[0.06] text-left">
            <th className="pb-3 pr-4 font-medium text-slate-500 dark:text-slate-400">Company</th>
            <th className="pb-3 pr-4 font-medium text-slate-500 dark:text-slate-400">Industry</th>
            <th className="pb-3 pr-4 font-medium text-slate-500 dark:text-slate-400">Size</th>
            <th className="pb-3 pr-4 font-medium text-slate-500 dark:text-slate-400">City</th>
            <th className="pb-3 font-medium text-slate-500 dark:text-slate-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          {companies.map(company => (
            <tr key={company.id}
              className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{company.name}</p>
                    {company.email && (
                      <p className="text-xs text-slate-400">{company.email}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                {company.industry ? (
                  <Badge variant="outline" className="text-xs">{company.industry}</Badge>
                ) : '—'}
              </td>
              <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                {company.size ?? '—'}
              </td>
              <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                {company.city ?? '—'}
              </td>
              <td className="py-3">
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <Button size="icon" variant="ghost" onClick={() => onEdit(company)}
                      className="h-7 w-7">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="icon" variant="ghost" onClick={() => onDelete(company.id)}
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
