'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useViewport, useReactFlow } from 'reactflow';
import { ExternalLink, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export const HEADER_HEIGHT = 40;
export const ROW_LABEL_WIDTH = 40;
export const ROWS_COUNT = 50;
export const DEFAULT_COLUMN_WIDTHS = [400, 200, 200, 200, 200, 200, 200];
export const DEFAULT_ROW_HEIGHT = 80;

export const getColumnLabel = (index: number) => {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
};

const isURL = (str: string) => {
  if (!str) return false;
  const pattern = /^(https?:\/\/|www\.)[^\s\/$.?#].[^\s]*$/i;
  return pattern.test(str);
};

export const RowControls = ({ rowHeight, onRowHeightResize }: { 
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

export const TableGrid = ({ 
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

  const getCellLinks = useCallback((cellId: string) => {
    try {
      const data = cellData[cellId];
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
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
          left: colLeft + ROW_LABEL_WIDTH,
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
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: totalWidth + ROW_LABEL_WIDTH,
          height: ROWS_COUNT * rowHeight + HEADER_HEIGHT
        }}
        className="pointer-events-none"
      >
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
            <span className={cn(
              "absolute inset-0 flex items-center justify-center text-[28px] font-black text-slate-300 font-mono uppercase tracking-widest select-none transition-opacity pointer-events-none",
              (cellData[cell.id] || cell.colIndex === 0) ? "opacity-0" : "opacity-40"
            )}>
              {cell.id}
            </span>

            {cell.colIndex > 0 && (
              <div className="w-full h-full relative flex items-center justify-center">
                {(cell.colIndex >= 4 && cell.colIndex <= 6) ? (
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
              Add multiple links and labels for this cell.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4 max-h-[400px] overflow-y-auto pr-2">
            {links.map((link, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 group relative">
                <div className="flex-1 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Link Label</Label>
                    <Input 
                      placeholder="e.g. Design Doc" 
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
                <p className="text-sm text-slate-500">No links added yet.</p>
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

export const TableHeader = ({ columnWidths, onColumnResize }: { 
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

export const TableScrollbars = ({ 
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
    if (scrollRefV.current) scrollRefV.current.scrollTop = -y;
    if (scrollRefH.current) scrollRefH.current.scrollLeft = -x;
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
      <div 
        className="absolute right-0 top-10 bottom-0 w-[14px] bg-slate-50/50 z-[30] overflow-y-scroll overflow-x-hidden border-l border-slate-300 pointer-events-auto"
        ref={scrollRefV}
        onScroll={onScrollV}
      >
        <div style={{ height: totalHeight + 200, width: 1 }} />
      </div>
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
