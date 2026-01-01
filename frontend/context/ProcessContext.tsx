import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Node } from 'reactflow';

interface ProcessContextType {
  openNodeDialog: (nodeData: any) => void;
  setNodes?: React.Dispatch<React.SetStateAction<Node[]>>;
}

const ProcessContext = createContext<ProcessContextType | undefined>(undefined);

export const ProcessProvider = ({ children, openNodeDialog, setNodes }: { children: ReactNode, openNodeDialog: (data: any) => void, setNodes?: React.Dispatch<React.SetStateAction<Node[]>> }) => {
  return (
    <ProcessContext.Provider value={{ openNodeDialog, setNodes }}>
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
