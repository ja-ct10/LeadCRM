import type { Company } from '../types/company.types';

const STORAGE_KEY = 'leadcrm_companies';

export const companiesService = {
  getAll(): Company[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  },

  getById(id: string): Company | undefined {
    return this.getAll().find(c => c.id === id);
  },

  save(companies: Company[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
  },
};
