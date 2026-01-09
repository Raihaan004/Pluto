"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

interface NavigationState {
  hasUnsavedChanges: boolean;
  saveAction: (() => Promise<boolean>) | null;
}

interface NavigationDispatch {
  setHasUnsavedChanges: (val: boolean) => void;
  setSaveAction: (fn: (() => Promise<boolean>) | null) => void;
}

const NavigationStateContext = createContext<NavigationState | undefined>(undefined);
const NavigationDispatchContext = createContext<NavigationDispatch | undefined>(undefined);

export const NavigationProvider = ({ children }: { children: React.ReactNode }) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveAction, setSaveAction] = useState<(() => Promise<boolean>) | null>(null);

  const updateSaveAction = useCallback((fn: (() => Promise<boolean>) | null) => {
    setSaveAction(() => fn);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const stateValue = useMemo(() => ({
    hasUnsavedChanges,
    saveAction
  }), [hasUnsavedChanges, saveAction]);

  const dispatchValue = useMemo(() => ({
    setHasUnsavedChanges,
    setSaveAction: updateSaveAction
  }), [updateSaveAction]);

  return (
    <NavigationStateContext.Provider value={stateValue}>
      <NavigationDispatchContext.Provider value={dispatchValue}>
        {children}
      </NavigationDispatchContext.Provider>
    </NavigationStateContext.Provider>
  );
};

export const useNavigation = () => {
  const state = useContext(NavigationStateContext);
  const dispatch = useContext(NavigationDispatchContext);
  
  if (state === undefined || dispatch === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  
  return { ...state, ...dispatch };
};

// Add specific hooks to avoid re-renders when only one part is needed
export const useNavigationState = () => {
  const context = useContext(NavigationStateContext);
  if (context === undefined) {
    throw new Error('useNavigationState must be used within a NavigationProvider');
  }
  return context;
};

export const useNavigationDispatch = () => {
  const context = useContext(NavigationDispatchContext);
  if (context === undefined) {
    throw new Error('useNavigationDispatch must be used within a NavigationProvider');
  }
  return context;
};
