import { useCallback, useState } from 'react';
import { Node, Edge } from 'reactflow';

type HistoryEntry = {
  nodes: Node[];
  edges: Edge[];
};

export function useUndoRedo() {
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);

  const takeSnapshot = useCallback((nodes: Node[], edges: Edge[]) => {
    setPast((prevPast) => {
      // Create a deep copy to avoid reference issues
      const entry = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      };
      
      const last = prevPast[prevPast.length - 1];
      // Only add to history if it's different from the last state
      if (last && JSON.stringify(last) === JSON.stringify(entry)) {
        return prevPast;
      }
      
      // Limit history size to 50 for performance
      const newPast = [...prevPast, entry];
      if (newPast.length > 50) {
        return newPast.slice(1);
      }
      return newPast;
    });
    setFuture([]);
  }, []);

  const undo = useCallback((currentNodes: Node[], currentEdges: Edge[], setNodes: any, setEdges: any) => {
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    
    setFuture((prev) => [
      ...prev,
      { 
        nodes: JSON.parse(JSON.stringify(currentNodes)), 
        edges: JSON.parse(JSON.stringify(currentEdges)) 
      }
    ]);

    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [past]);

  const redo = useCallback((currentNodes: Node[], currentEdges: Edge[], setNodes: any, setEdges: any) => {
    if (future.length === 0) return;

    const next = future[future.length - 1];
    setFuture((prev) => prev.slice(0, -1));

    setPast((prev) => [
      ...prev,
      { 
        nodes: JSON.parse(JSON.stringify(currentNodes)), 
        edges: JSON.parse(JSON.stringify(currentEdges)) 
      }
    ]);

    setNodes(next.nodes);
    setEdges(next.edges);
  }, [future]);

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
