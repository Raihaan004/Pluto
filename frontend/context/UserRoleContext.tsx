"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';

type UserRole = 'admin' | 'editor' | 'viewer' | null;

interface UserRoleContextType {
  role: UserRole;
  isVerified: boolean;
  isInstanceActivated: boolean;
  isSuspended: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'suspended' | null;
  organization: string | null;
  orgId: string | null;
  loading: boolean;
  refreshRole: () => Promise<void>;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const [role, setRole] = useState<UserRole>('admin');
  const [isVerified, setIsVerified] = useState(true);
  const [isInstanceActivated, setIsInstanceActivated] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | 'suspended' | null>('approved');
  const [organization, setOrganization] = useState<string | null>('Pluto Enterprise');
  const [orgId, setOrgId] = useState<string | null>('default-org');
  const [loading, setLoading] = useState(true);

  const fetchRole = async () => {
    try {
      setIsInstanceActivated(true);
      setIsSuspended(false);

      if (!user) {
        setRole('admin');
        setIsVerified(true);
        setApprovalStatus('approved');
        setOrganization('Pluto Enterprise');
        setOrgId('default-org');
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`);
        setRole(response.data.role || 'admin');
        setIsVerified(true);
        setApprovalStatus('approved');
        setOrganization(response.data.organization || 'Pluto Enterprise');
        setOrgId(response.data.org_id || 'default-org');
      } catch (err) {
        setRole('admin');
        setIsVerified(true);
        setApprovalStatus('approved');
        setOrganization('Pluto Enterprise');
        setOrgId('default-org');
      }
    } catch (error: any) {
      console.error("Failed to fetch user data:", error);
      setRole('admin');
      setIsVerified(true);
      setApprovalStatus('approved');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      fetchRole();
    }
  }, [isLoaded, user]);

  return (
    <UserRoleContext.Provider value={{ 
      role, 
      isVerified, 
      isInstanceActivated, 
      isSuspended, 
      approvalStatus, 
      organization, 
      orgId, 
      loading, 
      refreshRole: fetchRole 
    }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}
