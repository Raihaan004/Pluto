'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Plus, FileSpreadsheet, Layout, Undo, Redo, Trash2, Edit2, Check, X, Users, ChevronRight, History, Download, Settings, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import { useUserRole } from '@/context/UserRoleContext';
import { useNavigation, useNavigationState, useNavigationDispatch } from '@/context/NavigationContext';
import { ProcessProvider, useProcessContext } from '@/context/ProcessContext';
import { useCustomNodeStates } from '@/hooks/useCustomNodeStates';
import { useHelperLines } from '@/hooks/useHelperLines';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { HelperLines } from '@/components/process/HelperLines';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
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
  getNodesBounds,
  getViewportForBounds,
  ConnectionLineType,
  NodeChange,
} from 'reactflow';

// Import ReactFlow normally (needed immediately for canvas)
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

const getId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
  isPublished?: boolean;
  projectId?: string | null;
  projectOwnerId?: string | null;
  currentUser?: any;
  onInit?: (instance: any) => void;
  wrappedOnNodesChange?: OnNodesChange;
  wrappedOnEdgesChange?: OnEdgesChange;
  onNodeDragStart?: (event: React.MouseEvent, node: Node) => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  dialogData: any;
  edgeStyle: 'blue-solid' | 'red-dashed';
  saveHistory: () => void;
  checkForChanges: () => void;
  sheets: ProcessSheet[];
  handleSwitchSheet: (sheetId: string) => void;
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
  isPublished = false,
  projectId,
  projectOwnerId,
  currentUser,
  onInit,
  wrappedOnNodesChange,
  wrappedOnEdgesChange,
  onNodeDragStart,
  dialogOpen,
  setDialogOpen,
  dialogData,
  edgeStyle,
  saveHistory,
  checkForChanges,
  sheets,
  handleSwitchSheet
}: ProcessCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    if (reactFlowInstance && onInit) {
      onInit(reactFlowInstance);
    }
  }, [reactFlowInstance, onInit]);
  
  const { openNodeDialog, setNodes: contextSetNodes } = useProcessContext();

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
        if (isReadOnly) return;
        saveHistory();
        setEdges((els) => updateEdge(oldEdge, newConnection, els));
        checkForChanges();
    },
    [setEdges, isReadOnly, saveHistory, checkForChanges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = isReadOnly ? 'none' : 'move';
  }, [isReadOnly]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (isReadOnly) return;
      saveHistory();

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
        return nds.concat(newNode);
      });

      if (wrappedOnNodesChange) {
        wrappedOnNodesChange([{ type: 'add', item: newNode }]);
      }
    },
    [reactFlowInstance, setNodes, wrappedOnNodesChange, saveHistory]
  );

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (isReadOnly) {
      const isResponsible = node.data.responsibility?.includes(currentUser?.id);
      const isSupport = node.data.support?.includes(currentUser?.id);
      if (isResponsible || isSupport) {
        setSelectedNode(node);
      }
      return;
    }
    setSelectedNode(node);
  }, [isReadOnly, currentUser]);

  const onNodeDragStop = useCallback(() => {
    if (isReadOnly) return;
    // Manually trigger change check after drag ends history was saved at start
    checkForChanges();
  }, [isReadOnly, checkForChanges]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // No-op handlers for read-only mode to prevent infinite loops
  const noOpNodesChange = useCallback(() => {}, []);
  const noOpEdgesChange = useCallback(() => {}, []);
  const noOpConnect = useCallback(() => {}, []);

  const handleSaveProperties = (nodeId: string, newData: any) => {
    if (isReadOnly) {
      const node = nodes.find(n => n.id === nodeId);
      const isResponsible = node?.data.responsibility?.includes(currentUser?.id);
      const isSupport = node?.data.support?.includes(currentUser?.id);
      if (!isResponsible && !isSupport) return;
    }
    saveHistory();
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
    setSelectedNode(null);
    checkForChanges();
  };

  const { helperLines, calculateHelperLines, setHelperLines } = useHelperLines();

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      let nextChanges = changes;

      // Handle alignment and snapping
      if (changes.length === 1 && changes[0].type === 'position') {
        const change0 = changes[0];
        const helperLineConfig = calculateHelperLines(change0, nodes);

        if (helperLineConfig) {
          nextChanges = changes.map((change) => {
            if (change.type === 'position' && change.id === (change0 as any).id && change.position) {
              return {
                ...change,
                position: helperLineConfig.snapPosition,
              };
            }
            return change;
          });
        }
      } else {
        setHelperLines({});
      }

      // Automatically adjust edges if nodes are being moved
      const movedNodeIds = changes
        .filter(c => c.type === 'position' && c.dragging)
        .map(c => (c as any).id);

      if (movedNodeIds.length > 0) {
        setEdges((prevEdges) =>
          prevEdges.map((edge) => {
            if (
              (movedNodeIds.includes(edge.source) || movedNodeIds.includes(edge.target)) &&
              edge.data?.points
            ) {
              // Clear manual points to let the edge auto-adjust
              return {
                ...edge,
                data: { ...edge.data, points: undefined },
              };
            }
            return edge;
          })
        );
      }

      if (wrappedOnNodesChange) {
        wrappedOnNodesChange(nextChanges);
      } else {
        onNodesChange(nextChanges);
      }
    },
    [nodes, onNodesChange, wrappedOnNodesChange, calculateHelperLines, setHelperLines, setEdges]
  );

  return (
    <div className="grow h-full bg-gray-50 relative flex flex-col" ref={reactFlowWrapper}>
      <div className="grow relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={isReadOnly ? noOpNodesChange : handleNodesChange}
                onEdgesChange={isReadOnly ? noOpEdgesChange : (wrappedOnEdgesChange || onEdgesChange)}
                onConnect={isReadOnly ? noOpConnect : onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeDoubleClick={onNodeDoubleClick}
                onNodeDragStart={onNodeDragStart}
                onNodeDragStop={() => {
                  setHelperLines({});
                  onNodeDragStop();
                }}
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
                connectionLineType={ConnectionLineType.Step}
                connectionLineStyle={edgeStyle === 'red-dashed' 
                  ? { stroke: '#ef4444', strokeDasharray: '5,5', strokeWidth: 2 } 
                  : { stroke: '#3b82f6', strokeWidth: 2 }}
                deleteKeyCode={isReadOnly ? null : ['Backspace', 'Delete']}
                // fitView // Disable fitView to respect lane coordinates
            >

                <Controls />
                <Background color="#aaa" gap={16} />
                <MiniMap />
                <HelperLines horizontal={helperLines.horizontal} vertical={helperLines.vertical} />
            </ReactFlow>
      </div>

      {selectedNode && selectedNode.type !== 'swimLane' && (!isReadOnly || (selectedNode.data.responsibility?.includes(currentUser?.id) || selectedNode.data.support?.includes(currentUser?.id))) && (
        <PropertiesPanel 
            selectedNode={selectedNode} 
            onSave={handleSaveProperties} 
            onClose={() => setSelectedNode(null)}
            projectId={projectId}
            projectOwnerId={projectOwnerId}
            isPublished={isPublished}
            sheets={sheets}
        />
      )}
      
      <NodeInfoDialog 
        isOpen={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        data={dialogData} 
        users={users}
        onViewSheet={handleSwitchSheet}
        sheets={sheets}
      />
    </div>
  );
};

export default function CreateProcessPage() {
  const { role, loading } = useUserRole();
  const { user } = useUser();
  const { hasUnsavedChanges } = useNavigationState();
  const { setHasUnsavedChanges, setSaveAction } = useNavigationDispatch();
  const router = useRouter();

  useEffect(() => {
    // Reset on unmount
    return () => {
      setHasUnsavedChanges(false);
      setSaveAction(null);
    };
  }, []);
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
  const [projectStatus, setProjectStatus] = useState<string>('draft');
  const [versionName, setVersionName] = useState<string | null>(null);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editingProjectNameValue, setEditingProjectNameValue] = useState('');
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isSaveVersionDialogOpen, setIsSaveVersionDialogOpen] = useState(false);
  const [isDeleteSheetDialogOpen, setIsDeleteSheetDialogOpen] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState<string | null>(null);
  const [newVersionName, setNewVersionName] = useState('');
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingSheetName, setEditingSheetName] = useState('');
  const [edgeStyle, setEdgeStyle] = useState<'blue-solid' | 'red-dashed'>('blue-solid');
  const [saveScope, setSaveScope] = useState<'all' | 'current'>('all');

  const pathname = usePathname();
  const isProjectCanvas = pathname.includes('/dashboard/projects/editor');

  // Load Version Confirmation
  const [isLoadVersionConfirmOpen, setIsLoadVersionConfirmOpen] = useState(false);
  const [pendingVersionName, setPendingVersionName] = useState<string | null>(null);

  // Dialog State moved from ProcessCanvas
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<any>(null);

  const openNodeDialog = useCallback((data: any) => {
    const isResponsible = data.responsibility?.includes(user?.id);
    const isSupport = data.support?.includes(user?.id);
    
    // Allow if user is owner/editor, OR if they are an assigned user on this node
    if (projectPermission === 'viewer' && !isResponsible && !isSupport) return;
    
    setDialogData(data);
    setDialogOpen(true);
  }, [projectPermission, user?.id]);

  const handleAddSheet = () => {
    const newSheetId = `sheet_${Date.now()}`;
    const newSheet: ProcessSheet = {
      id: newSheetId,
      name: 'New Sheet',
      nodes: [],
      edges: [],
    };
    
    // Save current sheet's state before switching
    const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
    let updatedSheets = [...sheets, newSheet];
    if (currentSheetIndex !== -1) {
        updatedSheets[currentSheetIndex] = { ...updatedSheets[currentSheetIndex], nodes, edges };
    }
    
    setSheets(updatedSheets);
    handleSwitchSheet(newSheetId, updatedSheets);
  };

  const handleDeleteSheet = (sheetId: string) => {
    if (sheetId === 'parent') return;
    setSheetToDelete(sheetId);
    setIsDeleteSheetDialogOpen(true);
  };

  const confirmDeleteSheet = () => {
    if (!sheetToDelete) return;
    const updatedSheets = sheets.filter(s => s.id !== sheetToDelete);
    setSheets(updatedSheets);
    if (activeSheetId === sheetToDelete) {
      handleSwitchSheet('parent', updatedSheets);
    }
    setIsDeleteSheetDialogOpen(false);
    setSheetToDelete(null);
  };

  const handleSwitchSheet = (sheetId: string, sheetsArray?: ProcessSheet[]) => {
    const sheetsToUse = sheetsArray || sheets;
    
    // Save current sheet's state before switching (including all nodes with their positions)
    // Only if we're not already using a provided sheetsArray (which should already be updated)
    if (!sheetsArray) {
      const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
      if (currentSheetIndex !== -1) {
          const updatedSheets = [...sheets];
          updatedSheets[currentSheetIndex] = { ...updatedSheets[currentSheetIndex], nodes, edges };
          setSheets(updatedSheets);
          // We continue with the updated sheets for the switch
          const newSheet = updatedSheets.find(s => s.id === sheetId);
          if (newSheet) {
            setActiveSheetId(sheetId);
            const normalizedNodes = (newSheet.nodes || []).map((node: any) => 
              node.type === 'swimLane' && node.zIndex === undefined
                ? { ...node, zIndex: -1 }
                : node
            );
            setNodes(normalizedNodes);
            setEdges(newSheet.edges || []);
          }
          return;
      }
    }

    // Switch to new sheet using the provided or current sheets
    setActiveSheetId(sheetId);
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

  const isReadOnly = useMemo(() => {
    if (projectId && projectPermission === null) return true;
    if (projectPermission === 'viewer') return true;
    if (projectStatus === 'published') return true;
    return false;
  }, [projectId, projectPermission, projectStatus]);

  const canUnlock = useMemo(() => {
    return role === 'admin';
  }, [role]);

  // History for Undo/Redo
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo();
  
  // Refs to always have latest state in callbacks without re-creating them
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Track original saved state to detect changes
  const [originalSavedState, setOriginalSavedState] = useState<{sheets: ProcessSheet[], projectName: string} | null>(null);

  // Check if there are unsaved changes
  const checkForChanges = useCallback(() => {
    // For new unsaved processes
    if (!originalSavedState || (!projectId && !processId)) {
      // Check if current state differs from initial state
      const hasMoreThanOneSheet = sheets.length > 1;
      const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
      
      // Find parent process sheet
      const parentSheet = sheets.find(s => s.id === 'parent');
      const hasAddedNodes = (parentSheet?.nodes.length || 0) > 1 || nodesRef.current.length > 1;
      const hasAddedEdges = (parentSheet?.edges.length || 0) > 0 || edgesRef.current.length > 0;
      const hasRenamedProject = projectName !== 'Create New Process' && projectName !== '';

      if (hasMoreThanOneSheet || hasAddedNodes || hasAddedEdges || hasRenamedProject) {
        setHasUnsavedChanges(true);
      } else {
        setHasUnsavedChanges(false);
      }
      return;
    }

    // Get current state
    const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
    let currentSheets = [...sheets];
    if (currentSheetIndex !== -1) {
      currentSheets[currentSheetIndex] = { ...currentSheets[currentSheetIndex], nodes: nodesRef.current, edges: edgesRef.current };
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
  }, [originalSavedState, sheets, activeSheetId, projectName, projectId, processId]);

  // Save history on every change
  const saveHistory = useCallback(() => {
    if (isReadOnly) return;
    takeSnapshot(nodesRef.current, edgesRef.current);
  }, [isReadOnly, takeSnapshot]);

  const handleTriggerConnectionJira = useCallback(async (activityNode: any, wpNode: any) => {
    try {
        const metadata = {
            project_name: projectName,
            project_id: projectId || processId,
        };

        const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/jira/connection-trigger`, {
            activity_data: activityNode.data,
            work_product_data: wpNode.data,
            metadata: metadata
        });

        if (response.data.jira_key) {
            toast.success(`Connection automated! Jira ticket created: ${response.data.jira_key}`);
            
            // Also update the activity node with the Jira ID if it doesn't have one
            if (!activityNode.data.jira_issue_id) {
                setNodes(nds => nds.map(n => n.id === activityNode.id ? {
                    ...n, 
                    data: { ...n.data, jira_issue_id: response.data.jira_key }
                } : n));
            }
        }
    } catch (error) {
        console.error("Failed to trigger Jira automation:", error);
    }
  }, [projectName, projectId, processId, setNodes]);

  const onConnect = useCallback((params: any) => {
    saveHistory();
    const isRed = edgeStyle === 'red-dashed';
    const edgeParams = {
      ...params,
      type: 'editable-step',
      animated: isRed,
      style: isRed 
        ? { stroke: '#ef4444', strokeDasharray: '5,5', strokeWidth: 2 } 
        : { stroke: '#3b82f6', strokeWidth: 2 },
      data: { edgeStyle }
    };
    setEdges((eds) => addEdge(edgeParams, eds));
    checkForChanges();

    // Trigger Jira automation if activity connects to work product
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);

    if (sourceNode && targetNode) {
        const isActivitySource = sourceNode.type === 'activity';
        const isWPSource = sourceNode.type === 'workProduct';
        const isActivityTarget = targetNode.type === 'activity';
        const isWPTarget = targetNode.type === 'workProduct';

        if ((isActivitySource && isWPTarget) || (isWPSource && isActivityTarget)) {
            const activityNode = isActivitySource ? sourceNode : targetNode;
            const wpNode = isWPSource ? sourceNode : targetNode;
            
            // Trigger Jira ticket
            handleTriggerConnectionJira(activityNode, wpNode);
        }
    }
  }, [edgeStyle, setEdges, saveHistory, checkForChanges, nodes, handleTriggerConnectionJira]);

  const onNodeDragStart = useCallback(() => {
    if (isReadOnly) return;
    saveHistory();
  }, [isReadOnly, saveHistory]);

  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Wrapped onNodesChange to save history
  const wrappedOnNodesChange = useCallback((changes: any) => {
    // Only trigger history/change check for meaningful structural changes
    // dragging is handled by onNodeDragStart
    const isMeaningful = changes.some((c: any) => 
      c.type === 'remove' || 
      c.type === 'add' || 
      c.type === 'reset' ||
      c.type === 'dimensions'
    );

    if (isMeaningful) {
      saveHistory(); // Save state BEFORE applying change
    }

    onNodesChange(changes);

    if (isMeaningful) {
      if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = setTimeout(() => {
        checkForChanges();
      }, 300);
    }
  }, [onNodesChange, saveHistory, checkForChanges]);

  // Wrapped onEdgesChange to save history
  const wrappedOnEdgesChange = useCallback((changes: any) => {
    const isMeaningful = changes.some((c: any) => 
      c.type === 'remove' || c.type === 'add' || c.type === 'reset'
    );

    if (isMeaningful) {
      saveHistory();
    }

    onEdgesChange(changes);

    if (isMeaningful) {
      if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = setTimeout(() => {
        checkForChanges();
      }, 200);
    }
  }, [onEdgesChange, saveHistory, checkForChanges]);

  // Track changes when nodes, edges, sheets, or projectName change
  useEffect(() => {
    if (originalSavedState && projectId) {
      checkForChanges();
    }
  }, [nodes, edges, sheets, projectName, originalSavedState, projectId, checkForChanges]);

  const handleUndo = useCallback(() => {
    if (!canUndo || isReadOnly) return;
    undo(nodesRef.current, edgesRef.current, setNodes, setEdges);
    setTimeout(() => {
      checkForChanges();
    }, 100);
  }, [canUndo, isReadOnly, undo, setNodes, setEdges, checkForChanges]);

  const handleRedo = useCallback(() => {
    if (!canRedo || isReadOnly) return;
    redo(nodesRef.current, edgesRef.current, setNodes, setEdges);
    setTimeout(() => {
      checkForChanges();
    }, 100);
  }, [canRedo, isReadOnly, redo, setNodes, setEdges, checkForChanges]);

  const loadData = useCallback(async () => {
    if (!user) return;

    if (projectId) {
      try {
        // Load project and versions in parallel for better performance
        const projectPromise = axios.get(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`);
        const [projectResponse] = await Promise.all([projectPromise]);
        const data = projectResponse.data;
        
        setProjectName(data.name || 'Untitled Project');
        setProjectStatus(data.status || 'draft');
        setVersionName(data.version_name || null);
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
            sheets: normalizedSheets.map((s: ProcessSheet) => ({
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
          
          // Store original saved state
          setOriginalSavedState({
            sheets: normalizedSheets.map((s: ProcessSheet) => ({
              id: s.id,
              name: s.name,
              nodes: JSON.parse(JSON.stringify(s.nodes)),
              edges: JSON.parse(JSON.stringify(s.edges))
            })),
            projectName: processData.name || 'Untitled Process'
          });
          setHasUnsavedChanges(false);
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
    
    setNewVersionName(`Version ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    setIsSaveVersionDialogOpen(true);
  }, [processId, projectProcessId, isReadOnly]);

  const confirmSaveVersion = useCallback(async () => {
    const targetProcessId = processId || projectProcessId;
    if (!targetProcessId || isReadOnly || !newVersionName.trim()) return;
    
    setIsSaving(true);
    try {
      // Save current sheet state before saving version (including all nodes with their positions)
      const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
      let updatedSheets = [...sheets];
      if (currentSheetIndex !== -1) {
        updatedSheets[currentSheetIndex] = { ...updatedSheets[currentSheetIndex], nodes, edges };
        setSheets(updatedSheets);
      }

      const sheetsToSave = saveScope === 'all' 
        ? updatedSheets 
        : [updatedSheets[currentSheetIndex]].filter(Boolean);

      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/processes/${targetProcessId}/versions`, {
        name: newVersionName.trim(),
        sheets: sheetsToSave.map(s => ({
          id: s.id,
          name: s.name,
          nodes: s.nodes, // Includes all nodes (including lanes) with their current positions
          edges: s.edges
        }))
      }, {
        headers: { "X-Clerk-User-Id": user?.id }
      });
      
      // Reload versions
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/process/${targetProcessId}`);
      if (response.data.versions) {
        setVersions(response.data.versions);
      }
      
      setIsSaveVersionDialogOpen(false);
      setNewVersionName('');
      toast.success('Version saved successfully!');
    } catch (error) {
      console.error('Failed to save version:', error);
      toast.error('Failed to save version');
    } finally {
      setIsSaving(false);
    }
  }, [processId, projectProcessId, isReadOnly, sheets, activeSheetId, nodes, edges, newVersionName, user?.id]);

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
        toast.success('File loaded successfully!');
      } catch (error) {
        console.error('Failed to parse file:', error);
        toast.error('Failed to load file. Invalid JSON format.');
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
    setPendingVersionName(versionName);
    setIsLoadVersionConfirmOpen(true);
  }, [isReadOnly]);

  const confirmLoadVersion = useCallback(() => {
    if (!pendingVersionName) return;
    const versionName = pendingVersionName;
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

      const isCurrentSheetNew = activeSheetId.startsWith('sheet_');

      if (isCurrentSheetNew) {
        // Load version data INTO the current "New Sheet"
        const firstVersionSheet = normalizedSheets[0];
        setNodes(firstVersionSheet.nodes || []);
        setEdges(firstVersionSheet.edges || []);
        
        setSheets(prev => {
          const updated = prev.map(s => 
            s.id === activeSheetId 
              ? { ...s, name: firstVersionSheet.name, nodes: firstVersionSheet.nodes, edges: firstVersionSheet.edges }
              : s
          );
          
          if (normalizedSheets.length > 1) {
            return [...updated, ...normalizedSheets.slice(1)];
          }
          return updated;
        });
      } else {
        // Standard behavior: replace all sheets
        setSheets(normalizedSheets);
        if (normalizedSheets.length > 0) {
          setActiveSheetId(normalizedSheets[0].id);
          setNodes(normalizedSheets[0].nodes || []);
          setEdges(normalizedSheets[0].edges || []);
        }
      }

      setVersionName(versionName);
      setHasUnsavedChanges(true);
      toast.success('Version loaded successfully!');
    }
    setIsLoadVersionConfirmOpen(false);
    setPendingVersionName(null);
  }, [versions, activeSheetId, setNodes, setEdges, setActiveSheetId, setHasUnsavedChanges, pendingVersionName]);

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
    setNodes((nds) => [...nds, newLane]);
    wrappedOnNodesChange([{ type: 'add', item: newLane }]);
  }, [isReadOnly, nodes, setNodes, wrappedOnNodesChange]);

  const handleSaveProject = useCallback(async (status?: string) => {
    // Allow saving if status is provided (e.g. for unlocking) even if isReadOnly is true
    if (!projectId || (isReadOnly && !status) || (!hasUnsavedChanges && !status)) return;
    
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

      const payload: any = {
        name: projectName,
        sheets: sheetsToSave,
        version_name: versionName
      };

      if (status) {
        payload.status = status;
      }

      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`, payload);
      
      if (status) {
        setProjectStatus(status);
      }

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
      toast.success(status === 'published' ? 'Project published successfully!' : 'Project saved successfully!');
    } catch (error) {
      console.error('Failed to save project:', error);
      toast.error('Failed to save project');
    } finally {
      setIsSaving(false);
    }
  }, [projectId, isReadOnly, hasUnsavedChanges, sheets, activeSheetId, nodes, edges, projectName, versionName]);

  const handleSaveProcess = useCallback(async (status: 'draft' | 'published') => {
    if (!user?.id || isReadOnly) return;
    
    setIsSaving(true);
    try {
      // Save current sheet state before saving
      const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
      let updatedSheets = [...sheets];
      if (currentSheetIndex !== -1) {
        updatedSheets[currentSheetIndex] = { ...updatedSheets[currentSheetIndex], nodes, edges };
        setSheets(updatedSheets);
      }

      const payload = {
        user_id: user.id,
        name: projectName,
        sheets: updatedSheets.map(s => ({
          id: s.id,
          name: s.name,
          nodes: s.nodes,
          edges: s.edges
        })),
        status: status
      };

      if (processId) {
        await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/processes/${processId}`, payload, {
          headers: { "X-Clerk-User-Id": user?.id }
        });
      } else {
        const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/processes`, payload);
        if (response.data.data && response.data.data[0]) {
          const newId = response.data.data[0].id;
          router.push(`/dashboard/process/create?id=${newId}`);
        }
      }
      
      // Update original saved state
      const sheetsToSave = updatedSheets.map(s => ({
        id: s.id,
        name: s.name,
        nodes: JSON.parse(JSON.stringify(s.nodes)),
        edges: JSON.parse(JSON.stringify(s.edges))
      }));
      
      setOriginalSavedState({
        sheets: sheetsToSave,
        projectName
      });
      setHasUnsavedChanges(false);
      toast.success(`Process ${status === 'draft' ? 'saved as draft' : 'published'} successfully!`);
    } catch (error) {
      console.error('Failed to save process:', error);
      toast.error('Failed to save process');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, isReadOnly, sheets, activeSheetId, nodes, edges, projectName, processId, router]);

  useEffect(() => {
    const saveWrapper = async () => {
      try {
        if (isProjectCanvas) {
          await handleSaveProject('draft');
        } else {
          await handleSaveProcess('draft');
        }
        return true;
      } catch (error) {
        console.error("Save failed", error);
        return false;
      }
    };
    setSaveAction(saveWrapper);
  }, [isProjectCanvas, handleSaveProject, handleSaveProcess, setSaveAction]);

  const handleDeleteSelected = useCallback(() => {
    if (isReadOnly) return;
    
    const hasSelection = nodesRef.current.some(n => n.selected) || edgesRef.current.some(e => e.selected);
    if (!hasSelection) return;
    
    saveHistory();
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
    setHasUnsavedChanges(true);
  }, [isReadOnly, setNodes, setEdges, saveHistory]);

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

  const handleExportPDF = async () => {
    if (!sheets.length) return;
    
    const originalActiveSheetId = activeSheetId;
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    setIsSaving(true);

    try {
      // Sort sheets to have 'parent' first
      const sortedSheets = [...sheets].sort((a, b) => {
        if (a.id === 'parent') return -1;
        if (b.id === 'parent') return 1;
        return 0;
      });

      for (let i = 0; i < sortedSheets.length; i++) {
        const sheet = sortedSheets[i];
        
        // Switch to sheet
        handleSwitchSheet(sheet.id);
        
        // Wait for render and fit view
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (rfInstance) {
          rfInstance.fitView({ padding: 0.2 });
          // Wait a bit more for fitView to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const element = document.querySelector('.react-flow') as HTMLElement;
        if (!element) continue;

        // Hide UI elements for export
        const controls = element.querySelector('.react-flow__controls') as HTMLElement;
        const minimap = element.querySelector('.react-flow__minimap') as HTMLElement;
        const attribution = element.querySelector('.react-flow__attribution') as HTMLElement;
        
        if (controls) controls.style.display = 'none';
        if (minimap) minimap.style.display = 'none';
        if (attribution) attribution.style.display = 'none';

        const dataUrl = await toPng(element, {
          backgroundColor: '#ffffff',
          quality: 1,
          pixelRatio: 2,
        });

        // Restore UI elements
        if (controls) controls.style.display = 'flex';
        if (minimap) minimap.style.display = 'block';
        if (attribution) attribution.style.display = 'block';

        if (i > 0) {
          pdf.addPage();
        }

        // Add Metadata Header
        pdf.setFillColor(245, 247, 250);
        pdf.rect(0, 0, pageWidth, 35, 'F');
        
        pdf.setFontSize(10);
        pdf.setTextColor(100, 116, 139);
        pdf.setFont('helvetica', 'normal');
        
        // Date on top right
        const exportDate = new Date().toLocaleDateString();
        pdf.text(`Exported on: ${exportDate}`, pageWidth - margin - 40, margin);

        // Project Name
        pdf.setFontSize(16);
        pdf.setTextColor(30, 41, 59);
        pdf.setFont('helvetica', 'bold');
        pdf.text(projectName || 'Untitled Project', margin, margin + 5);
        
        // Version and Sheet Info
        pdf.setFontSize(11);
        pdf.setTextColor(71, 85, 105);
        pdf.setFont('helvetica', 'medium');
        let subHeaderText = `Sheet: ${sheet.name}`;
        if (versionName) {
          subHeaderText += `  |  Version: ${versionName}`;
        }
        if (sheet.id !== 'parent') {
          const parentSheet = sheets.find(s => s.id === 'parent');
          if (parentSheet) {
            subHeaderText += `  |  Parent: ${parentSheet.name}`;
          }
        }
        pdf.text(subHeaderText, margin, margin + 15);

        // Add Image
        const imgProps = pdf.getImageProperties(dataUrl);
        const maxWidth = pageWidth - (2 * margin);
        const maxHeight = pageHeight - 45; // Space for header and bottom margin
        
        let finalWidth = maxWidth;
        let finalHeight = (imgProps.height * finalWidth) / imgProps.width;
        
        if (finalHeight > maxHeight) {
          finalHeight = maxHeight;
          finalWidth = (imgProps.width * finalHeight) / imgProps.height;
        }

        // Center horizontally
        const xOffset = (pageWidth - finalWidth) / 2;
        
        pdf.addImage(dataUrl, 'PNG', xOffset, 40, finalWidth, finalHeight);
        
        // Footer
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Page ${i + 1} of ${sortedSheets.length}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
      }

      pdf.save(`${projectName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export PDF. Please try again.');
    } finally {
      handleSwitchSheet(originalActiveSheetId);
      setIsSaving(false);
    }
  };

  // Handle project name editing
  const startEditingProjectName = useCallback(() => {
    if (isReadOnly || (!projectId && !processId)) return;
    setEditingProjectNameValue(projectName);
    setIsEditingProjectName(true);
  }, [projectName, isReadOnly, projectId, processId]);

  const saveProjectName = useCallback(async () => {
    if ((!projectId && !processId) || isReadOnly || !editingProjectNameValue.trim()) {
      setIsEditingProjectName(false);
      return;
    }
    
    try {
      if (projectId) {
        await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}/rename`, {
          name: editingProjectNameValue.trim()
        });
      } else if (processId) {
        await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/processes/${processId}/rename`, {
          name: editingProjectNameValue.trim()
        });
      }
      setProjectName(editingProjectNameValue.trim());
      setIsEditingProjectName(false);
      toast.success('Renamed successfully!');
    } catch (error) {
      console.error('Failed to rename:', error);
      toast.error('Failed to rename');
      setIsEditingProjectName(false);
    }
  }, [projectId, processId, isReadOnly, editingProjectNameValue]);

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

      if (isModifierPressed) {
        if (event.key === 'z' || event.key === 'Z') {
          event.preventDefault();
          if (event.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        } else if (event.key === 'y' || event.key === 'Y') {
          event.preventDefault();
          handleRedo();
          return;
        }
      }
      
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

            setNodes((nds) => [...nds, newNode]);
            wrappedOnNodesChange([{ type: 'add', item: newNode }]);
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
    <ProcessProvider 
      openNodeDialog={openNodeDialog} 
      setNodes={setNodes}
      edgeStyle={edgeStyle}
      setEdgeStyle={setEdgeStyle}
    >
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b p-3 bg-white">
        <div className="flex items-center gap-2">
          <button className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight size={20} className="text-gray-600" />
          </button>
          {isEditingProjectName && (projectId || processId) ? (
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
              className="text-lg font-bold text-gray-900 bg-transparent border-b-2 border-blue-500 outline-none px-1 min-w-50"
            />
          ) : (
            <div className="flex items-center gap-2">
              <h1 
                className="text-lg font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                onDoubleClick={startEditingProjectName}
                title={!isReadOnly ? "Double-click to rename" : undefined}
              >
                {projectName || 'Untitled Process'}
              </h1>
              {versionName && (
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 flex items-center gap-1">
                  <History className="w-3 h-3" />
                  {versionName}
                </span>
              )}
              {projectStatus === 'published' && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                  Published
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo size={18} className="text-gray-600" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo size={18} className="text-gray-600" />
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={isReadOnly}
            className="p-2 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete Selected"
          >
            <Trash2 size={18} className="text-red-600" />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          {projectId ? (
            <>
              {projectPermission === 'owner' && (
                <ShareProjectDialog
                  projectId={projectId}
                  users={users}
                  currentCollaborators={currentCollaborators}
                  projectOwnerId={projectOwnerId || undefined}
                  onUpdate={handleUpdateCollaborators}
                />
              )}
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={isSaving}
                className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 h-9"
              >
                <Download size={18} />
                {isSaving ? 'Exporting...' : 'Export'}
              </Button>
              {projectStatus === 'published' ? (
                canUnlock && (
                  <Button
                    onClick={() => handleSaveProject('draft')}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Unlock Project
                  </Button>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSaveProject('draft')}
                    disabled={isSaving || !hasUnsavedChanges}
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button
                    onClick={() => setIsPublishDialogOpen(true)}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Publish
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleSaveProcess('draft')}
                disabled={isReadOnly || isSaving}
                className="border-blue-600 text-blue-600 hover:bg-blue-50 h-9 px-4"
              >
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                onClick={() => handleSaveProcess('published')}
                disabled={isReadOnly || isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-4"
              >
                {isSaving ? 'Publishing...' : 'Publish'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grow relative flex overflow-hidden">
        <ProcessSidebar
          onSaveVersion={(processId || projectProcessId) ? handleSaveVersion : undefined}
          onLoadFile={!isReadOnly ? handleLoadFile : undefined}
          onDownload={handleDownload}
          versions={versions}
          onLoadVersion={!isReadOnly ? handleLoadVersion : undefined}
          onAddLane={!isReadOnly ? handleAddLane : undefined}
          isReadOnly={isReadOnly}
          showActions={!isProjectCanvas}
        />
        <ReactFlowProvider>
          <ProcessCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            setNodes={setNodes}
            setEdges={setEdges}
            users={users}
            isReadOnly={isReadOnly}
            isPublished={projectStatus === 'published'}
            projectId={projectId}
            projectOwnerId={projectOwnerId}
            currentUser={user}
            onInit={setRfInstance}
            onNodeDragStart={onNodeDragStart}
            wrappedOnNodesChange={wrappedOnNodesChange}
            wrappedOnEdgesChange={wrappedOnEdgesChange}
            dialogOpen={dialogOpen}
            setDialogOpen={setDialogOpen}
            dialogData={dialogData}
            edgeStyle={edgeStyle}
            saveHistory={saveHistory}
            checkForChanges={checkForChanges}
            sheets={sheets}
            handleSwitchSheet={handleSwitchSheet}
          />
        </ReactFlowProvider>
      </div>

      {/* Bottom Bar - Sheet Tabs */}
      <div className="flex items-center border-t p-2 bg-white">
        <div className="flex items-center grow overflow-x-auto">
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
                  {sheet.id !== 'parent' && !isReadOnly && (
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
            disabled={isReadOnly}
            className={cn(
              "p-1.5 rounded-full ml-2 text-gray-600",
              isReadOnly ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"
            )}
            title={isReadOnly ? "Project is locked" : "Add Child Process"}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish Project</DialogTitle>
          <DialogDescription>
            Are you sure you want to publish this project? Once published, it will be locked and no further changes can be made unless it is unlocked by an admin or editor.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsPublishDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              handleSaveProject('published');
              setIsPublishDialogOpen(false);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Confirm Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isSaveVersionDialogOpen} onOpenChange={setIsSaveVersionDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Process Version</DialogTitle>
          <DialogDescription>
            Enter a name for this version and select which sheets to save.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="versionName" className="mb-2 block">Version Name</Label>
            <Input
              id="versionName"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              placeholder="e.g. v1.0 - Initial Draft"
              autoFocus
            />
          </div>
          <div>
            <Label className="mb-2 block">Save Scope</Label>
            <Select 
              value={saveScope} 
              onValueChange={(value: 'all' | 'current') => setSaveScope(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select what to save" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sheets</SelectItem>
                <SelectItem value="current">Current Sheet Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsSaveVersionDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={confirmSaveVersion}
            disabled={isSaving || !newVersionName.trim()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSaving ? 'Saving...' : 'Save Version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isLoadVersionConfirmOpen} onOpenChange={setIsLoadVersionConfirmOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Version Load</DialogTitle>
          <DialogDescription>
            Are you sure you want to load the version <strong>{pendingVersionName}</strong>? 
            {activeSheetId.startsWith('sheet_') 
              ? "This will populate your current new sheet with this version's data."
              : "This will replace all current sheets with the data from this version."}
            Any unsaved changes on the current sheet will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsLoadVersionConfirmOpen(false)}>Cancel</Button>
          <Button 
            onClick={confirmLoadVersion}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Load Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isDeleteSheetDialogOpen} onOpenChange={setIsDeleteSheetDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Sheet</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this sheet? This action cannot be undone and all nodes and edges in this sheet will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDeleteSheetDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={confirmDeleteSheet}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </ProcessProvider>
  );
}

