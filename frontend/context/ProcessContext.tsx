import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { Node } from 'reactflow';

interface ProcessContextType {
  openNodeDialog: (nodeData: any) => void;
  setNodes?: React.Dispatch<React.SetStateAction<Node[]>>;
  edgeStyle: 'blue-solid' | 'red-dashed';
  setEdgeStyle: (style: 'blue-solid' | 'red-dashed') => void;
  isPublished?: boolean;
}

const ProcessContext = createContext<ProcessContextType | undefined>(undefined);

export const ProcessProvider = ({ 
  children, 
  openNodeDialog, 
  setNodes,
  edgeStyle,
  setEdgeStyle,
  isPublished
}: { 
  children: ReactNode, 
  openNodeDialog: (data: any) => void, 
  setNodes?: React.Dispatch<React.SetStateAction<Node[]>>,
  edgeStyle: 'blue-solid' | 'red-dashed',
  setEdgeStyle: (style: 'blue-solid' | 'red-dashed') => void,
  isPublished?: boolean
}) => {
  const value = useMemo(() => ({
    openNodeDialog,
    setNodes,
    edgeStyle,
    setEdgeStyle,
    isPublished
  }), [openNodeDialog, setNodes, edgeStyle, setEdgeStyle, isPublished]);

  return (
    <ProcessContext.Provider value={value}>
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
