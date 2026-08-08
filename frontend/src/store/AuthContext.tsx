'use client';

import { uuid } from '@/lib/utils';
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
  verifyOtp: (email: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  registerTenant: (tenantData: any, adminData: any) => Promise<boolean>;
  registerGuestAccount: (guestData: any) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  confirmPasswordReset: (token: string, password: string) => Promise<boolean>;
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
        setIsLoading(false);
      } else {
        // Real API — verify the HttpOnly cookie by calling /auth/me
        try {
          const res = await authApi.me();
          if (res?.data?.user) {
            const apiUser = res.data.user as unknown as User;
            setUser(apiUser);
            if (apiUser.tenantId && apiUser.tenantId !== 'system') {
              setTenant({ id: apiUser.tenantId, name: '', status: 'active', environment: 'production' } as any);
            }
          } else {
            setUser(null);
            setTenant(null);
          }
        } catch {
          // No valid session cookie — user needs to log in
          setUser(null);
          setTenant(null);
        }
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []); // Run once on mount only — session restore is not NextAuth-dependent

  // ── Login ─────────────────────────────────────────────────────────
  const login = async (email: string, password?: string): Promise<boolean> => {
    if (USE_MOCK_AUTH) {
      return mockLogin(email);
    }

    try {
      // Step 1: verify credentials + send OTP
      await authApi.sendOtp(email, password ?? '');
      return true; // signals OTP was sent — UI should show OTP step
    } catch (err: unknown) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[AuthContext] login failed:', err instanceof Error ? err.message : err);
      }
      return false;
    }
  };

  // ── Verify OTP + complete login ────────────────────────────────────
  const verifyOtp = async (email: string, code: string): Promise<boolean> => {
    if (USE_MOCK_AUTH) {
      return mockLogin(email);
    }
    try {
      const res = await authApi.verifyOtp(email, code);
      if (res?.data?.user) {
        const apiUser = res.data.user as unknown as User;
        setUser(apiUser);
        if (apiUser.tenantId && apiUser.tenantId !== 'system') {
          setTenant({ id: apiUser.tenantId, name: '', status: 'active', environment: 'production' } as any);
        }
        return true;
      }
      return false;
    } catch (err: unknown) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[AuthContext] verifyOtp failed:', err instanceof Error ? err.message : err);
      }
      throw err; // re-throw so UI can show the specific error message
    }
  };

  // ── Mock login (localStorage, demo phase) ─────────────────────────
  const mockLogin = (email: string): boolean => {
    let allUsers   = JSON.parse(localStorage.getItem('leadcrm_users')   || JSON.stringify(MOCK_USERS));
    let allTenants = JSON.parse(localStorage.getItem('leadcrm_tenants') || JSON.stringify(MOCK_TENANTS));

    let foundUser = allUsers.find((u: User) => u.email === email);

    // Fallback: reset to mock data if demo account not found
    const DEMO_EMAILS = ['admin@gmail.com', 'admin@democorp.com', 'bob@democorp.com', 'super@leadcrm.com', 'guest@democorp.com'];
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
      try { await authApi.logout(); } catch { /* ignore — clear local state regardless */ }
    }
    setUser(null);
    setTenant(null);
    localStorage.removeItem('leadcrm_user');
    localStorage.removeItem('leadcrm_tenant');
  };

  // ── Register tenant ────────────────────────────────────────────────
  const registerTenant = async (tenantData: any, adminData: any): Promise<boolean> => {
    if (USE_MOCK_AUTH) {
      const allTenants = JSON.parse(localStorage.getItem('leadcrm_tenants') || JSON.stringify(MOCK_TENANTS));
      const allUsers   = JSON.parse(localStorage.getItem('leadcrm_users')   || JSON.stringify(MOCK_USERS));

      const newTenantId = uuid();
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
        id:        uuid(),
        tenantId:  newTenantId,
        firstName: adminData.firstName,
        lastName:  adminData.lastName,
        email:     adminData.email,
        role:      'Client Admin',
        status:    'active',
      };

      localStorage.setItem('leadcrm_tenants', JSON.stringify([...allTenants, newTenant]));
      localStorage.setItem('leadcrm_users',   JSON.stringify([...allUsers, newUser]));
      return true;
    } else {
      try {
        await authApi.registerClientAdmin({
          companyName: tenantData.companyName,
          industry: tenantData.industry,
          companySize: tenantData.size,
          country: 'US', // default or from form
          firstName: adminData.firstName,
          lastName: adminData.lastName,
          email: adminData.email,
          password: adminData.password,
          acceptTerms: true,
        });
        return true;
      } catch (err: unknown) {
        // Log safely — never expose stack traces or secrets
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('[AuthContext] registerTenant failed:', err instanceof Error ? err.message : err);
        }
        return false;
      }
    }
  };

  const registerGuestAccount = async (guestData: any): Promise<boolean> => {
    if (USE_MOCK_AUTH) {
      return true; // Simplified mock
    } else {
      try {
        await authApi.registerGuest({
          firstName: guestData.firstName,
          lastName: guestData.lastName,
          email: guestData.email,
          password: guestData.password,
        });
        return true;
      } catch (err: unknown) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('[AuthContext] registerGuestAccount failed:', err instanceof Error ? err.message : err);
        }
        return false;
      }
    }
  };

  // ── Password reset ─────────────────────────────────────────────────
  const requestPasswordReset = async (email: string): Promise<boolean> => {
    if (USE_MOCK_AUTH) {
      // Mock: always succeed silently
      return true;
    }
    try {
      await authApi.forgotPassword(email);
      return true;
    } catch (err: unknown) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[AuthContext] requestPasswordReset failed:', err instanceof Error ? err.message : err);
      }
      return false;
    }
  };

  const confirmPasswordReset = async (token: string, password: string): Promise<boolean> => {
    if (USE_MOCK_AUTH) {
      return true;
    }
    try {
      await authApi.resetPassword(token, password);
      return true;
    } catch (err: unknown) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[AuthContext] confirmPasswordReset failed:', err instanceof Error ? err.message : err);
      }
      return false;
    }
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
    <AuthContext.Provider value={{ user, tenant, isLoading, login, verifyOtp, logout, registerTenant, registerGuestAccount, requestPasswordReset, confirmPasswordReset, switchRole, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
