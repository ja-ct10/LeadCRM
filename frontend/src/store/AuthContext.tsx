'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Tenant } from './types';
import { MOCK_USERS, MOCK_TENANTS } from './mockData';
import { authApi } from '@/shared/services/auth.api';

// When true, auth calls hit the mock localStorage data instead of the backend.
// Set NEXT_PUBLIC_USE_MOCK_AUTH=false in .env.local to use the real API.
const USE_MOCK_AUTH = process.env.NEXT_PUBLIC_USE_MOCK_AUTH !== 'false';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  registerTenant: (tenantData: any, adminData: any) => void;
  switchRole: (role: string) => void;
  updateProfile: (profileData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [tenant, setTenant]   = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Restore session on mount ──────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      if (USE_MOCK_AUTH) {
        // Mock: restore from localStorage
        try {
          const storedUser   = localStorage.getItem('leadcrm_user');
          const storedTenant = localStorage.getItem('leadcrm_tenant');
          if (storedUser)   setUser(JSON.parse(storedUser));
          if (storedTenant) setTenant(JSON.parse(storedTenant));
        } catch {
          // Corrupted storage — clear it
          localStorage.removeItem('leadcrm_user');
          localStorage.removeItem('leadcrm_tenant');
        }
      } else {
        // Real API: verify session via HttpOnly cookie
        try {
          const { data } = await authApi.me();
          setUser(data.user as User);
        } catch {
          // Not authenticated — user stays null, auth guard redirects to /login
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  // ── Login ─────────────────────────────────────────────────────────
  const login = async (email: string, password?: string): Promise<boolean> => {
    if (USE_MOCK_AUTH) {
      return mockLogin(email);
    }

    try {
      const { data } = await authApi.login({ email, password: password ?? '' });
      setUser(data.user as User);
      // tenantId comes from JWT — no separate tenant fetch needed for now
      return true;
    } catch {
      return false;
    }
  };

  // ── Mock login (localStorage, demo phase) ─────────────────────────
  const mockLogin = (email: string): boolean => {
    let allUsers   = JSON.parse(localStorage.getItem('leadcrm_users')   || JSON.stringify(MOCK_USERS));
    let allTenants = JSON.parse(localStorage.getItem('leadcrm_tenants') || JSON.stringify(MOCK_TENANTS));

    let foundUser = allUsers.find((u: User) => u.email === email);

    // Fallback: reset to mock data if demo account not found
    const DEMO_EMAILS = ['admin@democorp.com', 'bob@democorp.com', 'super@leadcrm.com', 'guest@democorp.com'];
    if (!foundUser && DEMO_EMAILS.includes(email)) {
      allUsers   = MOCK_USERS;
      allTenants = MOCK_TENANTS;
      localStorage.setItem('leadcrm_users',   JSON.stringify(MOCK_USERS));
      localStorage.setItem('leadcrm_tenants', JSON.stringify(MOCK_TENANTS));
      foundUser = allUsers.find((u: User) => u.email === email);
    }

    if (!foundUser) return false;

    setUser(foundUser);
    localStorage.setItem('leadcrm_user', JSON.stringify(foundUser));

    if (foundUser.tenantId !== 'system') {
      const foundTenant = allTenants.find((t: Tenant) => t.id === foundUser.tenantId);
      if (foundTenant) {
        setTenant(foundTenant);
        localStorage.setItem('leadcrm_tenant', JSON.stringify(foundTenant));
      }
    } else {
      setTenant(null);
      localStorage.removeItem('leadcrm_tenant');
    }
    return true;
  };

  // ── Logout ────────────────────────────────────────────────────────
  const logout = async (): Promise<void> => {
    if (!USE_MOCK_AUTH) {
      await authApi.logout().catch(() => {/* ignore network errors on logout */});
    }
    setUser(null);
    setTenant(null);
    localStorage.removeItem('leadcrm_user');
    localStorage.removeItem('leadcrm_tenant');
  };

  // ── Register tenant (mock only — real flow goes through backend) ──
  const registerTenant = (tenantData: any, adminData: any): void => {
    const allTenants = JSON.parse(localStorage.getItem('leadcrm_tenants') || JSON.stringify(MOCK_TENANTS));
    const allUsers   = JSON.parse(localStorage.getItem('leadcrm_users')   || JSON.stringify(MOCK_USERS));

    const newTenantId = 'tenant_' + Date.now();
    const newTenant: Tenant = {
      id:               newTenantId,
      name:             tenantData.companyName,
      industry:         tenantData.industry,
      size:             tenantData.size,
      email:            tenantData.businessEmail,
      phone:            tenantData.phone,
      address:          tenantData.address,
      status:           'pending',
      approvalStep:     'basic',
      environment:      'none',
      createdAt:        new Date().toISOString(),
      businessReqs:     tenantData.businessReqs,
      verificationDocs: tenantData.verificationDocs,
    };

    const newUser: User = {
      id:        'user_' + Date.now(),
      tenantId:  newTenantId,
      firstName: adminData.firstName,
      lastName:  adminData.lastName,
      email:     adminData.email,
      role:      'Client Admin',
      status:    'active',
    };

    localStorage.setItem('leadcrm_tenants', JSON.stringify([...allTenants, newTenant]));
    localStorage.setItem('leadcrm_users',   JSON.stringify([...allUsers, newUser]));
  };

  // ── Switch role (demo / development helper) ───────────────────────
  const switchRole = (role: string): void => {
    if (!user) return;
    const updated = { ...user, role };
    setUser(updated);
    localStorage.setItem('leadcrm_user', JSON.stringify(updated));
  };

  // ── Update profile ────────────────────────────────────────────────
  const updateProfile = (profileData: Partial<User>): void => {
    if (!user) return;
    const updated = { ...user, ...profileData };
    setUser(updated);
    localStorage.setItem('leadcrm_user', JSON.stringify(updated));

    const allUsers = JSON.parse(localStorage.getItem('leadcrm_users') || JSON.stringify(MOCK_USERS));
    const idx = allUsers.findIndex((u: any) => u.id === user.id);
    if (idx !== -1) {
      allUsers[idx] = { ...allUsers[idx], ...profileData };
      localStorage.setItem('leadcrm_users', JSON.stringify(allUsers));
    }
  };

  return (
    <AuthContext.Provider value={{ user, tenant, isLoading, login, logout, registerTenant, switchRole, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
