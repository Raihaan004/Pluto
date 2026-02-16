'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { 
  Plus, FileSpreadsheet, Layout, Undo, Redo, Trash2, Edit2, 
  Check, X, Users, ChevronRight, History, Download, 
  Settings, Save, Rocket, Loader2, Cloud, ArrowLeft, Table as TableIcon,
  Search, Filter, Rows, Columns, ExternalLink, Lock, Unlock
} from 'lucide-react';
import { 
  useReactTable, 
  getCoreRowModel, 
  flexRender, 
  createColumnHelper 
} from '@tanstack/react-table';
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
  useViewport,
  useReactFlow,
  NodeResizer,
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

// Import node types and edge types
import { nodeTypes } from '@/components/process/CustomNodes';
import EditableStepEdge from '@/components/process/EditableStepEdge';

const DEFAULT_COLUMN_WIDTHS = [400, 200, 200, 200, 200, 200, 200];
const DEFAULT_ROW_HEIGHT = 80;
const ROW_LABEL_WIDTH = 40;
const ROWS_COUNT = 50;
const HEADER_HEIGHT = 40;

const getColumnLabel = (index: number) => {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
};

const ProcessPublishDialog = ({ isOpen, onClose, onPublish, currentName }: { isOpen: boolean, onClose: () => void, onPublish: (name: string, vName: string, vComments: string) => void, currentName: string }) => {
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
                    <DialogTitle>Publish Process</DialogTitle>
                    <DialogDescription>
                        Set a name and version information for this publication.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="pName">Process Name</Label>
                        <Input 
                            id="pName" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            placeholder="Process Name" 
                        />
                    </div>
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
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onPublish(name, vName, vComments)}>Publish</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const RowControls = ({ rowHeight, onRowHeightResize }: { 
  rowHeight: number, 
  onRowHeightResize: (height: number) => void 
}) => {
  const { y, zoom } = useViewport();
  const resizingRef = useRef<{ startY: number, startHeight: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = { startY: e.pageY, startHeight: rowHeight };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { startY, startHeight } = resizingRef.current;
    const delta = (e.pageY - startY) / zoom;
    onRowHeightResize(Math.max(30, startHeight + delta));
  };

  const onMouseUp = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  const rows = Array.from({ length: ROWS_COUNT });

  return (
    <div 
      className="absolute top-0 left-0 z-[10] w-10 border-r-2 border-slate-400 bg-slate-100 select-none shadow-[2px_0_5px_rgba(0,0,0,0.1)] pointer-events-none"
      style={{ bottom: 0 }}
    >
      {/* Header Corner */}
      <div 
        className="border-b-2 border-slate-400 bg-slate-200 flex items-center justify-center overflow-hidden pointer-events-auto"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="w-0 h-0 border-l-[10px] border-l-transparent border-t-[10px] border-t-slate-400 border-r-[10px] border-r-transparent transform -rotate-45" />
      </div>

      <div 
        style={{ 
          transform: `translateY(${y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="pointer-events-none"
      >
        {rows.map((_, i) => (
          <div 
            key={`row-${i}`}
            style={{ 
              height: rowHeight, 
              width: ROW_LABEL_WIDTH
            }}
            className="relative flex items-center justify-center border-b-2 border-slate-400 bg-slate-50 hover:bg-slate-200 transition-colors pointer-events-auto"
          >
            <span className="text-[11px] font-bold text-slate-600 font-mono">{i + 1}</span>
            <div 
              className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-500 z-20"
              onMouseDown={onMouseDown}
              title="Drag to adjust all row heights"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const isURL = (str: string) => {
  if (!str) return false;
  const pattern = /^(https?:\/\/|www\.)[^\s\/$.?#].[^\s]*$/i;
  return pattern.test(str);
};

const TableGrid = ({ 
  columnWidths, 
  rowHeight,
  cellData = {},
  onCellChange,
  isReadOnly = false
}: { 
  columnWidths: number[], 
  rowHeight: number,
  cellData?: Record<string, string>,
  onCellChange?: (id: string, value: string) => void,
  isReadOnly?: boolean
}) => {
  const { x, y, zoom } = useViewport();
  const [focusedCell, setFocusedCell] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [currentCellId, setCurrentCellId] = useState<string | null>(null);
  const [links, setLinks] = useState<{ label: string, url: string }[]>([]);
  
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);

  // Parse links from cell data (format: JSON string array)
  const getCellLinks = useCallback((cellId: string) => {
    try {
      const data = cellData[cellId];
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      // Fallback for old plain text data
      const data = cellData[cellId];
      if (data && isURL(data)) return [{ label: 'Link', url: data }];
      return [];
    }
  }, [cellData]);

  const handleOpenLinkDialog = (cellId: string) => {
    if (isReadOnly) return;
    setCurrentCellId(cellId);
    setLinks(getCellLinks(cellId));
    setLinkDialogOpen(true);
  };

  const handleSaveLinks = () => {
    if (currentCellId && onCellChange) {
      onCellChange(currentCellId, JSON.stringify(links));
    }
    setLinkDialogOpen(false);
  };

  const addLink = () => {
    setLinks([...links, { label: '', url: '' }]);
  };

  const updateLink = (index: number, field: 'label' | 'url', value: string) => {
    const newLinks = [...links];
    newLinks[index][field] = value;
    setLinks(newLinks);
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const cells = useMemo(() => {
    const items = [];
    for (let i = 0; i < ROWS_COUNT; i++) {
      for (let j = 0; j < columnWidths.length; j++) {
        const colLeft = columnWidths.slice(0, j).reduce((a, b) => a + b, 0);
        items.push({
          id: `${getColumnLabel(j)}${i + 1}`,
          colIndex: j,
          top: i * rowHeight + HEADER_HEIGHT,
          left: colLeft + ROW_LABEL_WIDTH, // Add label width here so it matches RF coords
          width: columnWidths[j],
          height: rowHeight
        });
      }
    }
    return items;
  }, [columnWidths, rowHeight]);

  return (
    <div 
      className="absolute inset-0 pointer-events-none select-none overflow-hidden"
      style={{
        zIndex: 5,
      }}
    >
      <div 
        style={{ 
          transform: `translate(${x}px, ${y}px) scale(${zoom})`, // Removed ROW_LABEL_WIDTH shift
          transformOrigin: '0 0',
          width: totalWidth + ROW_LABEL_WIDTH,
          height: ROWS_COUNT * rowHeight + HEADER_HEIGHT
        }}
        className="pointer-events-none"
      >
        {/* Bold Grid and Identity */}
        {cells.map((cell) => (
          <div 
            key={cell.id}
            className={cn(
               "absolute border-r-2 border-b-2 border-slate-400 flex flex-col items-center justify-center overflow-hidden transition-colors pointer-events-none",
               cell.colIndex === 0 ? "bg-slate-50/5" : "bg-white/5 hover:bg-white/10"
            )}
            style={{ 
              top: cell.top, 
              left: cell.left, 
              width: cell.width, 
              height: cell.height 
            }}
          >
            {/* Identity Label (Always visible, background) */}
            <span className={cn(
              "absolute inset-0 flex items-center justify-center text-[28px] font-black text-slate-300 font-mono uppercase tracking-widest select-none transition-opacity pointer-events-none",
              (cellData[cell.id] || cell.colIndex === 0) ? "opacity-0" : "opacity-40"
            )}>
              {cell.id}
            </span>

            {/* Editable Content (Only for non-activity columns) */}
            {cell.colIndex > 0 && (
              <div className="w-full h-full relative flex items-center justify-center">
                {(cell.colIndex >= 4 && cell.colIndex <= 6) ? (
                  /* Resource Columns: Click to manage links */
                  <div 
                    className={cn(
                      "w-full h-full p-2 flex flex-wrap gap-1 content-start overflow-y-auto cursor-pointer pointer-events-auto",
                      isReadOnly ? "" : "hover:bg-blue-50/50"
                    )}
                    onClick={() => handleOpenLinkDialog(cell.id)}
                  >
                    {getCellLinks(cell.id).length > 0 ? (
                      getCellLinks(cell.id).map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url.startsWith('www.') ? `https://${link.url}` : link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-[11px] font-bold hover:bg-blue-600 hover:text-white transition-all pointer-events-auto border border-blue-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {link.label || 'Link'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium italic p-1">
                        {isReadOnly ? "No links" : "Click to add links..."}
                      </span>
                    )}
                  </div>
                ) : (
                  /* Standard Columns: Use Textarea */
                  <textarea
                    className={cn(
                      "w-full h-full bg-transparent p-3 text-sm font-semibold text-slate-900 focus:outline-none resize-none z-10 nopan nodrag",
                      isReadOnly ? "cursor-default" : "cursor-text focus:bg-white/95 focus:ring-2 focus:ring-blue-500/50 pointer-events-auto"
                    )}
                    value={cellData[cell.id] || ''}
                    readOnly={isReadOnly}
                    onChange={(e) => !isReadOnly && onCellChange?.(cell.id, e.target.value)}
                    onFocus={(e) => {
                      setFocusedCell(cell.id);
                      if (!isReadOnly) e.currentTarget.parentElement?.parentElement?.classList.add('bg-white/90');
                    }}
                    onBlur={(e) => {
                      setFocusedCell(null);
                      if (!isReadOnly && !e.currentTarget.value) e.currentTarget.parentElement?.parentElement?.classList.remove('bg-white/90');
                    }}
                    title={isReadOnly ? "" : "Click to edit cell"}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-blue-600" />
              Manage Resource Links
            </DialogTitle>
            <DialogDescription>
              Add multiple links and labels for this cell. These will be displayed as clickable buttons in the grid.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4 max-h-[400px] overflow-y-auto pr-2">
            {links.map((link, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 group relative">
                <div className="flex-1 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Link Label</Label>
                    <Input 
                      placeholder="e.g. Design Doc, Checklist PDF..." 
                      value={link.label}
                      onChange={(e) => updateLink(idx, 'label', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">URL</Label>
                    <Input 
                      placeholder="https://..." 
                      value={link.url}
                      onChange={(e) => updateLink(idx, 'url', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeLink(idx)}
                  className="mt-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {links.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                <p className="text-sm text-slate-500">No links added yet. Click the button below to start.</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-4 border-t pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={addLink}
              className="border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Link
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveLinks} className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TableHeader = ({ columnWidths, onColumnResize }: { 
  columnWidths: number[], 
  onColumnResize: (index: number, width: number) => void 
}) => {
  const { x, zoom } = useViewport();
  const resizingRef = useRef<{ index: number, startX: number, startWidth: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    resizingRef.current = { index, startX: e.pageX, startWidth: columnWidths[index] };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { index, startX, startWidth } = resizingRef.current;
    const delta = (e.pageX - startX) / zoom;
    onColumnResize(index, Math.max(50, startWidth + delta));
  };

  const onMouseUp = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  const labels = ['Activity / Step', 'Responsibility', 'Support', 'Expected Output', 'Templates', 'Checklists', 'Guidelines'];

  return (
    <div 
      className="absolute top-0 left-0 z-[10] border-b-2 border-slate-400 bg-white shadow-sm select-none pointer-events-none"
      style={{ height: HEADER_HEIGHT }}
    >
      <div 
        className="flex h-full items-center pointer-events-none"
        style={{ 
          transform: `translateX(${x}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: 'max-content'
        }}
      >
        {/* Spacer for Row labels column */}
        <div style={{ width: ROW_LABEL_WIDTH }} className="h-full bg-slate-200 border-r-2 border-slate-400 pointer-events-auto" />
        
        {columnWidths.map((w, i) => (
          <div 
            key={`header-${i}`} 
            style={{ width: w }} 
            className="relative flex items-center px-4 h-full border-r-2 border-slate-400 bg-slate-100/80 pointer-events-auto group"
          >
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest truncate">
              {labels[i] || ''}
            </span>
            <div 
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-20"
              onMouseDown={(e) => onMouseDown(e, i)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const TableScrollbars = ({ 
  totalWidth, 
  totalHeight,
}: {
  totalWidth: number;
  totalHeight: number;
}) => {
  const { x, y, zoom } = useViewport();
  const { setViewport } = useReactFlow();
  const scrollRefV = useRef<HTMLDivElement>(null);
  const scrollRefH = useRef<HTMLDivElement>(null);
  const internalUpdate = useRef(false);

  useEffect(() => {
    if (internalUpdate.current) {
        internalUpdate.current = false;
        return;
    }
    
    if (scrollRefV.current) {
        scrollRefV.current.scrollTop = -y;
    }
    if (scrollRefH.current) {
        scrollRefH.current.scrollLeft = -x;
    }
  }, [x, y, zoom]);

  const onScrollV = (e: React.UIEvent<HTMLDivElement>) => {
    if (Math.abs(y + e.currentTarget.scrollTop) > 1) {
        internalUpdate.current = true;
        setViewport({ x, y: -e.currentTarget.scrollTop, zoom }, { duration: 0 });
    }
  };

  const onScrollH = (e: React.UIEvent<HTMLDivElement>) => {
    if (Math.abs(x + e.currentTarget.scrollLeft) > 1) {
        internalUpdate.current = true;
        setViewport({ x: -e.currentTarget.scrollLeft, y, zoom }, { duration: 0 });
    }
  };

  return (
    <>
      {/* Vertical Scrollbar */}
      <div 
        className="absolute right-0 top-10 bottom-0 w-[14px] bg-slate-50/50 z-[30] overflow-y-scroll overflow-x-hidden border-l border-slate-300 pointer-events-auto"
        ref={scrollRefV}
        onScroll={onScrollV}
      >
        <div style={{ height: totalHeight + 200, width: 1 }} />
      </div>

      {/* Horizontal Scrollbar */}
      <div 
        className="absolute bottom-0 left-10 right-[14px] h-[14px] bg-slate-50/50 z-[30] overflow-x-scroll overflow-y-hidden border-t border-slate-300 pointer-events-auto"
        ref={scrollRefH}
        onScroll={onScrollH}
      >
        <div style={{ width: totalWidth + 200, height: 1 }} /> 
      </div>
    </>
  );
};

const initialNodes: Node[] = [
  {
    id: 'node_start',
    type: 'activity',
    data: { label: 'Start Process' },
    position: { x: ROW_LABEL_WIDTH + 150, y: 60 },
  }
];

const getId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const localNodeTypes = {
  ...nodeTypes
};

// EdgeTypes - constant object
const edgeTypes = {
  'editable-step': EditableStepEdge,
};

interface ProcessSheet {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
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
  columnWidths: number[];
  onColumnResize: (index: number, width: number) => void;
  rowHeight: number;
  onRowHeightResize: (height: number) => void;
  cellData: Record<string, string>;
  onCellChange: (id: string, value: string) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

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
  columnWidths,
  onColumnResize,
  rowHeight,
  onRowHeightResize,
  cellData,
  onCellChange,
  selectedNodeId,
  onSelectNode
}: ProcessCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, _setSelectedNode] = useState<Node | null>(null);

  // Sync internal selectedNode with external selectedNodeId
  useEffect(() => {
    if (selectedNodeId) {
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node) _setSelectedNode(node);
    } else {
      _setSelectedNode(null);
    }
  }, [selectedNodeId, nodes]);

  const setSelectedNode = useCallback((node: Node | null) => {
    _setSelectedNode(node);
    onSelectNode(node?.id || null);
  }, [onSelectNode]);

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

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      const newNode = {
        id: `node_${Date.now()}`,
        type,
        position,
        data: { 
          label: label || `${type} node`,
          isReadOnly: isReadOnly
        }
      };

      setNodes((nds) => {
        return nds.concat(newNode);
      });

      if (wrappedOnNodesChange) {
        wrappedOnNodesChange([{ type: 'add', item: newNode }]);
      }
    },
    [reactFlowInstance, setNodes, wrappedOnNodesChange, saveHistory, isReadOnly]
  );

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.id.startsWith('h-')) return; // Header nodes

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
        openNodeDialog(node.data);
      }
      return;
    }
    setSelectedNode(node);
  }, [isReadOnly, currentUser, openNodeDialog, handleSwitchSheet, isPublished, setSelectedNode]);

  const onNodeDragStop = useCallback(() => {
    if (isReadOnly) return;
    checkForChanges();
  }, [isReadOnly, checkForChanges]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

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
      // Prevent header nodes from moving
      const headerChanges = changes.filter(c => (c as any).id?.startsWith('h-'));
      if (headerChanges.length > 0) return;

      if (isReadOnly) {
        const draggingPositions = changes.filter(c => c.type === 'position' && (c as any).dragging);
        if (draggingPositions.length > 0) {
          const allAllowed = draggingPositions.every(change => {
            const node = nodes.find(n => n.id === (change as any).id);
            if (!node) return false;
            const isResponsible = node.data?.responsibility?.includes(currentUser?.id);
            const isSupport = node.data?.support?.includes(currentUser?.id);
            return isResponsible || isSupport;
          });
          if (!allAllowed) return;
        }
      }

      let nextChanges = changes;

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
    [nodes, onNodesChange, wrappedOnNodesChange, calculateHelperLines, setHelperLines, setEdges, isReadOnly, currentUser?.id]
  );

  const totalWidth = useMemo(() => columnWidths.reduce((a, b) => a + b, 0), [columnWidths]);
  const fullHeight = useMemo(() => ROWS_COUNT * rowHeight + HEADER_HEIGHT, [rowHeight]);

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
                translateExtent={[
                  [0, 0], 
                  [totalWidth + ROW_LABEL_WIDTH + 200, fullHeight + 200]
                ]}
                nodeExtent={[
                  [ROW_LABEL_WIDTH, HEADER_HEIGHT],
                  [totalWidth + ROW_LABEL_WIDTH, fullHeight]
                ]}
                onNodeClick={(event, node) => {
                  if (node.id.startsWith('h-')) return;
                  onSelectNode(node.id);
                }}
                onNodeDoubleClick={onNodeDoubleClick}
                onNodeDragStart={onNodeDragStart}
                onNodeDragStop={() => {
                  setHelperLines({});
                  onNodeDragStop();
                }}
                onPaneClick={() => {
                  onPaneClick();
                  onSelectNode(null);
                }}
                onEdgeUpdate={onEdgeUpdate}
                nodeTypes={localNodeTypes}
                edgeTypes={edgeTypes}
                nodesDraggable={!isReadOnly}
                nodesConnectable={!isReadOnly}
                elementsSelectable={true}
                snapToGrid={true}
                snapGrid={[10, 10]}
                minZoom={0.1}
                maxZoom={2}
                zoomOnScroll={false} 
                zoomOnPinch={true}
                zoomOnDoubleClick={false} 
                panOnScroll={true}
                panOnScrollMode={PanOnScrollMode.Vertical}
                selectionOnDrag={false}
                panOnDrag={true} 
                defaultEdgeOptions={{ 
                  type: 'editable-step',
                  markerEnd: {
                      type: MarkerType.ArrowClosed,
                      color: edgeStyle === 'red-dashed' ? '#ef4444' : '#3b82f6',
                  },
                  style: edgeStyle === 'red-dashed' 
                    ? { stroke: '#ef4444', strokeDasharray: '5,5', strokeWidth: 2.5 } 
                    : { stroke: '#3b82f6', strokeWidth: 2.5 }
                }}
                connectionLineType={ConnectionLineType.Step}
                connectionLineStyle={edgeStyle === 'red-dashed' 
                  ? { stroke: '#ef4444', strokeDasharray: '5,5', strokeWidth: 2 } 
                  : { stroke: '#3b82f6', strokeWidth: 2 }}
                deleteKeyCode={isReadOnly ? null : ['Backspace', 'Delete']}
            >
                <Controls />
                <MiniMap />
                <HelperLines horizontal={helperLines.horizontal} vertical={helperLines.vertical} />
            </ReactFlow>

            {/* Sub-layers for the spreadsheet structure - Rendered outside ReactFlow but inside relative container to ensure they stay on TOP for interaction */}
            <RowControls rowHeight={rowHeight} onRowHeightResize={onRowHeightResize} />
            <TableHeader columnWidths={columnWidths} onColumnResize={onColumnResize} />
            <TableGrid 
              columnWidths={columnWidths} 
              rowHeight={rowHeight} 
              cellData={cellData}
              onCellChange={onCellChange}
              isReadOnly={isReadOnly}
            />
            <TableScrollbars 
              totalWidth={totalWidth + ROW_LABEL_WIDTH}
              totalHeight={fullHeight}
            />
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

export default function TableProcessPage() {
  const { role, loading, orgId } = useUserRole();
  const { user } = useUser();
  const { hasUnsavedChanges } = useNavigationState();
  const { setHasUnsavedChanges, setSaveAction } = useNavigationDispatch();
  const router = useRouter();

  useEffect(() => {
    return () => {
      setHasUnsavedChanges(false);
      setSaveAction(null);
    };
  }, [setHasUnsavedChanges, setSaveAction]);

  const searchParams = useSearchParams();
  const processId = searchParams.get('id');
  const projectId = searchParams.get('projectId');

  const [sheets, setSheets] = useState<ProcessSheet[]>([
    { id: 'parent', name: 'Table Process', nodes: initialNodes, edges: [] }
  ]);
  const [activeSheetId, setActiveSheetId] = useState('parent');
  const [isSaving, setIsSaving] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [versions, setVersions] = useState<{ name: string; created_at: string; sheets: ProcessSheet[]; comments?: string }[]>([]);

  const [nodes, setNodes, onNodesChange] = useCustomNodeStates(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projectPermission, setProjectPermission] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null);
  const [projectProcessId, setProjectProcessId] = useState<number | null>(null);
  const [rfInstance, setRfInstance] = useState<any>(null);
  const [projectName, setProjectName] = useState('Table Style Process');
  const [projectStatus, setProjectStatus] = useState<string>('draft');
  const [versionName, setVersionName] = useState<string | null>(null);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSaveVersionDialogOpen, setIsSaveVersionDialogOpen] = useState(false);
  const [isDeleteSheetDialogOpen, setIsDeleteSheetDialogOpen] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState<string | null>(null);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionComment, setNewVersionComment] = useState('');
  const [edgeStyle, setEdgeStyle] = useState<'blue-solid' | 'red-dashed'>('blue-solid');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const pathname = usePathname();
  const isProjectCanvas = pathname.includes('/dashboard/projects/editor');

  const [isLoadVersionConfirmOpen, setIsLoadVersionConfirmOpen] = useState(false);
  const [pendingVersionName, setPendingVersionName] = useState<string | null>(null);
  const [pendingVersionComment, setPendingVersionComment] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<any>(null);

  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const [cellData, setCellData] = useState<Record<string, string>>({});

  const { takeSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo();
  const saveHistory = useCallback(() => takeSnapshot(nodes, edges), [takeSnapshot, nodes, edges]);

  const [originalSavedState, setOriginalSavedState] = useState<{sheets: ProcessSheet[], projectName: string} | null>(null);

  const isReadOnly = useMemo(() => {
    if (loading) return true;
    
    // Authorization check - ALWAYS allow editing if authorized, even if published
    const isAuthorized = role === 'admin' || role === 'editor' || projectPermission === 'owner' || projectPermission === 'editor';
    return !isAuthorized;
  }, [role, projectPermission, loading]);

  const canEdit = useMemo(() => !isReadOnly, [isReadOnly]);

  const canUnlock = useMemo(() => {
    if (loading) return false;
    // Anyone who would have edit rights if it were a draft can unlock it
    return role === 'admin' || role === 'editor' || projectPermission === 'owner' || projectPermission === 'editor';
  }, [role, projectPermission, loading]);

  const checkForChanges = useCallback(() => {
    if (!originalSavedState) return;
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
    
    const hasChanges = JSON.stringify(updatedSheets) !== JSON.stringify(originalSavedState.sheets) || projectName !== originalSavedState.projectName;
    setHasUnsavedChanges(hasChanges);
  }, [originalSavedState, sheets, activeSheetId, nodes, edges, cellData, columnWidths, rowHeight, projectName, setHasUnsavedChanges]);

  useEffect(() => {
    checkForChanges();
  }, [nodes, edges, cellData, columnWidths, rowHeight, projectName, checkForChanges]);

  const handleColumnResize = useCallback((index: number, newWidth: number) => {
    setColumnWidths(prev => {
      const next = [...prev];
      next[index] = newWidth;
      return next;
    });
    checkForChanges();
  }, [checkForChanges]);

  const handleRowHeightResize = useCallback((newHeight: number) => {
    setRowHeight(newHeight);
    checkForChanges();
  }, [checkForChanges]);

  const handleCellChange = useCallback((id: string, value: string) => {
    setCellData(prev => ({ ...prev, [id]: value }));
    checkForChanges();
  }, [checkForChanges]);

  // Sync edges when edgeStyle changes
  useEffect(() => {
    setEdges((eds) => eds.map(edge => {
      const style = edgeStyle === 'red-dashed' 
        ? { stroke: '#ef4444', strokeDasharray: '5,5', strokeWidth: 2.5 } 
        : { stroke: '#3b82f6', strokeWidth: 2.5 };
      
      return {
        ...edge,
        style,
        markerEnd: {
          ...(typeof edge.markerEnd === 'object' ? edge.markerEnd : {}),
          type: MarkerType.ArrowClosed,
          color: edgeStyle === 'red-dashed' ? '#ef4444' : '#3b82f6',
        }
      };
    }));
  }, [edgeStyle, setEdges]);

  const openNodeDialog = useCallback((data: any) => {
    const isResponsible = data.responsibility?.includes(user?.id);
    const isSupport = data.support?.includes(user?.id);
    const isOwner = projectOwnerId === user?.id;
    const isEditor = projectPermission === 'editor';
    const isPublished = projectStatus === 'published';
    
    if (projectPermission === 'viewer' && !isResponsible && !isSupport && !isPublished && !isOwner && !isEditor) return;
    
    setDialogData(data);
    setDialogOpen(true);
  }, [projectPermission, user?.id, projectStatus, projectOwnerId]);

  const handleAddSheet = () => {
    const newSheetId = `sheet_${Date.now()}`;
    const newSheet: ProcessSheet = {
      id: newSheetId,
      name: 'New Table',
      nodes: initialNodes,
      edges: [],
      cellData: {},
    };
    
    const currentSheetIndex = sheets.findIndex(s => s.id === activeSheetId);
    let updatedSheets = [...sheets, newSheet];
    if (currentSheetIndex !== -1) {
        updatedSheets[currentSheetIndex] = { ...updatedSheets[currentSheetIndex], nodes, edges, cellData };
    }
    
    setSheets(updatedSheets);
    handleSwitchSheet(newSheetId, updatedSheets);
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
          const newSheet = updatedSheets.find(s => s.id === sheetId);
          if (newSheet) {
            setActiveSheetId(sheetId);
            setNodes(newSheet.nodes || []);
            setEdges(newSheet.edges || []);
            setCellData(newSheet.cellData || {});
            setColumnWidths(newSheet.columnWidths || DEFAULT_COLUMN_WIDTHS);
            setRowHeight(newSheet.rowHeight || DEFAULT_ROW_HEIGHT);
          }
          return;
      }
    }

    setActiveSheetId(sheetId);
    const newSheet = sheetsToUse.find(s => s.id === sheetId);
    if (newSheet) {
      setNodes(newSheet.nodes || []);
      setEdges(newSheet.edges || []);
      setCellData(newSheet.cellData || {});
      setColumnWidths(newSheet.columnWidths || DEFAULT_COLUMN_WIDTHS);
      setRowHeight(newSheet.rowHeight || DEFAULT_ROW_HEIGHT);
    }
  };

  const loadData = useCallback(async () => {
    try {
      if (projectId) {
        const projectResponse = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`);
        const data = projectResponse.data;
        setProjectName(data.name || 'Untitled Table Project');
        setProjectStatus(data.status || 'draft');
        setProjectOwnerId(data.user_id || null);
        setProjectProcessId(data.process_id || null);
        
        if (data.user_id === user?.id) setProjectPermission('owner');
        else setProjectPermission(data.collaborators?.find((c: any) => c.user_id === user?.id)?.role || 'viewer');

        if (data.sheets && data.sheets.length > 0) {
          setSheets(data.sheets);
          setActiveSheetId(data.sheets[0].id);
          setNodes(data.sheets[0].nodes || []);
          setEdges(data.sheets[0].edges || []);
          setCellData(data.sheets[0].cellData || {});
          setColumnWidths(data.sheets[0].columnWidths || DEFAULT_COLUMN_WIDTHS);
          setRowHeight(data.sheets[0].rowHeight || DEFAULT_ROW_HEIGHT);
          setOriginalSavedState({ sheets: data.sheets, projectName: data.name });
          setHasUnsavedChanges(false);
        }
      } else if (processId) {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/process/${processId}`);
        const processData = response.data;
        setProjectName(processData.name || 'Untitled Table Process');
        setProjectStatus(processData.status || 'draft');
        setProjectOwnerId(processData.user_id || null);
        
        if (processData.user_id === user?.id) setProjectPermission('owner');
        else setProjectPermission('editor');

        if (processData.sheets && processData.sheets.length > 0) {
          setSheets(processData.sheets);
          setActiveSheetId(processData.sheets[0].id);
          setNodes(processData.sheets[0].nodes || []);
          setEdges(processData.sheets[0].edges || []);
          setCellData(processData.sheets[0].cellData || {});
          setColumnWidths(processData.sheets[0].columnWidths || DEFAULT_COLUMN_WIDTHS);
          setRowHeight(processData.sheets[0].rowHeight || DEFAULT_ROW_HEIGHT);
          setOriginalSavedState({ sheets: processData.sheets, projectName: processData.name });
          setHasUnsavedChanges(false);
        }
        if (processData.versions) setVersions(processData.versions);
      } else {
        // New process initialization for change tracking
        setOriginalSavedState({
          sheets: [{ id: 'parent', name: 'Table Process', nodes: initialNodes, edges: [], cellData: {} }],
          projectName: 'Table Style Process'
        });
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  }, [processId, projectId, user, setHasUnsavedChanges, setNodes, setEdges]);

  useEffect(() => {
    if (user) loadData();
  }, [processId, projectId, user?.id, loadData]);

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

  const wrappedOnNodesChange = useCallback((changes: NodeChange[]) => {
    const isMeaningful = changes.some((c: any) => 
      c.type === 'remove' || 
      c.type === 'add' || 
      c.type === 'reset' ||
      c.type === 'dimensions'
    );

    if (isMeaningful) {
      saveHistory();
    }
    
    onNodesChange(changes);
    
    if (isMeaningful) {
      checkForChanges();
    }
  }, [onNodesChange, saveHistory, checkForChanges]);

  const wrappedOnEdgesChange = useCallback((changes: any) => {
    const isMeaningful = changes.some((c: any) => 
      c.type === 'remove' || c.type === 'add' || c.type === 'reset'
    );

    if (isMeaningful) {
      saveHistory();
    }

    onEdgesChange(changes);

    if (isMeaningful) {
      checkForChanges();
    }
  }, [onEdgesChange, saveHistory, checkForChanges]);

  const onConnect = useCallback((params: Connection | Edge) => {
    saveHistory();
    const style = edgeStyle === 'red-dashed' 
      ? { stroke: '#ef4444', strokeDasharray: '5,5', strokeWidth: 2 } 
      : { stroke: '#3b82f6', strokeWidth: 2 };

    setEdges((eds) => addEdge({ 
      ...params, 
      type: 'editable-step', 
      style,
      data: { styleType: edgeStyle }
    }, eds));
    checkForChanges();
  }, [setEdges, saveHistory, checkForChanges, edgeStyle]);

  const onNodeDragStart = useCallback((event: React.MouseEvent, node: Node) => {
    if (isReadOnly) return;
    saveHistory();
  }, [isReadOnly, saveHistory]);

  const handleUndo = useCallback(() => undo(nodes, edges, setNodes, setEdges), [undo, nodes, edges, setNodes, setEdges]);
  const handleRedo = useCallback(() => redo(nodes, edges, setNodes, setEdges), [redo, nodes, edges, setNodes, setEdges]);

  const triggerJiraForSheets = useCallback(async (sheetsToProcess: ProcessSheet[]) => {
    let createdCount = 0;
    const newSheets = JSON.parse(JSON.stringify(sheetsToProcess));
    const jiraPromises: Promise<boolean>[] = [];

    // Table Style Process Jira trigger: 
    // We scan nodes in the 'Activity / Step' column that have responsibility or support defined.
    for (const sheet of newSheets) {
      if (!sheet.nodes) continue;
      
      for (const node of sheet.nodes) {
        if (node.type === 'activity' || node.type === 'process') {
          const data = node.data || {};
          const responsibility = data.responsibility || [];
          const support = data.support || [];

          // If assigned but no Jira ticket yet
          if ((responsibility.length > 0 || support.length > 0) && !data.jira_issue_id) {
            jiraPromises.push((async () => {
              try {
                // We use connection-trigger with a simplified payload since we don't have work products in table view usually
                // but we can pass the node itself as activity_data
                const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/jira/connection-trigger`, {
                    activity_data: data,
                    work_product_data: { label: "Table Step Detail" }, // Placeholder for WP data
                    metadata: {
                        project_name: projectName,
                        project_id: projectId || processId,
                        project_type: 'table'
                    }
                });

                if (response && response.data && response.data.jira_key) {
                  node.data.jira_issue_id = response.data.jira_key;
                  return true;
                }
              } catch (e) {
                console.error("Failed to trigger Jira for node", node.id, e);
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
  }, [projectId, processId, projectName]);

  const handleSaveProject = useCallback(async (status?: string, vName?: string, vComments?: string): Promise<boolean> => {
    if (!user?.id) {
        toast.error("User not authenticated");
        return false;
    }
    if (!projectId) return false;
    
    const isAuthorized = role === 'admin' || role === 'editor' || projectPermission === 'owner' || projectPermission === 'editor';
    if (!isAuthorized && !status) {
        toast.error("You don't have permission to save this project");
        return false;
    }
    if (!hasUnsavedChanges && !status) return false;

    setIsSaving(true);
    setLoadingMessage(status === 'published' ? 'Publishing...' : 'Saving...');
    try {
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

      let finalSheets = updatedSheets;
      let jiraCreatedCount = 0;
      if (status === 'published') {
        const { updatedSheets: jiraSheets, createdCount } = await triggerJiraForSheets(updatedSheets);
        finalSheets = jiraSheets;
        jiraCreatedCount = createdCount;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const payload: any = { 
        name: projectName, 
        sheets: finalSheets, 
        status: status || projectStatus,
        type: 'table',
        version_name: vName,
        version_comments: vComments
      };
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`, payload);
      
      setSheets(finalSheets);
      const activeSheetAfterJira = finalSheets.find(s => s.id === activeSheetId);
      if (activeSheetAfterJira) {
        setNodes(activeSheetAfterJira.nodes);
        setEdges(activeSheetAfterJira.edges);
      }

      setOriginalSavedState({ sheets: finalSheets, projectName });
      setHasUnsavedChanges(false);
      if (status) setProjectStatus(status);
      
      if (jiraCreatedCount > 0) {
        toast.success(`Saved successfully! Created ${jiraCreatedCount} Jira tickets.`);
      } else {
        toast.success('Saved successfully!');
      }
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Save failed');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [projectId, role, hasUnsavedChanges, sheets, activeSheetId, nodes, edges, cellData, columnWidths, rowHeight, projectName, projectStatus, triggerJiraForSheets, setHasUnsavedChanges, user?.id]);

  const handleSaveProcess = useCallback(async (status: 'draft' | 'published', vName?: string, vComments?: string): Promise<boolean> => {
    if (!user?.id) {
        toast.error("User not authenticated");
        return false;
    }
    
    // Check permission - either global admin/editor or project owner/editor
    const isAuthorized = role === 'admin' || role === 'editor' || projectPermission === 'owner' || projectPermission === 'editor';
    if (!isAuthorized) {
        toast.error("You don't have permission to save this process");
        return false;
    }
    
    setIsSaving(true);
    setLoadingMessage(status === 'published' ? 'Publishing...' : 'Saving...');
    try {
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

      let finalSheets = updatedSheets;
      let jiraCreatedCount = 0;
      // Removed Jira triggering for Process Templates - only needed for instanced Projects
      // But keep the cosmetic delay to match the "Publishing" experience of Freestyle editor
      if (status === 'published') {
         // const { updatedSheets: jiraSheets, createdCount } = await triggerJiraForSheets(updatedSheets);
         // finalSheets = jiraSheets;
         // jiraCreatedCount = createdCount;
         await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const payload = { 
        user_id: user.id, 
        name: projectName, 
        sheets: finalSheets, 
        status,
        type: 'table',
        org_id: orgId,
        version_name: vName,
        version_comments: vComments
      };
      if (processId) {
        await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/processes/${processId}`, payload, {
          headers: { "X-Clerk-User-Id": user?.id }
        });
      } else {
        const resp = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/processes`, payload);
        if (resp.data.data?.[0]) {
            const newId = resp.data.data[0].id;
            router.push(`/dashboard/process/table?id=${newId}`);
        }
      }

      setSheets(finalSheets);
      const activeSheetAfterJira = finalSheets.find(s => s.id === activeSheetId);
      if (activeSheetAfterJira) {
        setNodes(activeSheetAfterJira.nodes);
        setEdges(activeSheetAfterJira.edges);
      }

      setOriginalSavedState({ sheets: finalSheets, projectName });
      setHasUnsavedChanges(false);
      setProjectStatus(status);
      setIsUnlocked(false); // Relock after any save
      
      if (jiraCreatedCount > 0) {
        toast.success(`Process saved! Created ${jiraCreatedCount} Jira tickets.`);
      } else {
        toast.success(status === 'published' ? 'Process published!' : 'Process saved as draft!');
      }
      return true;
    } catch (error) {
      console.error('Process save failed:', error);
      toast.error('Process save failed');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, role, sheets, activeSheetId, nodes, edges, cellData, columnWidths, rowHeight, projectName, processId, router, triggerJiraForSheets, setHasUnsavedChanges]);

  useEffect(() => {
    const saveWrapper = async (): Promise<boolean> => {
      if (isProjectCanvas) return await handleSaveProject('draft');
      return await handleSaveProcess('draft');
    };
    setSaveAction(saveWrapper);
  }, [isProjectCanvas, handleSaveProject, handleSaveProcess, setSaveAction]);

  const handleDownload = useCallback(() => {
    const dataStr = JSON.stringify({ sheets }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'table_process'}.json`;
    link.click();
  }, [sheets, projectName]);

  const handleAddLane = useCallback(() => {
    if (isReadOnly) return;
    const laneCount = nodes.filter(n => n.type === 'swimLane').length;
    const newLane = {
      id: `lane-${Date.now()}`,
      type: 'swimLane' as const,
      data: { label: `Lane ${laneCount + 1}` },
      position: { x: laneCount * 310, y: -50 },
      style: { width: 300, height: 600 },
      zIndex: -1,
    };
    setNodes((nds) => [...nds, newLane]);
    wrappedOnNodesChange([{ type: 'add', item: newLane }]);
  }, [isReadOnly, nodes, setNodes, wrappedOnNodesChange]);

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
    setLoadingMessage('Saving Version...');
    try {
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

      const payload = { 
        process_id: targetProcessId, 
        name: newVersionName, 
        sheets: updatedSheets,
        comments: newVersionComment
      };
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/process-versions`, payload);
      
      const versionsResp = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/process/${targetProcessId}/versions`);
      setVersions(versionsResp.data);

      setIsSaveVersionDialogOpen(false);
      toast.success('Version saved');
    } catch (error) {
      console.error('Failed to save version:', error);
      toast.error('Failed to save version');
    } finally {
      setIsSaving(false);
    }
  }, [processId, projectProcessId, isReadOnly, newVersionName, newVersionComment, sheets, activeSheetId, nodes, edges, cellData, columnWidths, rowHeight]);

  const handleLoadFile = useCallback((file: File) => {
    if (isReadOnly) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        if (content.sheets) {
          setSheets(content.sheets);
          if (content.sheets.length > 0) {
            setActiveSheetId(content.sheets[0].id);
            setNodes(content.sheets[0].nodes || []);
            setEdges(content.sheets[0].edges || []);
          }
        } else if (content.nodes && content.edges) {
          setNodes(content.nodes);
          setEdges(content.edges);
        }
        setHasUnsavedChanges(true);
        toast.success('File loaded');
      } catch (err) {
        toast.error('Invalid file');
      }
    };
    reader.readAsText(file);
  }, [isReadOnly, setNodes, setEdges, setHasUnsavedChanges]);

  const handleLoadVersion = useCallback((versionName: string) => {
    if (isReadOnly) return;
    setPendingVersionName(versionName);
    const version = versions.find(v => v.name === versionName);
    setPendingVersionComment(version?.comments || null);
    setIsLoadVersionConfirmOpen(true);
  }, [isReadOnly, versions]);

  const confirmLoadVersion = useCallback(() => {
    if (!pendingVersionName) return;
    const version = versions.find(v => v.name === pendingVersionName);
    if (version && version.sheets) {
      setSheets(version.sheets);
      if (version.sheets.length > 0) {
        setActiveSheetId(version.sheets[0].id);
        setNodes(version.sheets[0].nodes || []);
        setEdges(version.sheets[0].edges || []);
      }
      setVersionName(pendingVersionName);
      setHasUnsavedChanges(true);
      toast.success('Version loaded!');
    }
    setIsLoadVersionConfirmOpen(false);
  }, [versions, pendingVersionName, setHasUnsavedChanges, setNodes, setEdges]);

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
      <div className="flex items-center justify-between border-b p-3 bg-white">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/process')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <TableIcon className="h-4 w-4 text-indigo-600" />
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="text-lg font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-100 rounded px-1 min-w-[200px]"
              disabled={isReadOnly}
            />
            {projectStatus === 'published' && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                Published
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleUndo} disabled={!canUndo || isReadOnly} className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"><Undo size={18} /></button>
          <button onClick={handleRedo} disabled={!canRedo || isReadOnly} className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"><Redo size={18} /></button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <Button variant="outline" onClick={handleDownload} className="h-9 gap-2"><Download size={18} /> Export</Button>
          
          {!isReadOnly && (
            <>
              <Button 
                onClick={() => isProjectCanvas ? handleSaveProject('draft') : handleSaveProcess('draft')}
                disabled={isSaving || !hasUnsavedChanges}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50 h-9"
              >
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button 
                onClick={() => setIsPublishDialogOpen(true)}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white h-9 gap-2"
              >
                <Rocket size={18} />
                {projectStatus === 'published' ? 'Update & Publish' : 'Publish'}
              </Button>
            </>
          )}
        </div>
      </div>

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
          <div className="flex grow overflow-hidden">
            {/* Full Width Flowchart */}
            <div className="grow relative h-full">
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
                isPublished={isReadOnly} // Match provider context logic for consistent interactions
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
                columnWidths={columnWidths}
                onColumnResize={handleColumnResize}
                rowHeight={rowHeight}
                onRowHeightResize={handleRowHeightResize}
                cellData={cellData}
                onCellChange={handleCellChange}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
              />
            </div>
          </div>
        </ReactFlowProvider>
      </div>

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
            >
              <FileSpreadsheet className="w-3 h-3 mr-1" />
              <span>{sheet.name}</span>
            </div>
          ))}
          <button onClick={handleAddSheet} disabled={isReadOnly} className="p-1.5 rounded-full ml-2 hover:bg-gray-200"><Plus className="w-4 h-4" /></button>
        </div>
      </div>
    </div>

    <ProcessPublishDialog 
        isOpen={isPublishDialogOpen}
        onClose={() => setIsPublishDialogOpen(false)}
        currentName={projectName}
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

    <Dialog open={isSaveVersionDialogOpen} onOpenChange={setIsSaveVersionDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Version</DialogTitle>
          <DialogDescription>Save the current state as a new version.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label>Version Name</Label>
            <Input value={newVersionName} onChange={e => setNewVersionName(e.target.value)} />
          </div>
          <div>
            <Label>Comments</Label>
            <Textarea value={newVersionComment} onChange={e => setNewVersionComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsSaveVersionDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmSaveVersion} disabled={isSaving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isLoadVersionConfirmOpen} onOpenChange={setIsLoadVersionConfirmOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Load Version</DialogTitle>
          <DialogDescription>Are you sure you want to load <strong>{pendingVersionName}</strong>? Unsaved changes will be lost.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsLoadVersionConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmLoadVersion}>Load</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isDeleteSheetDialogOpen} onOpenChange={setIsDeleteSheetDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Table</DialogTitle>
          <DialogDescription>Delete this child table?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDeleteSheetDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteSheet} className="bg-red-600 text-white">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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
