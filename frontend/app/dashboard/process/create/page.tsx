'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Plus, FileSpreadsheet, Layout, Undo, Redo, Trash2, Edit2, Check, X, Users, ChevronRight, History, Download, Settings, Save, Rocket, Loader2, Cloud, Lock, Unlock } from 'lucide-react';
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
  PanOnScrollMode,
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
import { Textarea } from "@/components/ui/textarea"
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
import { 
  RowControls, 
  TableHeader, 
  TableGrid, 
  TableScrollbars, 
  DEFAULT_COLUMN_WIDTHS, 
  DEFAULT_ROW_HEIGHT,
  ROW_LABEL_WIDTH,
  HEADER_HEIGHT,
  ROWS_COUNT
} from '@/components/process/TableComponents';

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

const ProcessPublishDialog = ({ isOpen, onClose, onPublish, currentName, isProjectCanvas }: { 
    isOpen: boolean, 
    onClose: () => void, 
    onPublish: (name: string, vName: string, vComments: string) => void, 
    currentName: string,
    isProjectCanvas: boolean
}) => {
    const [name, setName] = useState(currentName);
    const [vName, setVName] = useState('');
    const [vComments, setVComments] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName(currentName);
            setVName('');
            setVComments('');
        }
    }, [isOpen, currentName]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isProjectCanvas ? 'Update & Publish' : 'Publish Process'}</DialogTitle>
                    <DialogDescription>
                        {isProjectCanvas 
                            ? 'Update your project name and sync changes with Jira.' 
                            : 'Set a name and version information for this publication.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="pName">{isProjectCanvas ? 'Project Name' : 'Process Name'}</Label>
                        <Input 
                            id="pName" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            placeholder={isProjectCanvas ? "Project Name" : "Process Name"}
                        />
                    </div>
                    {!isProjectCanvas && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="vName">Version Name (e.g. v1.0)</Label>
                                <Input 
                                    id="vName" 
                                    value={vName} 
                                    onChange={(e) => setVName(e.target.value)} 
                                    placeholder="v1.0.0" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="vComments">Version Comments</Label>
                                <Textarea 
                                    id="vComments" 
                                    value={vComments} 
                                    onChange={(e) => setVComments(e.target.value)} 
                                    placeholder="What changed in this version?"
                                    rows={3}
                                />
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onPublish(name, vName, vComments)}>
                        {isProjectCanvas ? 'Publish Update' : 'Publish'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

interface ProcessSheet {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  type?: 'flow' | 'table';
  cellData?: Record<string, string>;
  columnWidths?: number[];
  rowHeight?: number;
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
  type?: 'flow' | 'table';
  columnWidths?: number[];
  onColumnResize?: (index: number, width: number) => void;
  rowHeight?: number;
  onRowHeightResize?: (height: number) => void;
  cellData?: Record<string, string>;
  onCellChange?: (id: string, value: string) => void;
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
  handleSwitchSheet,
  // Table props
  type = 'flow',
  columnWidths = DEFAULT_COLUMN_WIDTHS,
  onColumnResize,
  rowHeight = DEFAULT_ROW_HEIGHT,
  onRowHeightResize,
  cellData = {},
  onCellChange
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

      const nodeType = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow/label');

      // check if the dropped element is valid
      if (typeof nodeType === 'undefined' || !nodeType) {
        return;
      }

      // project was renamed to screenToFlowPosition in v11.3
      // fallback for older versions or if instance not ready
      if (!reactFlowInstance) return;

      let position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Constraint for table mode: only allow drops in Column A
      if (type === 'table') {
        const columnAWidth = columnWidths[0] || 400;
        const minX = ROW_LABEL_WIDTH + 10;
        const maxX = ROW_LABEL_WIDTH + columnAWidth - 50;
        position.x = Math.max(minX, Math.min(position.x, maxX));
      }
      
      const newNode = {
        id: getId(),
        type: nodeType,
        position,
        data: { label: label || `${nodeType} node` },
        style: nodeType === 'decision' ? { width: 150, height: 150 } : undefined,
      };

      setNodes((nds) => {
        return nds.concat(newNode);
      });

      if (wrappedOnNodesChange) {
        wrappedOnNodesChange([{ type: 'add', item: newNode }]);
      }
    },
    [reactFlowInstance, setNodes, wrappedOnNodesChange, saveHistory, isReadOnly, type, columnWidths]
  );

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Navigate to linked sheet if it exists and project is published
    if (isPublished && node.data.linkedSheetId && node.data.linkedSheetId !== 'none') {
      handleSwitchSheet(node.data.linkedSheetId);
      return;
    }

    if (isReadOnly) {
      const isResponsible = node.data.responsibility?.includes(currentUser?.id);
      const isSupport = node.data.support?.includes(currentUser?.id);
      if (isResponsible || isSupport) {
        setSelectedNode(node);
      } else {
        // Fallback: Show read-only info dialog for users who aren't assigned
        openNodeDialog(node.data);
      }
      return;
    }
    setSelectedNode(node);
  }, [isReadOnly, currentUser, openNodeDialog, handleSwitchSheet]);

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

  const totalWidth = useMemo(() => columnWidths.reduce((a, b) => a + b, 0), [columnWidths]);
  const fullHeight = useMemo(() => ROWS_COUNT * rowHeight + HEADER_HEIGHT, [rowHeight]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Role-based protection for position changes
      if (isReadOnly) {
        const draggingPositions = changes.filter(c => c.type === 'position' && (c as any).dragging);
        if (draggingPositions.length > 0) {
          const allAllowed = draggingPositions.every(change => {
            const node = nodes.find(n => n.id === (change as any).id);
            if (!node) return false;
            // Allow if explicitly assigned as responsible or support, or if they have editor/owner rights (handled by isReadOnly)
            const isResponsible = node.data?.responsibility?.includes(currentUser?.id);
            const isSupport = node.data?.support?.includes(currentUser?.id);
            return isResponsible || isSupport;
          });
          if (!allAllowed) {
            toast.error("You don't have permission to move these nodes");
            return;
          }
        }
        
        // Block deletions in read-only mode entirely
        if (changes.some(c => c.type === 'remove')) {
          toast.error("You don't have permission to delete nodes");
          return;
        }
      }

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
      const movedNodeIds = nextChanges
        .filter(c => c.type === 'position' && (c as any).dragging)
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

      // Handle table mode constraints (nodes only in Column A)
      if (type === 'table') {
        const columnAWidth = columnWidths[0];
        
        // Check for position changes
        const positionChanges = nextChanges.filter(c => c.type === 'position' && (c as any).position);
        if (positionChanges.length > 0) {
          nextChanges = nextChanges.map(change => {
            if (change.type === 'position' && (change as any).position) {
              const pos = (change as any).position;
              // Restrict horizontally to Column A (plus some padding)
              const minX = ROW_LABEL_WIDTH + 10;
              const maxX = ROW_LABEL_WIDTH + columnAWidth - 50; // Allow it near the edge
              
              if (pos.x < minX || pos.x > maxX) {
                return {
                  ...change,
                  position: {
                    ...pos,
                    x: Math.max(minX, Math.min(pos.x, maxX))
                  }
                };
              }
            }
            return change;
          });
        }
      }

      if (wrappedOnNodesChange) {
        wrappedOnNodesChange(nextChanges);
      } else {
        onNodesChange(nextChanges);
      }
    },
    [nodes, onNodesChange, wrappedOnNodesChange, calculateHelperLines, setHelperLines, setEdges, isReadOnly, currentUser?.id]
  );

  return (
    <div className={cn("grow h-full relative flex flex-col", isPublished ? "bg-white" : "bg-gray-50")} ref={reactFlowWrapper}>
      <div className="grow relative">
            <ReactFlow
                key={isReadOnly ? 'readonly' : 'editable'}
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
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
                elementsSelectable={true}
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
            >

                <Controls />
                {!isReadOnly && <Background color="#aaa" gap={16} />}
                <MiniMap />
                <HelperLines horizontal={helperLines.horizontal} vertical={helperLines.vertical} />
                {type === 'table' && (
                  <>
                    <RowControls rowHeight={rowHeight} onRowHeightResize={onRowHeightResize!} />
                    <TableHeader columnWidths={columnWidths} onColumnResize={onColumnResize!} />
                    <TableGrid 
                      columnWidths={columnWidths} 
                      rowHeight={rowHeight} 
                      cellData={cellData}
                      onCellChange={onCellChange!}
                      isReadOnly={isReadOnly}
                    />
                    <TableScrollbars 
                      totalWidth={totalWidth + ROW_LABEL_WIDTH}
                      totalHeight={fullHeight}
                    />
                  </>
                )}
            </ReactFlow>
      </div>

      {selectedNode && selectedNode.type !== 'swimLane' && (
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
  const { role, loading, orgId } = useUserRole();
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
  const [loadingMessage, setLoadingMessage] = useState('');
  const [versions, setVersions] = useState<{ name: string; created_at: string; sheets: ProcessSheet[]; comments?: string }[]>([]);

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

  // Table State
  const [columnWidths, setColumnWidths] = useState<number[]>(DEFAULT_COLUMN_WIDTHS);
  const [rowHeight, setRowHeight] = useState<number>(DEFAULT_ROW_HEIGHT);
  const [cellData, setCellData] = useState<Record<string, string>>({});
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isUnlockConfirmOpen, setIsUnlockConfirmOpen] = useState(false);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [isSaveDraftConfirmOpen, setIsSaveDraftConfirmOpen] = useState(false);
  const [isSaveVersionDialogOpen, setIsSaveVersionDialogOpen] = useState(false);
  const [isDeleteSheetDialogOpen, setIsDeleteSheetDialogOpen] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState<string | null>(null);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionComment, setNewVersionComment] = useState('');
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingSheetName, setEditingSheetName] = useState('');

  const [edgeStyle, setEdgeStyle] = useState<'blue-solid' | 'red-dashed'>('blue-solid');
  const [saveScope, setSaveScope] = useState<'all' | 'current'>('all');

  const pathname = usePathname();
  const isProjectCanvas = pathname.includes('/dashboard/projects/editor');

  // Load Version Confirmation
  const [isLoadVersionConfirmOpen, setIsLoadVersionConfirmOpen] = useState(false);
  const [pendingVersionName, setPendingVersionName] = useState<string | null>(null);
  const [pendingVersionComment, setPendingVersionComment] = useState<string | null>(null);

  // Dialog State moved from ProcessCanvas
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<any>(null);

  const openNodeDialog = useCallback((data: any) => {
    const isResponsible = data.responsibility?.includes(user?.id);
    const isSupport = data.support?.includes(user?.id);
    const isOwner = projectOwnerId === user?.id;
    const isEditor = projectPermission === 'editor';
    const isPublished = projectStatus === 'published';
    
    // Allow if user is owner/editor, OR if they are an assigned user on this node
    // OR if the project is published, we allow everyone to see the info dialog
    if (projectPermission === 'viewer' && !isResponsible && !isSupport && !isPublished && !isOwner && !isEditor) return;
    
    setDialogData(data);
    setDialogOpen(true);
  }, [projectPermission, user?.id, projectStatus, projectOwnerId]);

  const handleAddSheet = (type: 'flow' | 'table' = 'flow') => {
    const newSheetId = `sheet_${Date.now()}`;
    const newSheet: ProcessSheet = {
      id: newSheetId,
      name: type === 'table' ? 'Work Sheet' : 'New Sheet',
      nodes: type === 'table' ? [] : [],
      edges: [],
      type: type,
      cellData: type === 'table' ? {} : undefined,
      columnWidths: type === 'table' ? DEFAULT_COLUMN_WIDTHS : undefined,
      rowHeight: type === 'table' ? DEFAULT_ROW_HEIGHT : undefined,
    };
    
    // Save current sheet's state before switching
    const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
    let updatedSheets = [...sheets, newSheet];
    if (currentSheetIndex !== -1) {
        updatedSheets[currentSheetIndex] = { 
            ...updatedSheets[currentSheetIndex], 
            nodes, 
            edges,
            cellData,
            columnWidths,
            rowHeight
        };
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
          updatedSheets[currentSheetIndex] = { 
            ...updatedSheets[currentSheetIndex], 
            nodes, 
            edges,
            cellData,
            columnWidths,
            rowHeight
          };
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
            setCellData(newSheet.cellData || {});
            setColumnWidths(newSheet.columnWidths || DEFAULT_COLUMN_WIDTHS);
            setRowHeight(newSheet.rowHeight || DEFAULT_ROW_HEIGHT);
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
      setCellData(newSheet.cellData || {});
      setColumnWidths(newSheet.columnWidths || DEFAULT_COLUMN_WIDTHS);
      setRowHeight(newSheet.rowHeight || DEFAULT_ROW_HEIGHT);
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

  const [isLockedByStatus, setIsLockedByStatus] = useState(false);

  const isReadOnly = useMemo(() => {
    if (loading) return true;
    
    // Authorization check
    const isAuthorized = role === 'admin' || role === 'editor' || projectPermission === 'owner' || projectPermission === 'editor';
    if (!isAuthorized) return true;

    // If authorized but project is published/locked
    if (isProjectCanvas && projectStatus === 'published' && isLockedByStatus) {
      return true;
    }
    
    return false;
  }, [role, projectPermission, loading, projectStatus, isProjectCanvas, isLockedByStatus]);

  const canEdit = useMemo(() => {
    const isAuthorized = role === 'admin' || role === 'editor' || projectPermission === 'owner' || projectPermission === 'editor';
    return isAuthorized;
  }, [role, projectPermission]);

  const canUnlock = useMemo(() => {
    if (loading) return false;
    return role === 'admin' || role === 'editor' || projectPermission === 'owner' || projectPermission === 'editor';
  }, [role, projectPermission, loading]);

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
    // If project is locked (read-only), we shouldn't have unsaved changes
    if (isReadOnly) {
      setHasUnsavedChanges(false);
      return;
    }

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
      currentSheets[currentSheetIndex] = { 
        ...currentSheets[currentSheetIndex], 
        nodes: nodesRef.current, 
        edges: edgesRef.current,
        cellData,
        columnWidths,
        rowHeight
      };
    }

    // Compare with original
    const currentStateStr = JSON.stringify({
      sheets: currentSheets.map(s => ({
        id: s.id,
        name: s.name,
        nodes: s.nodes,
        edges: s.edges,
        type: s.type,
        cellData: s.cellData,
        columnWidths: s.columnWidths,
        rowHeight: s.rowHeight
      })),
      projectName
    });
    const originalStateStr = JSON.stringify(originalSavedState);

    setHasUnsavedChanges(currentStateStr !== originalStateStr);
  }, [originalSavedState, sheets, activeSheetId, cellData, columnWidths, rowHeight, projectName, projectId, processId]);

  // Save history on every change
  const saveHistory = useCallback(() => {
    if (isReadOnly) return;
    takeSnapshot(nodesRef.current, edgesRef.current);
  }, [isReadOnly, takeSnapshot]);

  // Update check for changes when relevant state changes
  useEffect(() => {
    checkForChanges();
  }, [cellData, columnWidths, rowHeight, projectName, sheets, activeSheetId, isReadOnly, checkForChanges]);

  const triggerJiraForSheets = useCallback(async (sheetsToProcess: ProcessSheet[]) => {
    let createdCount = 0;
    const newSheets = JSON.parse(JSON.stringify(sheetsToProcess));
    const jiraPromises: Promise<boolean>[] = [];

    for (const sheet of newSheets) {
      // 1. Scan for Connections (Detailed Activity-WP tickets)
      for (const edge of sheet.edges) {
        const sourceNode = sheet.nodes.find((n: any) => n.id === edge.source);
        const targetNode = sheet.nodes.find((n: any) => n.id === edge.target);

        if (sourceNode && targetNode) {
          const isActivitySource = sourceNode.type === 'activity';
          const isWPSource = sourceNode.type === 'workProduct';
          const isActivityTarget = targetNode.type === 'activity';
          const isWPTarget = targetNode.type === 'workProduct';

          if ((isActivitySource && isWPTarget) || (isWPSource && isActivityTarget)) {
            const activityNode = isActivitySource ? sourceNode : targetNode;
            const wpNode = isWPSource ? sourceNode : targetNode;

            if (!activityNode.data.jira_issue_id) {
              jiraPromises.push((async () => {
                try {
                  const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/jira/connection-trigger`, {
                      activity_data: activityNode.data,
                      work_product_data: wpNode.data,
                      metadata: {
                          project_name: projectName,
                          project_id: projectId || processId,
                          project_type: 'freestyle'
                      }
                  });

                  if (response && response.data && response.data.jira_key) {
                    activityNode.data.jira_issue_id = response.data.jira_key;
                    return true;
                  }
                } catch (e) {
                  console.error("Failed to trigger Jira for connection", e);
                }
                return false;
              })());
            }
          }
        }
      }

      // 2. Scan for Standalone Assigned Activities (Standard Task tickets)
      for (const node of sheet.nodes) {
        if (node.type === 'activity' || node.type === 'process') {
          const data = node.data || {};
          const responsibility = data.responsibility || [];
          const support = data.support || [];

          // If assigned but no Jira ticket yet (and not already captured by connection logic above potentially, 
          // though connection logic also updates the same node.data.jira_issue_id)
          if ((responsibility.length > 0 || support.length > 0) && !data.jira_issue_id) {
            jiraPromises.push((async () => {
              try {
                // We use connection-trigger even for standalone, just passing empty WP data
                const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/jira/connection-trigger`, {
                    activity_data: data,
                    work_product_data: { label: "Standalone Task" },
                    metadata: {
                        project_name: projectName,
                        project_id: projectId || processId,
                        project_type: 'freestyle'
                    }
                });

                if (response && response.data && response.data.jira_key) {
                  node.data.jira_issue_id = response.data.jira_key;
                  return true;
                }
              } catch (e) {
                console.error("Failed to trigger Jira for standalone node", node.id, e);
              }
              return false;
            })());
          }
        }
      }
    }
    
    if (jiraPromises.length > 0) {
      const results = await Promise.all(jiraPromises);
      createdCount = results.filter(Boolean).length;
    }
    
    return { updatedSheets: newSheets, createdCount };
  }, [projectName, projectId, processId]);

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
  }, [edgeStyle, setEdges, saveHistory, checkForChanges]);

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
        setIsLockedByStatus(data.status === 'published');
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
          setCellData(normalizedSheets[0].cellData || {});
          setColumnWidths(normalizedSheets[0].columnWidths || DEFAULT_COLUMN_WIDTHS);
          setRowHeight(normalizedSheets[0].rowHeight || DEFAULT_ROW_HEIGHT);
          
          // Store original saved state
          setOriginalSavedState({
            sheets: normalizedSheets.map((s: ProcessSheet) => ({
              id: s.id,
              name: s.name,
              nodes: JSON.parse(JSON.stringify(s.nodes)),
              edges: JSON.parse(JSON.stringify(s.edges)),
              type: s.type,
              cellData: s.cellData,
              columnWidths: s.columnWidths,
              rowHeight: s.rowHeight
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
          setCellData(normalizedSheets[0].cellData || {});
          setColumnWidths(normalizedSheets[0].columnWidths || DEFAULT_COLUMN_WIDTHS);
          setRowHeight(normalizedSheets[0].rowHeight || DEFAULT_ROW_HEIGHT);
          
          // Store original saved state
          setOriginalSavedState({
            sheets: normalizedSheets.map((s: ProcessSheet) => ({
              id: s.id,
              name: s.name,
              nodes: JSON.parse(JSON.stringify(s.nodes)),
              edges: JSON.parse(JSON.stringify(s.edges)),
              type: s.type,
              cellData: s.cellData,
              columnWidths: s.columnWidths,
              rowHeight: s.rowHeight
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

  // Fetch users for NodeInfoDialog and selection - fetch if we have any process or project
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.id || (!projectId && !processId)) return;
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
  }, [user?.id, projectId, processId]);

  // Handlers for ProcessSidebar
  const handleSaveVersion = useCallback(async () => {
    const targetProcessId = processId || projectProcessId;
    if (!targetProcessId || isReadOnly) return;
    
    setNewVersionName(`Version ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    setNewVersionComment('');
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
        updatedSheets[currentSheetIndex] = { 
          ...updatedSheets[currentSheetIndex], 
          nodes, 
          edges,
          cellData,
          columnWidths,
          rowHeight
        };
        setSheets(updatedSheets);
      }

      const sheetsToSave = saveScope === 'all' 
        ? updatedSheets 
        : [updatedSheets[currentSheetIndex]].filter(Boolean);

      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/processes/${targetProcessId}/versions`, {
        name: newVersionName.trim(),
        comments: newVersionComment.trim(),
        sheets: sheetsToSave.map(s => ({
          id: s.id,
          name: s.name,
          nodes: s.nodes, // Includes all nodes (including lanes) with their current positions
          edges: s.edges,
          type: s.type,
          cellData: s.cellData,
          columnWidths: s.columnWidths,
          rowHeight: s.rowHeight
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
      setNewVersionComment('');
      toast.success('Version saved successfully!');
    } catch (error) {
      console.error('Failed to save version:', error);
      toast.error('Failed to save version');
    } finally {
      setIsSaving(false);
    }
  }, [processId, projectProcessId, isReadOnly, sheets, activeSheetId, nodes, edges, newVersionName, newVersionComment, user?.id]);

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
            setCellData(data.sheets[0].cellData || {});
            setColumnWidths(data.sheets[0].columnWidths || DEFAULT_COLUMN_WIDTHS);
            setRowHeight(data.sheets[0].rowHeight || DEFAULT_ROW_HEIGHT);
          }
        } else if (data.nodes) {
          // Legacy format
          setSheets([{ id: 'parent', name: 'Parent Process', nodes: data.nodes || [], edges: data.edges || [] }]);
          setActiveSheetId('parent');
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
          setCellData({});
          setColumnWidths(DEFAULT_COLUMN_WIDTHS);
          setRowHeight(DEFAULT_ROW_HEIGHT);
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
    setIsSaving(true);
    setLoadingMessage('Exporting Project JSON...');
    // Save current sheet state before downloading (including all nodes with their positions)
    const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
    let updatedSheets = [...sheets];
    if (currentSheetIndex !== -1) {
      updatedSheets[currentSheetIndex] = { 
        ...updatedSheets[currentSheetIndex], 
        nodes, 
        edges,
        cellData,
        columnWidths,
        rowHeight
      };
      setSheets(updatedSheets);
    }

    // Slightly delayed to show the animation
    setTimeout(() => {
      const dataStr = JSON.stringify({ sheets: updatedSheets }, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName || 'process'}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setIsSaving(false);
      toast.success('Project exported successfully!');
    }, 1500);
  }, [sheets, activeSheetId, nodes, edges, cellData, columnWidths, rowHeight, projectName]);

  const handleLoadVersion = useCallback((versionName: string) => {
    if (isReadOnly) return;
    setPendingVersionName(versionName);
    const version = versions.find(v => v.name === versionName);
    setPendingVersionComment(version?.comments || null);
    setIsLoadVersionConfirmOpen(true);
  }, [isReadOnly, versions]);

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
        setCellData(firstVersionSheet.cellData || {});
        setColumnWidths(firstVersionSheet.columnWidths || DEFAULT_COLUMN_WIDTHS);
        setRowHeight(firstVersionSheet.rowHeight || DEFAULT_ROW_HEIGHT);
        
        setSheets(prev => {
          const updated = prev.map(s => 
            s.id === activeSheetId 
              ? { 
                  ...s, 
                  name: firstVersionSheet.name, 
                  nodes: firstVersionSheet.nodes, 
                  edges: firstVersionSheet.edges,
                  type: firstVersionSheet.type,
                  cellData: firstVersionSheet.cellData,
                  columnWidths: firstVersionSheet.columnWidths,
                  rowHeight: firstVersionSheet.rowHeight
                }
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
          setCellData(normalizedSheets[0].cellData || {});
          setColumnWidths(normalizedSheets[0].columnWidths || DEFAULT_COLUMN_WIDTHS);
          setRowHeight(normalizedSheets[0].rowHeight || DEFAULT_ROW_HEIGHT);
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

  const handleSaveProject = useCallback(async (status?: string, vName?: string, vComments?: string) => {
    // Allow saving if status is provided (e.g. for unlocking) even if isReadOnly is true
    // If status is provided, we ignore hasUnsavedChanges check
    if (!projectId || (isReadOnly && !status)) return;
    if (!status && !hasUnsavedChanges) return;
    
    setIsSaving(true);
    setLoadingMessage(status === 'published' ? 'Publishing Project...' : 'Saving Changes...');
    try {
      // Save current sheet state before saving (including all nodes with their positions)
      const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
      let updatedSheets = [...sheets];
      if (currentSheetIndex !== -1) {
        updatedSheets[currentSheetIndex] = { 
          ...updatedSheets[currentSheetIndex], 
          nodes, 
          edges,
          cellData,
          columnWidths,
          rowHeight
        };
      }

      // Trigger Jira tickets if publishing
      let finalSheets = updatedSheets;
      let jiraCreatedCount = 0;
      if (status === 'published') {
        const { updatedSheets: sheetsWithJira, createdCount } = await triggerJiraForSheets(updatedSheets);
        finalSheets = sheetsWithJira;
        jiraCreatedCount = createdCount;
        // Small delay to ensure rocket animation is visible
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const sheetsToSave = finalSheets.map(s => ({
        id: s.id,
        name: s.name,
        nodes: s.nodes, 
        edges: s.edges,
        type: s.type,
        cellData: s.cellData,
        columnWidths: s.columnWidths,
        rowHeight: s.rowHeight
      }));

      const payload: any = {
        name: projectName,
        sheets: sheetsToSave,
        version_name: vName || versionName,
        version_comments: vComments,
        type: 'freestyle'
      };

      if (status) {
        payload.status = status;
      }

      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`, payload);
      
      // Sync local state after successful save
      setHasUnsavedChanges(false); 
      setOriginalSavedState({
        sheets: sheetsToSave.map(s => ({
          id: s.id,
          name: s.name,
          nodes: JSON.parse(JSON.stringify(s.nodes)),
          edges: JSON.parse(JSON.stringify(s.edges)),
          type: s.type,
          cellData: s.cellData,
          columnWidths: s.columnWidths,
          rowHeight: s.rowHeight
        })),
        projectName
      });

      if (status === 'published') {
        setSheets(finalSheets);
        const activeSheetAfterJira = finalSheets.find((s: any) => s.id === activeSheetId);
        if (activeSheetAfterJira) {
          setNodes(activeSheetAfterJira.nodes);
        }
        
        if (jiraCreatedCount > 0) {
          toast.success(`Created ${jiraCreatedCount} Jira tickets during publish`);
        }
        setProjectStatus(status);
        setIsLockedByStatus(true);
      } else if (status) {
        if (projectPermission === 'owner' || projectPermission === 'editor' || role === 'admin' || role === 'editor') {
          setProjectStatus(status);
          setIsLockedByStatus(false);
        }
        setSheets(updatedSheets);
      } else {
        setSheets(updatedSheets);
      }

      toast.success(status === 'published' ? 'Project published successfully!' : 'Project saved successfully!');
    } catch (error) {
      console.error('Failed to save project:', error);
      toast.error('Failed to save project');
    } finally {
      setIsSaving(false);
    }
  }, [projectId, isReadOnly, hasUnsavedChanges, sheets, activeSheetId, nodes, edges, cellData, columnWidths, rowHeight, projectName, versionName, triggerJiraForSheets, setHasUnsavedChanges]);

  const handleSaveProcess = useCallback(async (status: 'draft' | 'published', vName?: string, vComments?: string) => {
    if (!user?.id) return;
    
    // Check permission - either global admin/editor or project owner/editor
    const isAuthorized = role === 'admin' || role === 'editor' || projectPermission === 'owner' || projectPermission === 'editor';
    if (!isAuthorized) {
        toast.error("You don't have permission to save this process");
        return;
    }
    
    setIsSaving(true);
    setLoadingMessage(status === 'published' ? 'Publishing Process...' : 'Saving Draft...');
    try {
      // Save current sheet state before saving
      const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
      let updatedSheets = [...sheets];
      if (currentSheetIndex !== -1) {
        updatedSheets[currentSheetIndex] = { 
          ...updatedSheets[currentSheetIndex], 
          nodes, 
          edges,
          cellData,
          columnWidths,
          rowHeight
        };
      }

      // Trigger Jira tickets if publishing
      let finalSheets = updatedSheets;
      let jiraCreatedCount = 0;
      if (status === 'published') {
        const { updatedSheets: sheetsWithJira, createdCount } = await triggerJiraForSheets(updatedSheets);
        finalSheets = sheetsWithJira;
        jiraCreatedCount = createdCount;
        // Small delay to ensure rocket animation is visible
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const payload = {
        user_id: user.id,
        org_id: orgId,
        name: projectName,
        sheets: finalSheets.map(s => ({
          id: s.id,
          name: s.name,
          nodes: s.nodes,
          edges: s.edges,
          type: s.type,
          cellData: s.cellData,
          columnWidths: s.columnWidths,
          rowHeight: s.rowHeight
        })),
        status: status,
        type: 'freestyle',
        version_name: vName,
        version_comments: vComments
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
      
      setHasUnsavedChanges(false);

      // Update original saved state
      const sheetsToSave = finalSheets.map(s => ({
        id: s.id,
        name: s.name,
        nodes: JSON.parse(JSON.stringify(s.nodes)),
        edges: JSON.parse(JSON.stringify(s.edges)),
        type: s.type,
        cellData: s.cellData,
        columnWidths: s.columnWidths,
        rowHeight: s.rowHeight
      }));

      setOriginalSavedState({
        sheets: sheetsToSave,
        projectName
      });

      // Update local state and status immediately
      setSheets(finalSheets);
      if (status) setProjectStatus(status);
      toast.success(`Process ${status === 'draft' ? 'saved as draft' : 'published'} successfully!`);
    } catch (error) {
      console.error('Failed to save process:', error);
      toast.error('Failed to save process');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, isReadOnly, sheets, activeSheetId, nodes, edges, cellData, columnWidths, rowHeight, projectName, processId, router, triggerJiraForSheets, setHasUnsavedChanges]);

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
    setLoadingMessage('Generating PDF Report...');

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
      // Critical change: Pass 'isReadOnly' status instead of 'projectStatus === published'.
      // This ensures that authorized editors can interact with handles and resizers even if status is 'published'.
      isPublished={isReadOnly} 
    >
    <div className={cn("flex h-full flex-col", isReadOnly ? "bg-white" : "bg-gray-50")}>
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
              {projectStatus === 'published' && isLockedByStatus && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 flex items-center gap-1">
                  Published
                  <Lock className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {projectId && projectStatus === 'published' && isLockedByStatus && (projectPermission === 'owner' || projectPermission === 'editor' || role === 'admin' || role === 'editor') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUnlockConfirmOpen(true)}
              className="flex items-center gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 h-8"
            >
              <Unlock size={14} />
              Unlock to Edit
            </Button>
          )}
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
              {!isReadOnly && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsSaveDraftConfirmOpen(true)}
                    disabled={isSaving}
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button
                    onClick={() => setIsPublishDialogOpen(true)}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {projectStatus === 'published' ? 'Update & Publish' : 'Publish'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsSaveDraftConfirmOpen(true)}
                    disabled={isSaving}
                    className="border-blue-600 text-blue-600 hover:bg-blue-50 h-9 px-4"
                  >
                    {isSaving ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button
                    onClick={() => setIsPublishDialogOpen(true)}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 gap-2"
                  >
                    <Rocket size={18} />
                    {projectStatus === 'published' ? 'Update & Publish' : 'Publish'}
                  </Button>
                </>
              )}
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
          {(() => {
            const activeSheet = sheets.find(s => s.id === activeSheetId);
            return (
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
                type={activeSheet?.type || 'flow'}
                columnWidths={columnWidths}
                onColumnResize={(index, width) => {
                  setColumnWidths(prev => {
                    const next = [...prev];
                    next[index] = width;
                    return next;
                  });
                  checkForChanges();
                }}
                rowHeight={rowHeight}
                onRowHeightResize={(height) => {
                  setRowHeight(height);
                  checkForChanges();
                }}
                cellData={cellData}
                onCellChange={(id, value) => {
                  setCellData(prev => ({ ...prev, [id]: value }));
                  checkForChanges();
                }}
              />
            );
          })()}
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
              onDoubleClick={() => !isReadOnly && startEditingSheet(sheet)}
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
                  {sheet.type === 'table' ? (
                    <FileSpreadsheet className="w-3 h-3 mr-1 text-indigo-600" />
                  ) : (
                    sheet.id === 'parent' ? <Layout className="w-3 h-3 mr-1 text-blue-600" /> : <Layout className="w-3 h-3 mr-1 text-gray-600" />
                  )}
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
          {!isReadOnly && (
            <>
              <button
                onClick={() => handleAddSheet('flow')}
                className="p-1.5 rounded-md ml-2 text-gray-600 hover:bg-gray-200 flex items-center gap-1 text-xs font-semibold"
                title="Add Child Process"
              >
                <Plus className="w-3 h-3" />
                <span>Child Process</span>
              </button>
              <button
                onClick={() => handleAddSheet('table')}
                className="p-1.5 rounded-md ml-2 text-indigo-600 hover:bg-indigo-100 flex items-center gap-1 text-xs font-semibold bg-indigo-50"
                title="Add Work Sheet (Table Style)"
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>Work Sheet</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>

    <ProcessPublishDialog 
        isOpen={isPublishDialogOpen}
        onClose={() => setIsPublishDialogOpen(false)}
        currentName={projectName}
        isProjectCanvas={isProjectCanvas}
        onPublish={(name, vName, vComments) => {
            setProjectName(name);
            if (isProjectCanvas) {
                handleSaveProject('published', vName, vComments);
            } else {
                handleSaveProcess('published', vName, vComments);
            }
            setIsPublishDialogOpen(false);
        }}
    />

    <Dialog open={isUnlockConfirmOpen} onOpenChange={setIsUnlockConfirmOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock Project?</DialogTitle>
          <DialogDescription>
            Are you sure you want to unlock this project for editing? Any changes made will need to be re-published to be visible to viewers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsUnlockConfirmOpen(false)}>Cancel</Button>
          <Button onClick={async () => { 
            setIsLockedByStatus(false); 
            setIsUnlockConfirmOpen(false); 
            // Automatically save status change to backend
            if (projectId) {
              try {
                await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`, {
                   status: 'draft',
                   type: 'freestyle',
                   name: projectName,
                   sheets: sheets.map(s => ({
                     id: s.id,
                     name: s.name,
                     nodes: s.nodes,
                     edges: s.edges,
                     type: s.type,
                     cellData: s.cellData,
                     columnWidths: s.columnWidths,
                     rowHeight: s.rowHeight
                   }))
                });
                setProjectStatus('draft');
                toast.success('Project unlocked and saved as draft');
              } catch (error) {
                console.error('Failed to auto-save unlock status:', error);
                toast.error('Failed to sync unlock status with server');
              }
            }
          }}>Unlock</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isSaveDraftConfirmOpen} onOpenChange={setIsSaveDraftConfirmOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Draft?</DialogTitle>
          <DialogDescription>
            Are you sure you want to save these changes as a draft?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsSaveDraftConfirmOpen(false)}>Cancel</Button>
          <Button onClick={() => { 
            if (projectId) handleSaveProject('draft');
            else handleSaveProcess('draft');
            setIsSaveDraftConfirmOpen(false); 
          }}>Save Draft</Button>
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
            <Label htmlFor="versionComment" className="mb-2 block">Version Comments</Label>
            <Textarea
              id="versionComment"
              value={newVersionComment}
              onChange={(e) => setNewVersionComment(e.target.value)}
              placeholder="Explain what changed in this version..."
              rows={3}
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
          {pendingVersionComment && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md border text-sm">
              <div className="font-semibold text-gray-500 mb-1 uppercase text-[10px]">Version Comments</div>
              <p className="text-gray-700 italic">"{pendingVersionComment}"</p>
            </div>
          )}
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

    {/* Launching Loading Overlay */}
    {isSaving && (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md overflow-hidden">
        <div className="relative flex flex-col items-center">
          {/* Drifting Clouds */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden h-[400px] w-screen left-1/2 -translate-x-1/2">
            <Cloud className="absolute top-10 left-[-100px] text-blue-100 w-24 h-24 animate-cloud-drift opacity-60" />
            <Cloud className="absolute top-40 left-[-200px] text-gray-100 w-16 h-16 animate-cloud-drift [animation-delay:0.5s] opacity-40" />
            <Cloud className="absolute top-20 left-[-150px] text-blue-50 w-20 h-20 animate-cloud-drift [animation-delay:1.2s] opacity-50" />
            <Cloud className="absolute top-60 left-[-300px] text-gray-200 w-32 h-32 animate-cloud-drift [animation-delay:0.8s] opacity-30" />
          </div>

          {/* Rocket Container */}
          <div className="relative">
            <div className="animate-rocket-vibrate">
              <Rocket className="w-24 h-24 text-blue-600 rotate-[-45deg] drop-shadow-2xl" fill="currentColor" />
            </div>
            {/* Flame Effect */}
            <div className="absolute -bottom-6 -left-2 w-8 h-12 bg-gradient-to-t from-orange-600 via-yellow-400 to-transparent rounded-full blur-sm animate-rocket-flame rotate-[135deg]" />
            <div className="absolute -bottom-4 -left-0 w-4 h-8 bg-gradient-to-t from-red-600 via-orange-400 to-transparent rounded-full animate-rocket-flame [animation-delay:0.1s] rotate-[135deg]" />
          </div>

          {/* Status Text */}
          <div className="mt-12 text-center">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {loadingMessage || 'Processing...'}
            </h3>
            <p className="text-gray-500 mt-2 font-medium flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              Launching your updates to the workspace
            </p>
          </div>
        </div>
      </div>
    )}

    </ProcessProvider>
  );
}

