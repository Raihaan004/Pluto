import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ProcessContextType {
  openNodeDialog: (nodeData: any) => void;
}

const ProcessContext = createContext<ProcessContextType | undefined>(undefined);

export const ProcessProvider = ({ children, openNodeDialog }: { children: ReactNode, openNodeDialog: (data: any) => void }) => {
  return (
    <ProcessContext.Provider value={{ openNodeDialog }}>
      {children}
    </ProcessContext.Provider>
  );
};

export const useProcessContext = () => {
  const context = useContext(ProcessContext);
  if (!context) {
    throw new Error('useProcessContext must be used within a ProcessProvider');
  }
  return context;
};
