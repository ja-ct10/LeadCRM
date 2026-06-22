import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Tenant } from './types';
import { MOCK_USERS, MOCK_TENANTS } from './mockData';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  login: (email: string, password?: string) => boolean;
  logout: () => void;
  registerTenant: (tenantData: any, adminData: any) => void;
  switchRole: (role: string) => void;
  updateProfile: (profileData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('leadcrm_user');
    const storedTenant = localStorage.getItem('leadcrm_tenant');
    if (storedUser) setUser(JSON.parse(storedUser));
    if (storedTenant) setTenant(JSON.parse(storedTenant));
  }, []);

  const login = (email: string, password?: string) => {
    // For demo, just find by email
    let allUsers = JSON.parse(localStorage.getItem('leadcrm_users') || JSON.stringify(MOCK_USERS));
    let allTenants = JSON.parse(localStorage.getItem('leadcrm_tenants') || JSON.stringify(MOCK_TENANTS));
    
    let foundUser = allUsers.find((u: User) => u.email === email);
    
    // Fallback for demo accounts if localStorage has stale data
    if (!foundUser && (email === 'admin@democorp.com' || email === 'bob@democorp.com' || email === 'super@leadcrm.com' || email === 'guest@democorp.com')) {
      allUsers = MOCK_USERS;
      allTenants = MOCK_TENANTS;
      localStorage.setItem('leadcrm_users', JSON.stringify(MOCK_USERS));
      localStorage.setItem('leadcrm_tenants', JSON.stringify(MOCK_TENANTS));
      foundUser = allUsers.find((u: User) => u.email === email);
    }

    if (foundUser) {
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
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setTenant(null);
    localStorage.removeItem('leadcrm_user');
    localStorage.removeItem('leadcrm_tenant');
  };

  const registerTenant = (tenantData: any, adminData: any) => {
    const allTenants = JSON.parse(localStorage.getItem('leadcrm_tenants') || JSON.stringify(MOCK_TENANTS));
    const allUsers = JSON.parse(localStorage.getItem('leadcrm_users') || JSON.stringify(MOCK_USERS));
    
    const newTenantId = 'tenant_' + Date.now();
    const newTenant: Tenant = {
      id: newTenantId,
      name: tenantData.companyName,
      industry: tenantData.industry,
      size: tenantData.size,
      email: tenantData.businessEmail,
      phone: tenantData.phone,
      address: tenantData.address,
      status: 'pending',
      approvalStep: 'basic',
      environment: 'none',
      createdAt: new Date().toISOString(),
      businessReqs: tenantData.businessReqs,
      verificationDocs: tenantData.verificationDocs,
    };
    
    const newUser: User = {
      id: 'user_' + Date.now(),
      tenantId: newTenantId,
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      email: adminData.email,
      role: 'Client Admin',
      status: 'active',
    };
    
    localStorage.setItem('leadcrm_tenants', JSON.stringify([...allTenants, newTenant]));
    localStorage.setItem('leadcrm_users', JSON.stringify([...allUsers, newUser]));
  };

  const switchRole = (role: string) => {
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      localStorage.setItem('leadcrm_user', JSON.stringify(updatedUser));
    }
  };

  const updateProfile = (profileData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...profileData };
      setUser(updatedUser);
      localStorage.setItem('leadcrm_user', JSON.stringify(updatedUser));
      
      const allUsers = JSON.parse(localStorage.getItem('leadcrm_users') || JSON.stringify(MOCK_USERS));
      const idx = allUsers.findIndex((u: any) => u.id === user.id);
      if (idx !== -1) {
        allUsers[idx] = { ...allUsers[idx], ...profileData };
        localStorage.setItem('leadcrm_users', JSON.stringify(allUsers));
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, tenant, login, logout, registerTenant, switchRole, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
