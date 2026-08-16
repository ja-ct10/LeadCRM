'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { COMPANY_INDUSTRIES, COMPANY_SIZES } from '../constants/account.constants';
import { validateAccountForm, type AccountFormValues, type AccountFormErrors } from '../schemas/account.schema';
import type { Account } from '../types/account.types';

interface AccountFormProps {
  initial?: Account | null;
  onSubmit: (data: AccountFormValues) => void;
  onCancel: () => void;
}

const EMPTY: AccountFormValues = {
  name: '', industry: '', size: '', website: '', email: '',
  phone: '', address: '', city: '', country: '', taxId: '', notes: '',
};

export default function AccountForm({ initial, onSubmit, onCancel }: AccountFormProps) {
  const [values, setValues] = useState<AccountFormValues>(
    initial ? {
      name: initial.name, industry: initial.industry ?? '',
      size: initial.size ?? '', website: initial.website ?? '',
      email: initial.email ?? '', phone: initial.phone ?? '',
      address: initial.address ?? '', city: initial.city ?? '',
      country: initial.country ?? '', taxId: initial.taxId ?? '',
      notes: initial.notes ?? '',
    } : EMPTY,
  );
  const [errors, setErrors] = useState<AccountFormErrors>({});

  const set = (field: keyof AccountFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateAccountForm(values);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="co-name">Account Name *</Label>
          <Input id="co-name" value={values.name} onChange={set('name')} placeholder="Acme Corp" />
          {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="co-industry">Industry</Label>
          <select id="co-industry" value={values.industry} onChange={set('industry')}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm dark:text-white">
            <option value="">Select industry</option>
            {COMPANY_INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="co-size">Account Size</Label>
          <select id="co-size" value={values.size} onChange={set('size')}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm dark:text-white">
            <option value="">Select size</option>
            {COMPANY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="co-email">Email</Label>
          <Input id="co-email" type="email" value={values.email} onChange={set('email')} placeholder="info@account.com" />
          {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="co-phone">Phone</Label>
          <Input id="co-phone" value={values.phone} onChange={set('phone')} placeholder="+63 2 1234 5678" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="co-website">Website</Label>
          <Input id="co-website" value={values.website} onChange={set('website')} placeholder="https://account.com" />
          {errors.website && <p className="text-xs text-red-500">{errors.website}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="co-city">City</Label>
          <Input id="co-city" value={values.city} onChange={set('city')} placeholder="Makati City" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="co-country">Country</Label>
          <Input id="co-country" value={values.country} onChange={set('country')} placeholder="Philippines" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="co-notes">Notes</Label>
        <Input id="co-notes" value={values.notes} onChange={set('notes')} placeholder="Additional notes..." />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initial ? 'Save Changes' : 'Create Account'}</Button>
      </div>
    </form>
  );
}
