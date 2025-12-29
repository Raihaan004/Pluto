'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, FileSpreadsheet, Layout, Undo, Redo, Trash2, Edit2, Check, X, Users, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import { useUserRole } from '@/context/UserRoleContext';
import { ProcessProvider } from '@/context/ProcessContext';
import { useCustomNodeStates } from '@/hooks/useCustomNodeStates';
import {
  addEdge,
  useEdgesState,
  Connection,
  Edge,
  Node,
  MarkerType,
  updateEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from 'reactflow';

// Import ReactFlow normally (needed immediately for canvas)
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';

const ProcessSidebar = dynamic(() => import('@/components/process/ProcessSidebar').then(mod => ({ default: mod.ProcessSidebar })), {
  ssr: false,
});

const PropertiesPanel = dynamic(() => import('@/components/process/PropertiesPanel').then(mod => ({ default: mod.PropertiesPanel })), {
  ssr: false,
});

const NodeInfoDialog = dynamic(() => import('@/components/process/NodeInfoDialog').then(mod => ({ default: mod.NodeInfoDialog })), {
  ssr: false,
});

const ShareProjectDialog = dynamic(() => import('@/components/process/ShareProjectDialog').then(mod => ({ default: mod.ShareProjectDialog })), {
  ssr: false,
});

// Import node types and edge types (these are lightweight)
import { nodeTypes } from '@/components/process/CustomNodes';
import EditableStepEdge from '@/components/process/EditableStepEdge';

const initialNodes = [
  {
    id: '1',
    type: 'process',
    data: { label: 'Start Process' },
    position: { x: 250, y: 5 },
  },
];

let id = 0;
const getId = () => `dndnode_${id++}`;

// EdgeTypes - constant object, no need to memoize (doesn't change)
const edgeTypes = {
  'editable-step': EditableStepEdge,
};

interface ProcessSheet {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  lanes?: { id: string; name: string }[];
}

interface ProcessCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  users: any[];
  isReadOnly?: boolean;
  projectId?: string | null;
  onInit?: (instance: any) => void;
  wrappedOnNodesChange?: OnNodesChange;
  wrappedOnEdgesChange?: OnEdgesChange;
}

const LANE_WIDTH = 300;

const ProcessCanvas = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  setNodes,
  setEdges,
  users,
  isReadOnly = false,
  projectId,
  onInit,
  wrappedOnNodesChange,
  wrappedOnEdgesChange
}: ProcessCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    if (reactFlowInstance && onInit) {
      onInit(reactFlowInstance);
    }
  }, [reactFlowInstance, onInit]);
  
  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<any>(null);

  const openNodeDialog = (data: any) => {
    if (isReadOnly) return;
    setDialogData(data);
    setDialogOpen(true);
  };

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
        if (isReadOnly) return;
        setEdges((els) => updateEdge(oldEdge, newConnection, els))
    },
    [setEdges, isReadOnly]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = isReadOnly ? 'none' : 'move';
  }, [isReadOnly]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (isReadOnly) return;

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow/label');

      // check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      // project was renamed to screenToFlowPosition in v11.3
      // fallback for older versions or if instance not ready
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: label || `${type} node` },
      };

      setNodes((nds) => {
        const updated = nds.concat(newNode);
        setTimeout(() => {
          if (!isReadOnly) {
            saveHistory();
            checkForChanges();
          }
        }, 100);
        return updated;
      });
    },
    [reactFlowInstance, setNodes, isReadOnly]
  );

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (isReadOnly) return;
    setSelectedNode(node);
  }, [isReadOnly]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // No-op handlers for read-only mode to prevent infinite loops
  const noOpNodesChange = useCallback(() => {}, []);
  const noOpEdgesChange = useCallback(() => {}, []);
  const noOpConnect = useCallback(() => {}, []);

  const handleSaveProperties = (nodeId: string, newData: any) => {
    if (isReadOnly) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
    setSelectedNode(null);
  };

  return (
    <div className="flex-grow h-full bg-gray-50 relative flex flex-col" ref={reactFlowWrapper}>
      <div className="flex-grow relative">
        <ProcessProvider openNodeDialog={openNodeDialog}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={isReadOnly ? noOpNodesChange : (wrappedOnNodesChange || onNodesChange)}
                onEdgesChange={isReadOnly ? noOpEdgesChange : (wrappedOnEdgesChange || onEdgesChange)}
                onConnect={isReadOnly ? noOpConnect : onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeDoubleClick={onNodeDoubleClick}
                onPaneClick={onPaneClick}
                onEdgeUpdate={onEdgeUpdate}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                nodesDraggable={!isReadOnly}
                nodesConnectable={!isReadOnly}
                elementsSelectable={!isReadOnly}
                nodeExtent={undefined}
                defaultEdgeOptions={{ 
                type: 'editable-step',
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                },
                }}
                deleteKeyCode={isReadOnly ? null : ['Backspace', 'Delete']}
                // fitView // Disable fitView to respect lane coordinates
            >

                <Controls />
                <Background color="#aaa" gap={16} />
                <MiniMap />
            </ReactFlow>
        </ProcessProvider>
      </div>

      {selectedNode && !isReadOnly && (
        <PropertiesPanel 
            selectedNode={selectedNode} 
            onSave={handleSaveProperties} 
            onClose={() => setSelectedNode(null)}
            projectId={projectId}
        />
      )}
      
      <NodeInfoDialog 
        isOpen={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        data={dialogData} 
        users={users}
      />
    </div>
  );
};

export default function CreateProcessPage() {
  const { role, loading } = useUserRole();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const processId = searchParams.get('id');
  const projectId = searchParams.get('projectId');

  // State for multiple sheets
  const [sheets, setSheets] = useState<ProcessSheet[]>([
    { id: 'parent', name: 'Parent Process', nodes: initialNodes, edges: [] }
  ]);
  const sheetsRef = useRef(sheets);
  useEffect(() => {
    sheetsRef.current = sheets;
  }, [sheets]);

  const [activeSheetId, setActiveSheetId] = useState('parent');
  const [isSaving, setIsSaving] = useState(false);
  const [versions, setVersions] = useState<{ name: string; created_at: string; sheets: ProcessSheet[] }[]>([]);

  // ReactFlow state for the ACTIVE sheet
  const [nodes, setNodes, onNodesChange] = useCustomNodeStates(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projectPermission, setProjectPermission] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [currentCollaborators, setCurrentCollaborators] = useState<{ user_id: string; role: string }[]>([]);
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null);
  const [projectProcessId, setProjectProcessId] = useState<number | null>(null);
  const [rfInstance, setRfInstance] = useState<any>(null);
  const [projectName, setProjectName] = useState('Create New Process');
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editingProjectNameValue, setEditingProjectNameValue] = useState('');
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingSheetName, setEditingSheetName] = useState('');

  const handleAddSheet = () => {
    const newSheetId = `sheet_${Date.now()}`;
    const newSheet: ProcessSheet = {
      id: newSheetId,
      name: 'New Sheet',
      nodes: [],
      edges: [],
    };
    setSheets(prev => [...prev, newSheet]);
    handleSwitchSheet(newSheetId);
  };

  const handleDeleteSheet = (sheetId: string) => {
    if (sheetId === 'parent') return;
    setSheets(prev => prev.filter(s => s.id !== sheetId));
    if (activeSheetId === sheetId) {
      handleSwitchSheet('parent');
    }
  };

  const handleSwitchSheet = (sheetId: string) => {
    // Save current sheet's state before switching (including all nodes with their positions)
    const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
    let updatedSheets = [...sheets];
    if (currentSheetIndex !== -1) {
        updatedSheets[currentSheetIndex] = { ...updatedSheets[currentSheetIndex], nodes, edges };
        setSheets(updatedSheets);
    }

    // Switch to new sheet (use updated sheets if we just updated, otherwise use original)
    setActiveSheetId(sheetId);
    const sheetsToUse = currentSheetIndex !== -1 ? updatedSheets : sheets;
    const newSheet = sheetsToUse.find(s => s.id === sheetId);
    if (newSheet) {
      // Ensure all swimLane nodes have zIndex: -1
      const normalizedNodes = (newSheet.nodes || []).map((node: any) => 
        node.type === 'swimLane' && node.zIndex === undefined
          ? { ...node, zIndex: -1 }
          : node
      );
      setNodes(normalizedNodes); // Load all nodes including lanes with their saved positions
      setEdges(newSheet.edges || []);
    }
  };

  const startEditingSheet = (sheet: ProcessSheet) => {
    setEditingSheetId(sheet.id);
    setEditingSheetName(sheet.name);
  };

  const saveSheetName = () => {
    if (!editingSheetId) return;
    setSheets(prev => prev.map(s => s.id === editingSheetId ? { ...s, name: editingSheetName } : s));
    setEditingSheetId(null);
    setEditingSheetName('');
  };

  const isReadOnly = projectPermission === 'viewer';

  // History for Undo/Redo
  const [history, setHistory] = useState<{nodes: Node[], edges: Edge[]}[]>([]);
  const [future, setFuture] = useState<{nodes: Node[], edges: Edge[]}[]>([]);
  
  // Track original saved state to detect changes
  const [originalSavedState, setOriginalSavedState] = useState<{sheets: ProcessSheet[], projectName: string} | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Check if there are unsaved changes
  const checkForChanges = useCallback(() => {
    if (!originalSavedState || !projectId) {
      setHasUnsavedChanges(false);
      return;
    }

    // Get current state
    const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
    let currentSheets = [...sheets];
    if (currentSheetIndex !== -1) {
      currentSheets[currentSheetIndex] = { ...currentSheets[currentSheetIndex], nodes, edges };
    }

    // Compare with original
    const currentStateStr = JSON.stringify({
      sheets: currentSheets.map(s => ({
        id: s.id,
        name: s.name,
        nodes: s.nodes,
        edges: s.edges
      })),
      projectName
    });
    const originalStateStr = JSON.stringify(originalSavedState);

    setHasUnsavedChanges(currentStateStr !== originalStateStr);
  }, [originalSavedState, sheets, activeSheetId, nodes, edges, projectName, projectId]);

  // Save history on every change
  const saveHistory = useCallback(() => {
    if (isReadOnly) return;
    setHistory(prev => {
      // Only save if different from last history entry
      if (prev.length === 0 || JSON.stringify(prev[prev.length - 1]) !== JSON.stringify({ nodes, edges })) {
        return [...prev, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }];
      }
      return prev;
    });
    setFuture([]);
  }, [nodes, edges, isReadOnly]);

  // Wrapped onNodesChange to save history
  const wrappedOnNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    // Debounce history saving to avoid too many entries
    setTimeout(() => {
      saveHistory();
      checkForChanges();
    }, 100);
  }, [onNodesChange, saveHistory, checkForChanges]);

  // Wrapped onEdgesChange to save history
  const wrappedOnEdgesChange = useCallback((changes: any) => {
    onEdgesChange(changes);
    // Debounce history saving to avoid too many entries
    setTimeout(() => {
      saveHistory();
      checkForChanges();
    }, 100);
  }, [onEdgesChange, saveHistory, checkForChanges]);

  // Track changes when nodes, edges, sheets, or projectName change
  useEffect(() => {
    if (originalSavedState && projectId) {
      checkForChanges();
    }
  }, [nodes, edges, sheets, projectName, originalSavedState, projectId, checkForChanges]);

  const handleUndo = useCallback(() => {
    if (history.length === 0 || isReadOnly) return;
    const lastHistory = history[history.length - 1];
    setNodes(lastHistory.nodes);
    setEdges(lastHistory.edges);
    setHistory(history.slice(0, -1));
    setFuture([...future, { nodes, edges }]);
    setTimeout(() => {
      checkForChanges();
    }, 100);
  }, [history, future, nodes, edges, setNodes, setEdges, isReadOnly, checkForChanges]);

  const handleRedo = useCallback(() => {
    if (future.length === 0 || isReadOnly) return;
    const lastFuture = future[future.length - 1];
    setNodes(lastFuture.nodes);
    setEdges(lastFuture.edges);
    setHistory([...history, lastFuture]);
    setFuture(future.slice(0, -1));
    setTimeout(() => {
      checkForChanges();
    }, 100);
  }, [future, history, nodes, edges, setNodes, setEdges, isReadOnly, checkForChanges]);

  const loadData = useCallback(async () => {
    if (!user) return;

    if (projectId) {
      try {
        // Load project and versions in parallel for better performance
        const projectPromise = axios.get(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`);
        const [projectResponse] = await Promise.all([projectPromise]);
        const data = projectResponse.data;
        
        setProjectName(data.name || 'Untitled Project');
        setProjectOwnerId(data.user_id || null);
        setProjectProcessId(data.process_id || null);
        
        // Load versions in parallel if process_id exists
        if (data.process_id) {
          axios.get(`${process.env.NEXT_PUBLIC_API_URL}/process/${data.process_id}`)
            .then(processResponse => {
              if (processResponse.data.versions) {
                setVersions(processResponse.data.versions);
              }
            })
            .catch(error => {
              console.error("Failed to load process versions:", error);
            });
        }

        if (user) {
          if (data.user_id === user.id) {
            setProjectPermission('owner');
          } else {
            const collaborator = data.collaborators?.find((c: any) => c.user_id === user.id);
            setProjectPermission(collaborator ? (collaborator.role as any) : 'viewer');
          }
        }
        setCurrentCollaborators(data.collaborators || []);

        if (data.sheets && data.sheets.length > 0) {
          // Optimize: Process sheets in a single pass
          const normalizedSheets = data.sheets.map((sheet: any) => {
            // Check if nodes already contain swimLane nodes (new format with saved positions)
            const existingLaneNodes = (sheet.nodes || []).filter((n: any) => n.type === 'swimLane');
            
            let processedNodes = sheet.nodes || [];
            
            // Only migrate old lanes format if no swimLane nodes exist
            if (sheet.lanes && sheet.lanes.length > 0 && existingLaneNodes.length === 0) {
              const laneNodes = sheet.lanes.map((lane: any, index: number) => ({
                id: lane.id || `lane-${index}`,
                type: 'swimLane',
                data: { label: lane.name || `Lane ${index + 1}` },
                position: lane.position || { x: index * 310, y: -50 },
                style: { width: lane.width || 300, height: lane.height || 600 },
                zIndex: -1, // Ensure lane appears behind all other nodes
              }));
              processedNodes = [...processedNodes, ...laneNodes];
            }
            
            // Ensure all swimLane nodes have zIndex: -1 in a single pass
            processedNodes = processedNodes.map((node: any) => 
              node.type === 'swimLane' && node.zIndex === undefined
                ? { ...node, zIndex: -1 }
                : node
            );
            
            return { ...sheet, nodes: processedNodes, lanes: [] };
          });

          setSheets(normalizedSheets);
          setActiveSheetId(normalizedSheets[0].id);
          setNodes(normalizedSheets[0].nodes || []);
          setEdges(normalizedSheets[0].edges || []);
          
          // Store original saved state
          setOriginalSavedState({
            sheets: normalizedSheets.map(s => ({
              id: s.id,
              name: s.name,
              nodes: JSON.parse(JSON.stringify(s.nodes)),
              edges: JSON.parse(JSON.stringify(s.edges))
            })),
            projectName: data.name || 'Untitled Project'
          });
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        console.error("Failed to load project:", error);
      }
    } else if (processId) {
      // Load Process Data
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/process/${processId}`);
        const processData = response.data;
        setProjectName(processData.name || 'Untitled Process');

        if (processData.sheets && processData.sheets.length > 0) {
          // Optimize: Process sheets in a single pass
          const normalizedSheets = processData.sheets.map((sheet: any) => {
            // Check if nodes already contain swimLane nodes (new format with saved positions)
            const existingLaneNodes = (sheet.nodes || []).filter((n: any) => n.type === 'swimLane');
            
            let processedNodes = sheet.nodes || [];
            
            // Only migrate old lanes format if no swimLane nodes exist
            if (sheet.lanes && sheet.lanes.length > 0 && existingLaneNodes.length === 0) {
              const laneNodes = sheet.lanes.map((lane: any, index: number) => ({
                id: lane.id || `lane-${index}`,
                type: 'swimLane',
                data: { label: lane.name || `Lane ${index + 1}` },
                position: lane.position || { x: index * 310, y: -50 },
                style: { width: lane.width || 300, height: lane.height || 600 },
                zIndex: -1, // Ensure lane appears behind all other nodes
              }));
              processedNodes = [...processedNodes, ...laneNodes];
            }
            
            // Ensure all swimLane nodes have zIndex: -1 in a single pass
            processedNodes = processedNodes.map((node: any) => 
              node.type === 'swimLane' && node.zIndex === undefined
                ? { ...node, zIndex: -1 }
                : node
            );
            
            return { ...sheet, nodes: processedNodes, lanes: [] };
          });

          setSheets(normalizedSheets);
          setActiveSheetId(normalizedSheets[0].id);
          setNodes(normalizedSheets[0].nodes || []);
          setEdges(normalizedSheets[0].edges || []);
        }
        if (processData.versions) {
          setVersions(processData.versions);
        }
      } catch (error) {
        console.error("Failed to load process:", error);
      }
    }
  }, [processId, projectId, user?.id]); // Only depend on user.id, not entire user object

  useEffect(() => {
    if (user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId, projectId, user?.id]); // Load when IDs change, not when loadData changes

  // Only update nodes/edges from parent sheet if activeSheetId is 'parent' and sheets changed
  useEffect(() => {
    if (activeSheetId === 'parent') {
      const parentSheet = sheets.find(s => s.id === 'parent');
      if (parentSheet) {
        setNodes(parentSheet.nodes || []);
        setEdges(parentSheet.edges || []);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets, activeSheetId]); // Only update when sheets or activeSheetId changes

  // Fetch users for ShareProjectDialog - only when needed (when projectId exists)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.id || !projectId) return; // Only fetch if we have a project
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
          headers: { 'X-Clerk-User-Id': user.id }
        });
        setUsers(response.data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    fetchUsers();
  }, [user?.id, projectId]); // Only depend on user.id and projectId

  // Handlers for ProcessSidebar
  const handleSaveVersion = useCallback(async () => {
    const targetProcessId = processId || projectProcessId;
    if (!targetProcessId || isReadOnly) return;
    
    // Save current sheet state before saving version (including all nodes with their positions)
    const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
    let updatedSheets = [...sheets];
    if (currentSheetIndex !== -1) {
      updatedSheets[currentSheetIndex] = { ...updatedSheets[currentSheetIndex], nodes, edges };
      setSheets(updatedSheets);
    }

    const versionName = `Version ${new Date().toISOString()}`;
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/processes/${targetProcessId}/versions`, {
        name: versionName,
        sheets: updatedSheets.map(s => ({
          id: s.id,
          name: s.name,
          nodes: s.nodes, // Includes all nodes (including lanes) with their current positions
          edges: s.edges
        }))
      });
      // Reload versions
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/process/${targetProcessId}`);
      if (response.data.versions) {
        setVersions(response.data.versions);
      }
      alert('Version saved successfully!');
    } catch (error) {
      console.error('Failed to save version:', error);
      alert('Failed to save version');
    }
  }, [processId, projectProcessId, isReadOnly, sheets, activeSheetId, nodes, edges]);

  const handleLoadFile = useCallback((file: File) => {
    if (isReadOnly) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.sheets && Array.isArray(data.sheets)) {
          setSheets(data.sheets);
          if (data.sheets.length > 0) {
            setActiveSheetId(data.sheets[0].id);
            setNodes(data.sheets[0].nodes || []);
            setEdges(data.sheets[0].edges || []);
          }
        } else if (data.nodes) {
          // Legacy format
          setSheets([{ id: 'parent', name: 'Parent Process', nodes: data.nodes || [], edges: data.edges || [] }]);
          setActiveSheetId('parent');
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
        }
        alert('File loaded successfully!');
      } catch (error) {
        console.error('Failed to parse file:', error);
        alert('Failed to load file. Invalid JSON format.');
      }
    };
    reader.readAsText(file);
  }, [isReadOnly, setNodes, setEdges]);

  const handleDownload = useCallback(() => {
    // Save current sheet state before downloading (including all nodes with their positions)
    const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
    let updatedSheets = [...sheets];
    if (currentSheetIndex !== -1) {
      updatedSheets[currentSheetIndex] = { ...updatedSheets[currentSheetIndex], nodes, edges };
      setSheets(updatedSheets);
    }

    const dataStr = JSON.stringify({ sheets: updatedSheets }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'process'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [sheets, activeSheetId, nodes, edges, projectName]);

  const handleLoadVersion = useCallback((versionName: string) => {
    if (isReadOnly) return;
    const version = versions.find(v => v.name === versionName);
    if (version && version.sheets) {
      // Ensure all swimLane nodes have zIndex: -1
      const normalizedSheets = version.sheets.map((sheet: any) => ({
        ...sheet,
        nodes: (sheet.nodes || []).map((node: any) => 
          node.type === 'swimLane' && node.zIndex === undefined
            ? { ...node, zIndex: -1 }
            : node
        )
      }));
      setSheets(normalizedSheets);
      if (normalizedSheets.length > 0) {
        setActiveSheetId(normalizedSheets[0].id);
        setNodes(normalizedSheets[0].nodes || []);
        setEdges(normalizedSheets[0].edges || []);
      }
      alert('Version loaded successfully!');
    }
  }, [isReadOnly, versions, setNodes, setEdges]);

  const handleAddLane = useCallback(() => {
    if (isReadOnly) return;
    const laneCount = nodes.filter(n => n.type === 'swimLane').length;
    const newLane = {
      id: `lane-${Date.now()}`,
      type: 'swimLane' as const,
      data: { label: `Lane ${laneCount + 1}` },
      position: { x: laneCount * 310, y: -50 },
      style: { width: 300, height: 600 },
      zIndex: -1, // Ensure lane appears behind all other nodes
    };
    setNodes((nds) => {
      const updated = [...nds, newLane];
      setTimeout(() => {
        if (!isReadOnly) {
          saveHistory();
          checkForChanges();
        }
      }, 100);
      return updated;
    });
  }, [isReadOnly, nodes, setNodes, saveHistory, checkForChanges]);

  const handleSaveProject = useCallback(async () => {
    if (!projectId || isReadOnly || !hasUnsavedChanges) return;
    
    setIsSaving(true);
    try {
      // Save current sheet state before saving (including all nodes with their positions)
      const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
      let updatedSheets = [...sheets];
      if (currentSheetIndex !== -1) {
        updatedSheets[currentSheetIndex] = { ...updatedSheets[currentSheetIndex], nodes, edges };
        setSheets(updatedSheets);
      }

      const sheetsToSave = updatedSheets.map(s => ({
        id: s.id,
        name: s.name,
        nodes: s.nodes, // Includes all nodes (including lanes) with their current positions
        edges: s.edges
      }));

      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`, {
        name: projectName,
        sheets: sheetsToSave
      });
      
      // Update original saved state
      setOriginalSavedState({
        sheets: sheetsToSave.map(s => ({
          id: s.id,
          name: s.name,
          nodes: JSON.parse(JSON.stringify(s.nodes)),
          edges: JSON.parse(JSON.stringify(s.edges))
        })),
        projectName
      });
      setHasUnsavedChanges(false);
      alert('Project saved successfully!');
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Failed to save project');
    } finally {
      setIsSaving(false);
    }
  }, [projectId, isReadOnly, hasUnsavedChanges, sheets, activeSheetId, nodes, edges, projectName]);

  const handleDeleteProject = useCallback(async () => {
    if (!projectId || isReadOnly) return;
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
    
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`, {
        headers: { "X-Clerk-User-Id": user?.id }
      });
      router.push('/dashboard/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project');
    }
  }, [projectId, isReadOnly, user, router]);

  const handleUpdateCollaborators = useCallback(async () => {
    // Reload collaborators without full data reload for better performance
    if (!user?.id || !projectId) return;
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`);
      setCurrentCollaborators(response.data.collaborators || []);
    } catch (error) {
      console.error("Failed to reload collaborators:", error);
    }
  }, [user?.id, projectId]);

  // Handle project name editing
  const startEditingProjectName = useCallback(() => {
    if (isReadOnly || !projectId) return;
    setEditingProjectNameValue(projectName);
    setIsEditingProjectName(true);
  }, [projectName, isReadOnly, projectId]);

  const saveProjectName = useCallback(async () => {
    if (!projectId || isReadOnly || !editingProjectNameValue.trim()) {
      setIsEditingProjectName(false);
      return;
    }
    
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}/rename`, {
        name: editingProjectNameValue.trim()
      });
      setProjectName(editingProjectNameValue.trim());
      setIsEditingProjectName(false);
    } catch (error) {
      console.error('Failed to rename project:', error);
      alert('Failed to rename project');
      setIsEditingProjectName(false);
    }
  }, [projectId, isReadOnly, editingProjectNameValue]);

  const cancelEditingProjectName = useCallback(() => {
    setIsEditingProjectName(false);
    setEditingProjectNameValue('');
  }, []);

  // Keyboard shortcuts for toolbox items
  useEffect(() => {
    if (isReadOnly) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Only trigger if not typing in an input/textarea
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Check for Ctrl/Cmd + key combinations
      const isModifierPressed = event.ctrlKey || event.metaKey;
      
      // Toolbox shortcuts (single key, no modifier needed when canvas is focused)
      if (!isModifierPressed && rfInstance) {
        const shortcuts: { [key: string]: { type: string; label: string } } = {
          'w': { type: 'workProduct', label: 'Work Product' },
          'W': { type: 'workProduct', label: 'Work Product' },
          'a': { type: 'activity', label: 'Activity' },
          'A': { type: 'activity', label: 'Activity' },
          'd': { type: 'decision', label: 'Decision' },
          'D': { type: 'decision', label: 'Decision' },
          'p': { type: 'process', label: 'Process' },
          'P': { type: 'process', label: 'Process' },
          'o': { type: 'document', label: 'Document' },
          'O': { type: 'document', label: 'Document' },
          't': { type: 'text', label: 'Text Box' },
          'T': { type: 'text', label: 'Text Box' },
          'l': { type: 'lane', label: 'Lane' },
          'L': { type: 'lane', label: 'Lane' },
        };

        const shortcut = shortcuts[event.key];
        if (shortcut) {
          event.preventDefault();
          
          if (shortcut.type === 'lane') {
            handleAddLane();
          } else {
            // Add node at center of viewport
            const viewport = rfInstance.getViewport();
            const centerX = -viewport.x + window.innerWidth / 2;
            const centerY = -viewport.y + window.innerHeight / 2;
            const position = rfInstance.screenToFlowPosition({
              x: centerX,
              y: centerY,
            });

      const newNode = {
            id: getId(),
            type: shortcut.type,
            position,
            data: { label: shortcut.label },
          };

            setNodes((nds) => {
              const updated = [...nds, newNode];
              setTimeout(() => {
                if (!isReadOnly) {
                  saveHistory();
                  checkForChanges();
                }
              }, 100);
              return updated;
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [isReadOnly, rfInstance, setNodes, handleAddLane]);

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b p-3 bg-white">
        <div className="flex items-center gap-2">
          <button className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight size={20} className="text-gray-600" />
          </button>
          {isEditingProjectName && projectId ? (
            <input
              type="text"
              value={editingProjectNameValue}
              onChange={(e) => setEditingProjectNameValue(e.target.value)}
              onBlur={saveProjectName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  saveProjectName();
                } else if (e.key === 'Escape') {
                  cancelEditingProjectName();
                }
              }}
              autoFocus
              className="text-lg font-bold text-gray-900 bg-transparent border-b-2 border-blue-500 outline-none px-1 min-w-[200px]"
            />
          ) : (
            <h1 
              className="text-lg font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
              onDoubleClick={startEditingProjectName}
              title={projectId && !isReadOnly ? "Double-click to rename" : undefined}
            >
              {projectName || 'Create New Process'}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo size={18} className="text-gray-600" />
          </button>
          <button
            onClick={handleRedo}
            disabled={future.length === 0}
            className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo size={18} className="text-gray-600" />
          </button>
          <button
            onClick={handleDeleteProject}
            disabled={!projectId || isReadOnly}
            className="p-2 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete Project"
          >
            <Trash2 size={18} className="text-red-600" />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          {projectId && (
            <ShareProjectDialog
              projectId={projectId}
              users={users}
              currentCollaborators={currentCollaborators}
              projectOwnerId={projectOwnerId || undefined}
              onUpdate={handleUpdateCollaborators}
            />
          )}
          {hasUnsavedChanges && (
            <Button
              onClick={handleSaveProject}
              disabled={!projectId || isReadOnly || isSaving || !hasUnsavedChanges}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Project'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow relative flex overflow-hidden">
        <ProcessSidebar
          onSaveVersion={(processId || projectProcessId) ? handleSaveVersion : undefined}
          onLoadFile={!isReadOnly ? handleLoadFile : undefined}
          onDownload={handleDownload}
          versions={versions}
          onLoadVersion={!isReadOnly ? handleLoadVersion : undefined}
          onAddLane={!isReadOnly ? handleAddLane : undefined}
        />
        <ReactFlowProvider>
          <ProcessCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(params) => setEdges((eds) => addEdge(params, eds))}
            setNodes={setNodes}
            setEdges={setEdges}
            users={users}
            isReadOnly={isReadOnly}
            projectId={projectId}
            onInit={(instance) => setRfInstance(instance)}
            wrappedOnNodesChange={wrappedOnNodesChange}
            wrappedOnEdgesChange={wrappedOnEdgesChange}
          />
        </ReactFlowProvider>
      </div>

      {/* Bottom Bar - Sheet Tabs */}
      <div className="flex items-center border-t p-2 bg-white">
        <div className="flex items-center flex-grow overflow-x-auto">
          {sheets.map((sheet) => (
            <div
              key={sheet.id}
              className={cn(
                'flex items-center p-1.5 rounded-md text-xs font-medium cursor-pointer group',
                activeSheetId === sheet.id ? 'bg-gray-200' : 'hover:bg-gray-100'
              )}
              onClick={() => handleSwitchSheet(sheet.id)}
              onDoubleClick={() => startEditingSheet(sheet)}
            >
              {editingSheetId === sheet.id ? (
                <input
                  value={editingSheetName}
                  onChange={(e) => setEditingSheetName(e.target.value)}
                  onBlur={saveSheetName}
                  onKeyDown={(e) => e.key === 'Enter' && saveSheetName()}
                  autoFocus
                  className="w-24 px-1 py-0.5 text-xs border rounded"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  {sheet.id === 'parent' ? <Layout className="w-3 h-3 mr-1" /> : <FileSpreadsheet className="w-3 h-3 mr-1" />}
                  <span>{sheet.name}</span>
                  {sheet.id !== 'parent' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSheet(sheet.id); }}
                      className="ml-1 p-0.5 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          <button
            onClick={handleAddSheet}
            className="p-1.5 hover:bg-gray-200 rounded-full ml-2 text-gray-600"
            title="Add Child Process"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

