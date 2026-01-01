import React, { useState } from 'react';
import { Box, FileText, Activity, GitMerge, Layers, Type, Columns, Save, Upload, Download, History, ChevronLeft, ChevronRight, MoreVertical, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProcessContext } from '@/context/ProcessContext';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ProcessSidebarProps {
  onSaveVersion?: () => void;
  onLoadFile?: (file: File) => void;
  onDownload?: () => void;
  versions?: { name: string; created_at: string; sheets?: any[] }[];
  onLoadVersion?: (versionName: string) => void;
  onAddLane?: () => void;
  isReadOnly?: boolean;
}

export const ProcessSidebar = ({ 
  onSaveVersion, 
  onLoadFile, 
  onDownload, 
  versions = [], 
  onLoadVersion,
  onAddLane,
  isReadOnly = false
}: ProcessSidebarProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const { edgeStyle, setEdgeStyle } = useProcessContext();

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onLoadFile) {
      onLoadFile(file);
    }
  };

  return (
    <aside className={cn(
      "border-r bg-white flex flex-col h-full transition-all duration-300 relative",
      isOpen ? "w-64" : "w-0 border-none"
    )}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3 top-6 bg-white border rounded-full p-1 shadow-md z-50 hover:bg-gray-50"
        title={isOpen ? "Hide Toolbox" : "Show Toolbox"}
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      <div className={cn("flex flex-col h-full overflow-hidden p-4 min-w-[16rem]", !isOpen && "hidden")}>
        <div className="flex flex-col gap-4 grow overflow-y-auto">
          {!isReadOnly && (
            <>
              <div className="font-bold text-sm text-gray-500 uppercase">Toolbox</div>
            
              <div className="flex flex-col gap-2">
              <div 
                className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50 bg-blue-100 border-blue-200" 
                onDragStart={(event) => onDragStart(event, 'workProduct', 'Work Product')} 
                draggable
                title="Work Product (W)"
              >
                <Box className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Work Product</span>
                <span className="ml-auto text-xs text-gray-400 font-mono">W</span>
              </div>

              <div 
                className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50 bg-yellow-50 border-yellow-200" 
                onDragStart={(event) => onDragStart(event, 'activity', 'Activity')} 
                draggable
                title="Activity (A)"
              >
                <Activity className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-900">Activity</span>
                <span className="ml-auto text-xs text-gray-400 font-mono">A</span>
              </div>

              <div 
                className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50 bg-orange-50 border-orange-200" 
                onDragStart={(event) => onDragStart(event, 'decision', 'Decision')} 
                draggable
                title="Decision (D)"
              >
                <GitMerge className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-900">Decision</span>
                <span className="ml-auto text-xs text-gray-400 font-mono">D</span>
              </div>

              <div 
                className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50 bg-green-50 border-green-200" 
                onDragStart={(event) => onDragStart(event, 'process', 'Process')} 
                draggable
                title="Process (P)"
              >
                <Layers className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">Process</span>
                <span className="ml-auto text-xs text-gray-400 font-mono">P</span>
              </div>

              <div 
                className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50 bg-cyan-50 border-cyan-200" 
                onDragStart={(event) => onDragStart(event, 'document', 'Document')} 
                draggable
                title="Document (O)"
              >
                <FileText className="w-4 h-4 text-cyan-600" />
                <span className="text-sm font-medium text-cyan-900">Document</span>
                <span className="ml-auto text-xs text-gray-400 font-mono">O</span>
              </div>

              <div 
                className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50" 
                onDragStart={(event) => onDragStart(event, 'text', 'Text Box')} 
                draggable
                title="Text Box (T)"
              >
                <Type className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Text Box</span>
                <span className="ml-auto text-xs text-gray-400 font-mono">T</span>
              </div>

              <div 
                className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50" 
                onClick={onAddLane}
                title="Add Swim Lane (L)"
              >
                <Columns className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Add Swim Lane</span>
                <span className="ml-auto text-xs text-gray-400 font-mono">L</span>
              </div>

              <div className="mt-4">
                <div className="font-bold text-xs text-gray-500 uppercase mb-2">Line Style</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEdgeStyle('blue-solid')}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 p-2 border rounded transition-all",
                      edgeStyle === 'blue-solid' ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500" : "hover:bg-gray-50"
                    )}
                  >
                    <div className="w-full h-1 bg-blue-500 rounded" />
                    <span className="text-[10px] font-medium">Solid Blue</span>
                  </button>
                  <button
                    onClick={() => setEdgeStyle('red-dashed')}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 p-2 border rounded transition-all",
                      edgeStyle === 'red-dashed' ? "bg-red-50 border-red-500 ring-1 ring-red-500" : "hover:bg-gray-50"
                    )}
                  >
                    <div className="w-full h-1 border-t-2 border-dashed border-red-500" />
                    <span className="text-[10px] font-medium">Dashed Red</span>
                  </button>
                </div>
              </div>
            </div>
          </>
          )}
        
          {isReadOnly && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <Layers size={48} className="opacity-20" />
              <p className="text-sm font-medium">View Only Mode</p>
            </div>
          )}
        </div>

        <div className="border-t pt-4 mt-auto flex flex-col gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full flex items-center gap-2 justify-center border-blue-200 hover:bg-blue-50 text-blue-700">
                <Settings className="w-4 h-4" /> Actions
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" side="right" align="end">
              <div className="flex flex-col gap-1">
                {onSaveVersion && (
                  <Button 
                    onClick={onSaveVersion} 
                    variant="ghost"
                    className="w-full justify-start text-green-700 hover:text-green-800 hover:bg-green-50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save Version
                  </Button>
                )}

                {onLoadFile && (
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button 
                      variant="ghost"
                      className="w-full justify-start text-blue-700 hover:text-blue-800 hover:bg-blue-50 flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" /> Load from File
                    </Button>
                  </div>
                )}

                {onDownload && (
                  <Button 
                    onClick={onDownload} 
                    variant="ghost"
                    className="w-full justify-start text-gray-700 hover:text-gray-800 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download JSON
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {versions.length > 0 && onLoadVersion && (
            <div className="mt-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Load Version</label>
              <select 
                className="w-full border rounded p-2 text-sm"
                onChange={(e) => onLoadVersion(e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>Select Version</option>
                {versions.map((v, i) => (
                  <option key={i} value={v.name}>
                    {v.name} ({new Date(v.created_at).toLocaleDateString()}) - {v.sheets?.length || 0} Sheets
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

    </aside>
  );
};
