import type { ElementType } from 'react';
import { Shield, Building2, Users, Layout, Palette, Archive, User, SlidersHorizontal, Package } from 'lucide-react';

export type SettingsTab = 'profile' | 'appearance' | 'org-general' | 'users' | 'roles' | 'products' | 'custom-fields' | 'archived' | 'forms';

interface NavGroup {
  label: string;
  icon?: ElementType;
  isTree?: boolean;
  items: { id: SettingsTab; label: string; icon?: ElementType }[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: 'GENERAL', items: [
    { id: 'profile', label: 'Profile Settings', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ] },
  { label: 'ORGANIZATION', items: [
    { id: 'org-general', label: 'General', icon: Building2 },
    { id: 'users', label: 'Team Management', icon: Users },
    { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  ] },
  { label: 'CUSTOMIZATION', items: [
    { id: 'custom-fields', label: 'Customize Fields', icon: SlidersHorizontal },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'archived', label: 'Archived Data', icon: Archive },
  ] },
  { label: 'CONNECT', items: [
    { id: 'forms', label: 'Forms', icon: Layout },
  ] },
];

export const SETTINGS_TAB_MODULES: Partial<Record<SettingsTab, string>> = {
  'org-general': 'settings', users: 'users', roles: 'roles', products: 'products',
  'custom-fields': 'custom_fields', archived: 'archived_data', forms: 'forms',
};
