import React, { memo, useState } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import { Link as LinkIcon, FileText, Users, CheckSquare, BookOpen, Paperclip, AlignLeft, MessageSquare, Edit2 } from 'lucide-react';
import { useProcessContext } from '@/context/ProcessContext';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MultiHandles = ({ colorClass }: { colorClass: string }) => {
  const baseClasses = `w-2 h-2 ${colorClass} opacity-0 group-hover:opacity-100 transition-opacity`;
  const positions = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  
  return (
    <>
      {positions.map((pos) => (
        <React.Fragment key={pos}>
            {/* Top Edge */}
            <Handle type="target" position={Position.Top} id={`t-top-${pos}`} style={{ left: `${pos}%` }} className={baseClasses} />
            <Handle type="source" position={Position.Top} id={`s-top-${pos}`} style={{ left: `${pos}%` }} className={baseClasses} />
            
            {/* Bottom Edge */}
            <Handle type="target" position={Position.Bottom} id={`t-bottom-${pos}`} style={{ left: `${pos}%` }} className={baseClasses} />
            <Handle type="source" position={Position.Bottom} id={`s-bottom-${pos}`} style={{ left: `${pos}%` }} className={baseClasses} />
            
            {/* Left Edge */}
            <Handle type="target" position={Position.Left} id={`t-left-${pos}`} style={{ top: `${pos}%` }} className={baseClasses} />
            <Handle type="source" position={Position.Left} id={`s-left-${pos}`} style={{ top: `${pos}%` }} className={baseClasses} />
            
            {/* Right Edge */}
            <Handle type="target" position={Position.Right} id={`t-right-${pos}`} style={{ top: `${pos}%` }} className={baseClasses} />
            <Handle type="source" position={Position.Right} id={`s-right-${pos}`} style={{ top: `${pos}%` }} className={baseClasses} />
        </React.Fragment>
      ))}
    </>
  );
};

const NodeIcons = ({ data }: { data: any }) => {
  const { openNodeDialog } = useProcessContext();
  const hasLinks = data.links && data.links.length > 0;
  const hasTemplates = data.templates && data.templates.length > 0;
  const hasGuidelines = data.guidelines && data.guidelines.length > 0;
  const hasChecklists = data.checklists && data.checklists.length > 0;
  const hasRoles = (data.roles && data.roles.length > 0) || (data.responsibility && data.responsibility.length > 0) || (data.support && data.support.length > 0);
  const hasDescription = data.description && data.description.trim().length > 0;
  const hasVerificationComments = data.verificationComments && data.verificationComments.trim().length > 0;
  const hasAuthorComments = data.authorComments && data.authorComments.trim().length > 0;
  const hasComments = hasVerificationComments || hasAuthorComments;

  if (!hasLinks && !hasTemplates && !hasGuidelines && !hasChecklists && !hasRoles && !hasDescription && !hasComments) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent node selection
    openNodeDialog(data);
  };

  return (
    <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 cursor-pointer" onClick={handleClick}>
      {hasLinks && <div className="bg-white/80 p-0.5 rounded-full shadow-sm hover:bg-blue-50" title="Has Links"><Paperclip className="w-3 h-3 text-blue-600" /></div>}
      {hasDescription && <div className="bg-white/80 p-0.5 rounded-full shadow-sm flex items-center justify-center w-4 h-4 hover:bg-gray-50" title="Has Description"><span className="text-[10px] font-bold text-gray-700">D</span></div>}
      {hasTemplates && <div className="bg-white/80 p-0.5 rounded-full shadow-sm hover:bg-orange-50" title="Has Templates"><FileText className="w-3 h-3 text-orange-600" /></div>}
      {hasGuidelines && <div className="bg-white/80 p-0.5 rounded-full shadow-sm hover:bg-green-50" title="Has Guidelines"><BookOpen className="w-3 h-3 text-green-600" /></div>}
      {hasChecklists && <div className="bg-white/80 p-0.5 rounded-full shadow-sm hover:bg-purple-50" title="Has Checklists"><CheckSquare className="w-3 h-3 text-purple-600" /></div>}
      {hasRoles && <div className="bg-white/80 p-0.5 rounded-full shadow-sm hover:bg-gray-50" title="Has Roles/Responsibility"><Users className="w-3 h-3 text-gray-600" /></div>}
      {hasComments && <div className="bg-white/80 p-0.5 rounded-full shadow-sm hover:bg-yellow-50" title="Has Comments"><MessageSquare className="w-3 h-3 text-yellow-600" /></div>}
    </div>
  );
};

const StatusIndicator = ({ data }: { data: any }) => {
  const state = data.state || 'None';
  
  if (state === 'None') return null;

  let label = 'D';
  let bgClass = 'bg-gray-200';
  let textClass = 'text-gray-700';
  
  if (state === 'Refined') {
    label = 'R';
    bgClass = 'bg-yellow-200';
    textClass = 'text-yellow-800';
  } else if (state === 'Final') {
    label = 'F';
    bgClass = 'bg-green-200';
    textClass = 'text-green-800';
  }

  return (
    <div 
      className={`absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm pointer-events-none ${bgClass} ${textClass}`} 
      title={`Status: ${state}`}
    >
      {label}
    </div>
  );
};

const WorkProductNode = ({ data, selected }: any) => {
  return (
    <>
      <NodeResizer color="#2563eb" isVisible={selected} minWidth={100} minHeight={50} />
      <div 
        className="px-8 py-2 shadow-md rounded-md border-2 w-full h-full flex items-center justify-center relative group"
        style={{ 
          backgroundColor: data.backgroundColor || '#BFDBFE', 
          borderColor: '#60A5FA',
          color: data.textColor || '#1E3A8A'
        }}
      >
        <NodeIcons data={data} />
        <StatusIndicator data={data} />
        <div 
          className="text-sm"
          style={{
            fontWeight: data.isBold ? 'bold' : 'normal',
            textAlign: data.alignment || 'center',
            whiteSpace: data.wrapText ? 'normal' : 'nowrap'
          }}
        >
          {data.label}
        </div>
        <MultiHandles colorClass="bg-blue-500" />
      </div>
    </>
  );
};

const ActivityNode = ({ data, selected }: any) => {
  return (
    <>
      <NodeResizer color="#ca8a04" isVisible={selected} minWidth={100} minHeight={50} />
      <div 
        className="px-8 py-2 shadow-md rounded-md border-2 w-full h-full flex items-center justify-center relative group"
        style={{ 
          backgroundColor: data.backgroundColor || '#FEF9C3', 
          borderColor: '#FDE047',
          color: data.textColor || '#713F12'
        }}
      >
        <NodeIcons data={data} />
        <StatusIndicator data={data} />
        <div 
          className="text-sm"
          style={{
            fontWeight: data.isBold ? 'bold' : 'normal',
            textAlign: data.alignment || 'center',
            whiteSpace: data.wrapText ? 'normal' : 'nowrap'
          }}
        >
          {data.label}
        </div>
        <MultiHandles colorClass="bg-yellow-500" />
      </div>
    </>
  );
};

const DecisionNode = ({ data, selected }: any) => {
  return (
    <>
      <NodeResizer color="#ea580c" isVisible={selected} minWidth={100} minHeight={100} />
      <div className="w-full h-full relative flex items-center justify-center group">
        <div 
          className="absolute inset-0 border-2 shadow-md rounded-md"
          style={{ 
            backgroundColor: data.backgroundColor || '#FED7AA', 
            borderColor: '#FB923C',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            width: '100%',
            height: '100%',
          }}
        ></div>
        <div className="relative z-10 w-full h-full flex items-center justify-center pointer-events-none">
           {/* Icons need to be positioned carefully in diamond */}
           <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-auto">
              <NodeIcons data={data} />
           </div>
           <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-auto">
              <StatusIndicator data={data} />
           </div>
           <div 
              className="text-sm px-6"
              style={{
                color: data.textColor || '#7C2D12',
                fontWeight: data.isBold ? 'bold' : 'normal',
                textAlign: data.alignment || 'center',
                whiteSpace: data.wrapText ? 'normal' : 'nowrap'
              }}
            >
              {data.label}
            </div>
        </div>
        <Handle type="target" position={Position.Top} id="t-top" className="w-3 h-3 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="source" position={Position.Top} id="s-top" className="w-3 h-3 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="target" position={Position.Bottom} id="t-bottom" className="w-3 h-3 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="source" position={Position.Bottom} id="s-bottom" className="w-3 h-3 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="target" position={Position.Left} id="t-left" className="w-3 h-3 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="source" position={Position.Left} id="s-left" className="w-3 h-3 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="target" position={Position.Right} id="t-right" className="w-3 h-3 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="source" position={Position.Right} id="s-right" className="w-3 h-3 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </>
  );
};

const ProcessNode = ({ data, selected }: any) => {
  return (
    <>
      <NodeResizer color="#16a34a" isVisible={selected} minWidth={100} minHeight={50} />
      <div 
        className="px-8 py-2 shadow-md rounded-md border-2 w-full h-full flex items-center justify-center relative group"
        style={{ 
          backgroundColor: data.backgroundColor || '#BBF7D0', 
          borderColor: '#4ADE80',
          color: data.textColor || '#14532D'
        }}
      >
        <NodeIcons data={data} />
        <StatusIndicator data={data} />
        <div 
          className="text-sm"
          style={{
            fontWeight: data.isBold ? 'bold' : 'normal',
            textAlign: data.alignment || 'center',
            whiteSpace: data.wrapText ? 'normal' : 'nowrap'
          }}
        >
          {data.label}
        </div>
        <MultiHandles colorClass="bg-green-500" />
      </div>
    </>
  );
};

const DocumentNode = ({ data, selected }: any) => {
  // This is the start of the existing DocumentNode component definition
  // ... (rest of the component is unchanged)
  return (
    <>
      <NodeResizer color="#0891b2" isVisible={selected} minWidth={100} minHeight={50} />
      <div 
        className="px-8 py-2 shadow-md rounded-none border-2 w-full h-full flex items-center justify-center relative group"
        style={{ 
          backgroundColor: data.backgroundColor || '#A5F3FC', 
          borderColor: '#22D3EE',
          color: data.textColor || '#164E63',
          borderRadius: '0 0 10px 10px'
        }}
      >
        <NodeIcons data={data} />
        <StatusIndicator data={data} />
        <div 
          className="text-sm"
          style={{
            fontWeight: data.isBold ? 'bold' : 'normal',
            textAlign: data.alignment || 'center',
            whiteSpace: data.wrapText ? 'normal' : 'nowrap'
          }}
        >
          {data.label}
        </div>
        <MultiHandles colorClass="bg-cyan-500" />
      </div>
    </>
  );
};

const SwimLaneNode = ({ id, data, selected }: any) => {
  const { setNodes } = useProcessContext();
  const [label, setLabel] = useState(data.label);

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel);
    if (setNodes) {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return { ...node, data: { ...node.data, label: newLabel } };
          }
          return node;
        })
      );
    }
  };

  return (
    <>
      <NodeResizer isVisible={selected} minWidth={200} minHeight={400} />
      <div 
        className="w-full h-full rounded-lg border-2 border-dashed bg-gray-100/50"
        style={{ borderColor: data.color || '#cccccc', zIndex: -1 }}
      >
        <Popover>
          <PopoverTrigger asChild>
            <div 
              className="text-center font-bold p-2 bg-gray-200/50 rounded-t-lg cursor-pointer hover:bg-gray-300/50 transition-colors flex items-center justify-center gap-2"
              style={{ color: data.textColor || '#555555' }}
            >
              {data.label}
              <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Edit Lane Label</h4>
              <Input 
                value={label} 
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Enter lane name..."
                autoFocus
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
};

export const nodeTypes = {
  workProduct: memo(WorkProductNode),
  activity: memo(ActivityNode),
  decision: memo(DecisionNode),
  process: memo(ProcessNode),
  document: memo(DocumentNode),
  swimLane: memo(SwimLaneNode),
};
