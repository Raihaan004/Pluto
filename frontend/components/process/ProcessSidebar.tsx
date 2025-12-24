import React, { useState } from 'react';
import { Box, FileText, Activity, GitMerge, Layers, Type, Columns, Save, Upload, Download, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProcessSidebarProps {
  onSaveVersion?: () => void;
  onLoadFile?: (file: File) => void;
  onDownload?: () => void;
  versions?: { name: string; created_at: string; sheets?: any[] }[];
  onLoadVersion?: (versionName: string) => void;
  onAddLane?: () => void;
}

export const ProcessSidebar = ({ 
  onSaveVersion, 
  onLoadFile, 
  onDownload, 
  versions = [], 
  onLoadVersion,
  onAddLane
}: ProcessSidebarProps) => {
  const [isOpen, setIsOpen] = useState(true);

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

      <div className={cn("flex flex-col gap-4 h-full overflow-y-auto p-4 min-w-[16rem]", !isOpen && "hidden")}>
        <div className="font-bold text-sm text-gray-500 uppercase">Toolbox</div>
      
        <div className="flex flex-col gap-2">
        <div 
          className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50 bg-blue-100 border-blue-200" 
          onDragStart={(event) => onDragStart(event, 'workProduct', 'Work Product')} 
          draggable
        >
          <Box className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Work Product</span>
        </div>

        <div 
          className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50 bg-yellow-50 border-yellow-200" 
          onDragStart={(event) => onDragStart(event, 'activity', 'Activity')} 
          draggable
        >
          <Activity className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-900">Activity</span>
        </div>

        <div 
          className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50 bg-orange-50 border-orange-200" 
          onDragStart={(event) => onDragStart(event, 'decision', 'Decision')} 
          draggable
        >
          <GitMerge className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-medium text-orange-900">Decision</span>
        </div>

        <div 
          className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50 bg-green-50 border-green-200" 
          onDragStart={(event) => onDragStart(event, 'process', 'Process')} 
          draggable
        >
          <Layers className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-900">Process</span>
        </div>

        <div 
          className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50 bg-cyan-50 border-cyan-200" 
          onDragStart={(event) => onDragStart(event, 'document', 'Document')} 
          draggable
        >
          <FileText className="w-4 h-4 text-cyan-600" />
          <span className="text-sm font-medium text-cyan-900">Document</span>
        </div>

        <div 
          className="flex items-center gap-2 p-2 border rounded cursor-grab hover:bg-gray-50" 
          onDragStart={(event) => onDragStart(event, 'text', 'Text Box')} 
          draggable
        >
          <Type className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Text Box</span>
        </div>

        <div 
          className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50" 
          onClick={onAddLane}
        >
          <Columns className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Add Swim Lane</span>
        </div>
      </div>

      <div className="border-t pt-4 flex flex-col gap-2">
        <div className="font-bold text-sm text-gray-500 mb-2">Actions</div>
        
        {onSaveVersion && (
          <Button onClick={onSaveVersion} className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 justify-center">
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
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 justify-center">
              <Upload className="w-4 h-4" /> Load from File
            </Button>
          </div>
        )}

        {onDownload && (
          <Button onClick={onDownload} variant="outline" className="w-full flex items-center gap-2 justify-center">
            <Download className="w-4 h-4" /> Download JSON
          </Button>
        )}

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

      <div className={cn("mt-auto border-t pt-4", !isOpen && "hidden")}>
        <div className="font-bold text-sm text-gray-500 mb-2">Properties</div>
        <div className="text-xs text-gray-400 italic">Select an element to view properties</div>
      </div>
    </aside>
  );
};
