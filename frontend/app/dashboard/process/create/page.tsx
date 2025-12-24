'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Connection,
  Edge,
  Node,
  MarkerType,
  updateEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ProcessSidebar } from '@/components/process/ProcessSidebar';
import { nodeTypes } from '@/components/process/CustomNodes';
import EditableStepEdge from '@/components/process/EditableStepEdge';
import { PropertiesPanel } from '@/components/process/PropertiesPanel';
import { useUserRole } from '@/context/UserRoleContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, FileSpreadsheet, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import { ProcessProvider } from '@/context/ProcessContext';
import { NodeInfoDialog } from '@/components/process/NodeInfoDialog';
import { Trash2, Edit2, Check } from 'lucide-react';

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
  lanes: { id: string; name: string }[];
  setLanes: React.Dispatch<React.SetStateAction<{ id: string; name: string }[]>>;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  users: any[];
}

const LANE_WIDTH = 300;

const ProcessCanvas = ({
  nodes,
  edges,
  lanes,
  setLanes,
  onNodesChange,
  onEdgesChange,
  onConnect,
  setNodes,
  setEdges,
  users
}: ProcessCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<any>(null);

  // Lane Editing State
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
  const [editingLaneName, setEditingLaneName] = useState('');

  const openNodeDialog = (data: any) => {
    setDialogData(data);
    setDialogOpen(true);
  };

  const handleRemoveLane = (laneId: string) => {
    if (confirm('Are you sure you want to delete this lane?')) {
      setLanes(lanes.filter(l => l.id !== laneId));
    }
  };

  const startEditingLane = (lane: { id: string, name: string }) => {
    setEditingLaneId(lane.id);
    setEditingLaneName(lane.name);
  };

  const saveLaneName = () => {
    if (editingLaneId) {
      setLanes(lanes.map(l => l.id === editingLaneId ? { ...l, name: editingLaneName } : l));
      setEditingLaneId(null);
    }
  };

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => setEdges((els) => updateEdge(oldEdge, newConnection, els)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

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

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleSaveProperties = (nodeId: string, newData: any) => {
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
      {/* Swimlane Headers */}
      <div className="flex border-b bg-white z-10 overflow-x-auto">
        <div className="flex">
            {lanes.map((lane, index) => (
            <div 
                key={lane.id} 
                className="group border-r flex items-center justify-between px-2 bg-gray-50"
                style={{ width: LANE_WIDTH, minWidth: LANE_WIDTH }}
            >
                {editingLaneId === lane.id ? (
                <div className="flex items-center gap-1 w-full">
                    <input 
                    value={editingLaneName}
                    onChange={(e) => setEditingLaneName(e.target.value)}
                    className="w-full text-sm p-1 border rounded"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveLaneName()}
                    />
                    <button onClick={saveLaneName} className="text-green-600"><Check size={14} /></button>
                </div>
                ) : (
                <>
                    <span className="font-medium text-sm truncate" title={lane.name}>{lane.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditingLane(lane)} className="text-gray-500 hover:text-blue-600"><Edit2 size={12} /></button>
                        <button onClick={() => handleRemoveLane(lane.id)} className="text-gray-500 hover:text-red-600"><Trash2 size={12} /></button>
                    </div>
                </>
                )}
            </div>
            ))}
        </div>
      </div>

      <div className="flex-grow relative">
        <ProcessProvider openNodeDialog={openNodeDialog}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeDoubleClick={onNodeDoubleClick}
                onPaneClick={onPaneClick}
                onEdgeUpdate={onEdgeUpdate}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ 
                type: 'editable-step',
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                },
                }}
                deleteKeyCode={['Backspace', 'Delete']}
                // fitView // Disable fitView to respect lane coordinates
            >
                {/* Render Lane Backgrounds */}
                <div className="absolute inset-0 pointer-events-none z-[-1] flex h-full" style={{ width: lanes.length * LANE_WIDTH }}>
                    {lanes.map((lane, index) => (
                        <div 
                            key={lane.id} 
                            className="border-r h-full bg-opacity-5"
                            style={{ 
                                width: LANE_WIDTH, 
                                left: index * LANE_WIDTH,
                                position: 'absolute',
                                height: '10000px', // Arbitrary large height
                                top: -5000, // Arbitrary large top offset
                                backgroundColor: index % 2 === 0 ? 'rgba(249, 250, 251, 0.5)' : 'white'
                            }} 
                        />
                    ))}
                </div>

                <Controls />
                <Background color="#aaa" gap={16} />
                <MiniMap />
            </ReactFlow>
        </ProcessProvider>
      </div>

      {selectedNode && (
        <PropertiesPanel 
            selectedNode={selectedNode} 
            onSave={handleSaveProperties} 
            onClose={() => setSelectedNode(null)} 
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

interface ProcessSheet {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  lanes?: { id: string; name: string }[];
}

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
  const [activeSheetId, setActiveSheetId] = useState('parent');
  const [isSaving, setIsSaving] = useState(false);
  const [versions, setVersions] = useState<{ name: string; created_at: string; sheets: ProcessSheet[] }[]>([]);

  // ReactFlow state for the ACTIVE sheet
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [lanes, setLanes] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
          headers: { 'X-Clerk-User-Id': user.id }
        });
        setUsers(response.data);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };
    fetchUsers();
  }, [user]);

  const handleAddLane = () => {
    const newLane = {
      id: `lane-${Date.now()}`,
      name: `Lane ${lanes.length + 1}`
    };
    setLanes([...lanes, newLane]);
  };

  useEffect(() => {
    const loadData = async () => {
      if (projectId) {
        // Load Project Data
        try {
          const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`);
          const projectData = response.data;
          if (projectData.sheets && projectData.sheets.length > 0) {
            setSheets(projectData.sheets);
            setActiveSheetId(projectData.sheets[0].id);
            setNodes(projectData.sheets[0].nodes || []);
            setEdges(projectData.sheets[0].edges || []);
            setLanes(projectData.sheets[0].lanes || []);
          }
        } catch (error) {
          console.error("Failed to load project:", error);
        }
      } else if (processId) {
        // Load Process Data
        try {
          const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/process/${processId}`);
          const processData = response.data;
          
          if (processData.sheets && processData.sheets.length > 0) {
              setSheets(processData.sheets);
              setActiveSheetId(processData.sheets[0].id);
              setNodes(processData.sheets[0].nodes || []);
              setEdges(processData.sheets[0].edges || []);
              setLanes(processData.sheets[0].lanes || []);
          }
          if (processData.versions) {
              setVersions(processData.versions);
          }
        } catch (error) {
          console.error("Failed to load process:", error);
        }
      }
    };
    
    loadData();
  }, [processId, projectId]);

  const handleSaveVersion = async () => {
    if (projectId) {
        alert("Versioning is not available for projects yet.");
        return;
    }
    if (!processId) {
        alert("Please save the process first before creating a version.");
        return;
    }
    const versionName = prompt("Enter version name (e.g., v1.0):");
    if (!versionName) return;

    // Merge current active state into sheets
    const currentSheets = sheets.map(sheet => {
      if (sheet.id === activeSheetId) {
        return { ...sheet, nodes, edges, lanes };
      }
      return sheet;
    });

    try {
        await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/processes/${processId}/versions`, {
            name: versionName,
            sheets: currentSheets
        });
        alert(`Version "${versionName}" saved successfully with ${currentSheets.length} sheets (Parent + ${currentSheets.length - 1} Children).`);
        // Refresh versions
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/process/${processId}`);
        setVersions(response.data.versions || []);
    } catch (e) {
        console.error(e);
        alert("Failed to save version");
    }
  };

  const handleLoadFile = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result as string;
              const data = JSON.parse(content);
              if (Array.isArray(data)) {
                  setSheets(data);
                  if (data.length > 0) {
                      setActiveSheetId(data[0].id);
                      setNodes(data[0].nodes);
                      setEdges(data[0].edges);
                      setLanes(data[0].lanes || []);
                  }
              } else if (data.sheets) {
                  setSheets(data.sheets);
                  if (data.sheets.length > 0) {
                      setActiveSheetId(data.sheets[0].id);
                      setNodes(data.sheets[0].nodes);
                      setEdges(data.sheets[0].edges);
                      setLanes(data.sheets[0].lanes || []);
                  }
              }
          } catch (err) {
              alert("Invalid JSON file");
          }
      };
      reader.readAsText(file);
  };

  const handleDownload = () => {
      const currentSheets = sheets.map(sheet => {
        if (sheet.id === activeSheetId) {
          return { ...sheet, nodes, edges, lanes };
        }
        return sheet;
      });
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentSheets));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", "process_package.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleLoadVersion = (versionName: string) => {
      const version = versions.find(v => v.name === versionName);
      if (version) {
          if (confirm("This will overwrite your current workspace. Continue?")) {
              setSheets(version.sheets);
              if (version.sheets.length > 0) {
                  setActiveSheetId(version.sheets[0].id);
                  setNodes(version.sheets[0].nodes);
                  setEdges(version.sheets[0].edges);
                  setLanes(version.sheets[0].lanes || []);
              }
          }
      }
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Sync active sheet state to sheets array when switching or saving
  // We need to be careful not to overwrite with stale state
  
  const handleSwitchSheet = (newSheetId: string) => {
    if (newSheetId === activeSheetId) return;

    // 1. Save current state to the old sheet
    setSheets(prevSheets => prevSheets.map(sheet => {
      if (sheet.id === activeSheetId) {
        return { ...sheet, nodes, edges, lanes };
      }
      return sheet;
    }));

    // 2. Load new state
    const newSheet = sheets.find(s => s.id === newSheetId);
    if (newSheet) {
      setNodes(newSheet.nodes);
      setEdges(newSheet.edges);
      setLanes(newSheet.lanes || []);
      setActiveSheetId(newSheetId);
    }
  };

  const handleAddSheet = () => {
    // Save current state first
    setSheets(prevSheets => prevSheets.map(sheet => {
      if (sheet.id === activeSheetId) {
        return { ...sheet, nodes, edges, lanes };
      }
      return sheet;
    }));

    const newId = `child-${Date.now()}`;
    const newSheet: ProcessSheet = {
      id: newId,
      name: `Child Process ${sheets.length}`,
      nodes: [],
      edges: [],
      lanes: []
    };

    setSheets(prev => [...prev, newSheet]);
    setNodes([]);
    setEdges([]);
    setLanes([]);
    setActiveSheetId(newId);
  };
  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    // Merge current active state into sheets
    const currentSheets = sheets.map(sheet => {
      if (sheet.id === activeSheetId) {
        return { ...sheet, nodes, edges, lanes };
      }
      return sheet;
    });

    try {
      const payload = {
        user_id: user.id,
        name: currentSheets[0].name, // Use parent process name as package name
        sheets: currentSheets
      };

      if (projectId) {
        // Update Project
        await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/project/${projectId}`, { sheets: currentSheets });
        alert('Project Canvas Saved Successfully!');
      } else if (processId) {
        await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/processes/${processId}`, payload);
        alert('Process Package Saved Successfully!');
        router.push('/dashboard/process');
      } else {
        await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/processes`, payload);
        alert('Process Package Saved Successfully!');
        router.push('/dashboard/process');
      }
      
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!loading && role === 'viewer') {
      router.push('/dashboard/process');
    }
  }, [role, loading, router]);

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (role === 'viewer') {
    return null; 
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex-none p-4 border-b bg-white flex justify-between items-center">
        <h1 className="text-2xl font-bold">{projectId ? 'Edit Project Canvas' : 'Create New Process'}</h1>
        <div className="flex gap-2">
            {!projectId && <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm font-medium">Save Draft</button>}
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : (projectId ? 'Save Project' : 'Publish')}
            </button>
        </div>
      </div>
      
      <div className="flex-grow flex overflow-hidden relative">
        <ReactFlowProvider>
          <ProcessSidebar 
            onSaveVersion={handleSaveVersion}
            onLoadFile={handleLoadFile}
            onDownload={handleDownload}
            versions={versions}
            onLoadVersion={handleLoadVersion}
            onAddLane={handleAddLane}
          />
          <div className="flex-grow flex flex-col h-full">
             <ProcessCanvas 
                nodes={nodes}
                edges={edges}
                lanes={lanes}
                setLanes={setLanes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                setNodes={setNodes}
                setEdges={setEdges}
                users={users}
             />
             
             {/* Excel-like Tabs Bar */}
             <div className="h-10 bg-gray-100 border-t flex items-center px-2 gap-1 overflow-x-auto">
                {sheets.map(sheet => (
                  <button
                    key={sheet.id}
                    onClick={() => handleSwitchSheet(sheet.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-t-md border-t border-x transition-colors min-w-30",
                      activeSheetId === sheet.id 
                        ? "bg-white border-gray-300 text-blue-600 relative top-px z-10" 
                        : "bg-gray-200 border-transparent text-gray-600 hover:bg-gray-300"
                    )}
                  >
                    {sheet.id === 'parent' ? <Layout className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                    {sheet.name}
                  </button>
                ))}
                <button 
                  onClick={handleAddSheet}
                  className="p-1.5 hover:bg-gray-300 rounded-full ml-2 text-gray-600"
                  title="Add Child Process"
                >
                  <Plus className="w-4 h-4" />
                </button>
             </div>
          </div>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
