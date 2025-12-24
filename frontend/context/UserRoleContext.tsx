"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';

type UserRole = 'admin' | 'editor' | 'viewer' | null;

interface UserRoleContextType {
  role: UserRole;
  loading: boolean;
  refreshRole: () => Promise<void>;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async () => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`);
      setRole(response.data.role);
    } catch (error) {
      console.error("Failed to fetch user role:", error);
      setRole('viewer'); // Default fallback
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
    <UserRoleContext.Provider value={{ role, loading, refreshRole: fetchRole }}>
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
