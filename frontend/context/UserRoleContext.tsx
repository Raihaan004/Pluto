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
  approvalStatus: 'pending' | 'approved' | 'rejected' | null;
  organization: string | null;
  orgId: string | null;
  loading: boolean;
  refreshRole: () => Promise<void>;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const [role, setRole] = useState<UserRole>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isInstanceActivated, setIsInstanceActivated] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [organization, setOrganization] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async () => {
    try {
      // 1. Check instance status first (checks connectivity to Pluto Admin)
      const instanceRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/instance-status`);
      setIsInstanceActivated(instanceRes.data.is_activated);
      const suspended = !!instanceRes.data.is_suspended;
      setIsSuspended(suspended);
      
      console.log(`[AUTH] Instance Activated: ${instanceRes.data.is_activated}, Suspended: ${suspended}`);

      if (!user) {
        setRole(null);
        setIsVerified(false);
        setApprovalStatus(null);
        setOrganization(null);
        setOrgId(null);
        setLoading(false);
        return;
      }

      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`);
      setRole(response.data.role);
      setIsVerified(response.data.is_verified || false);
      setApprovalStatus(response.data.approval_status || 'pending');
      setOrganization(response.data.organization || null);
      setOrgId(response.data.org_id || null);
    } catch (error: any) {
      console.error("Failed to fetch user data:", error);
      if (error.response?.status === 403) {
        setIsSuspended(true);
      }
      setRole('viewer'); 
      setIsVerified(false);
      setApprovalStatus('pending');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      fetchRole();
      
      // Add a heartbeat check every 3 seconds to ensure the instance status is synced immediately
      const heartbeat = setInterval(() => {
        if (user) {
          axios.get(`${process.env.NEXT_PUBLIC_API_URL}/instance-status`)
            .then(res => {
              if (res.data.is_suspended !== isSuspended) {
                console.log(`[SECURITY] Instance status changed: ${res.data.is_suspended ? 'SUSPENDED' : 'ACTIVE'}`);
                setIsSuspended(!!res.data.is_suspended);
              }
              setIsInstanceActivated(res.data.is_activated);
            })
            .catch(err => {
               if (err.response?.status === 403) {
                 console.log("[SECURITY] Backend returned 403 - Forcing suspension UI");
                 setIsSuspended(true);
               }
               console.error("Heartbeat failed:", err);
            });
        }
      }, 3000); // 3 seconds for better responsiveness during demo

      return () => clearInterval(heartbeat);
    }
  }, [isLoaded, user, isSuspended]);

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
