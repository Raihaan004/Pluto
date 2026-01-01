import React, { useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  useReactFlow,
  Edge,
} from 'reactflow';

const HANDLE_SIZE = 10;
const MIDPOINT_HANDLE_SIZE = 8;
const SNAP_DISTANCE = 15;

type Point = { x: number; y: number };

export default function EditableStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
  selected,
  animated,
}: EdgeProps) {
  const { setEdges, screenToFlowPosition } = useReactFlow();
  const points: Point[] = data?.points || [];

  // Construct the path: Source -> Points -> Target
  let path = `M ${sourceX},${sourceY}`;
  points.forEach((p) => {
    path += ` L ${p.x},${p.y}`;
  });
  path += ` L ${targetX},${targetY}`;

  const updatePoints = useCallback(
    (newPoints: Point[]) => {
      setEdges((edges) =>
        edges.map((e) => {
          if (e.id === id) {
            return {
              ...e,
              data: { ...e.data, points: newPoints },
            };
          }
          return e;
        })
      );
    },
    [id, setEdges]
  );

  const onPointDrag = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    const onMouseMove = (e: MouseEvent) => {
      const newPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      
      // Snapping logic
      // We need to check the previous and next points to snap to orthogonal lines
      // Previous point is either points[index-1] or source
      const prev = index === 0 ? { x: sourceX, y: sourceY } : points[index - 1];
      // Next point is either points[index+1] or target
      const next = index === points.length - 1 ? { x: targetX, y: targetY } : points[index + 1];

      // Snap X
      if (Math.abs(newPos.x - prev.x) < SNAP_DISTANCE) newPos.x = prev.x;
      else if (Math.abs(newPos.x - next.x) < SNAP_DISTANCE) newPos.x = next.x;

      // Snap Y
      if (Math.abs(newPos.y - prev.y) < SNAP_DISTANCE) newPos.y = prev.y;
      else if (Math.abs(newPos.y - next.y) < SNAP_DISTANCE) newPos.y = next.y;

      const newPoints = [...points];
      newPoints[index] = newPos;
      updatePoints(newPoints);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMidpointDrag = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    // Calculate the initial midpoint position
    // The midpoint is between index (or source) and index+1 (or target)
    // Actually, let's define segments:
    // Segment 0: Source -> points[0]
    // Segment i: points[i-1] -> points[i]
    // Segment last: points[last] -> Target
    
    // The index passed here corresponds to the segment index.
    // We want to insert a new point at this segment.
    
    // Initial position is where the mouse is (snapped to flow)
    const initialPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    
    // Insert the new point
    const newPoints = [...points];
    newPoints.splice(index, 0, initialPos);
    
    // We need to update the edge immediately so the point exists
    // But we also want to start dragging it.
    // Since setEdges is async/batched, we can't easily grab the ref to the new DOM element immediately.
    // However, we can just run the drag logic on the *new* array index.
    
    // The new point is at `index`.
    
    const onMouseMove = (e: MouseEvent) => {
      const newPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      
      // Re-fetch latest points? No, we are in a closure, but we need to be careful.
      // Actually, we should use the functional update in setEdges to be safe, 
      // but for dragging, we usually keep local state or just assume we own the edge.
      // Let's use the same logic as onPointDrag but adapted.
      
      // We need to know the neighbors of the NEW point at `index`.
      // The neighbors are what were previously the endpoints of the segment.
      
      // Previous: if index==0, source. Else newPoints[index-1] (which is oldPoints[index-1])
      // But wait, `points` in this closure is the OLD points array.
      
      const prev = index === 0 ? { x: sourceX, y: sourceY } : points[index - 1];
      const next = index === points.length ? { x: targetX, y: targetY } : points[index]; 
      // Note: points[index] in old array is the one after the insertion point.

      // Snap logic
      if (Math.abs(newPos.x - prev.x) < SNAP_DISTANCE) newPos.x = prev.x;
      else if (Math.abs(newPos.x - next.x) < SNAP_DISTANCE) newPos.x = next.x;

      if (Math.abs(newPos.y - prev.y) < SNAP_DISTANCE) newPos.y = prev.y;
      else if (Math.abs(newPos.y - next.y) < SNAP_DISTANCE) newPos.y = next.y;

      // Construct the new array with the moved point
      const currentPoints = [...points];
      currentPoints.splice(index, 0, newPos);
      updatePoints(currentPoints);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onPointDoubleClick = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    const newPoints = points.filter((_, i) => i !== index);
    updatePoints(newPoints);
  };

  // Calculate midpoints for rendering handles
  // Segments: Source -> p0, p0 -> p1, ..., pn -> Target
  const segments = [];
  const allPoints = [{ x: sourceX, y: sourceY }, ...points, { x: targetX, y: targetY }];
  
  for (let i = 0; i < allPoints.length - 1; i++) {
    segments.push({
      x: (allPoints[i].x + allPoints[i + 1].x) / 2,
      y: (allPoints[i].y + allPoints[i + 1].y) / 2,
      index: i, // This index corresponds to where the new point should be inserted
    });
  }

  const edgeColor = data?.edgeStyle === 'red-dashed' ? '#ef4444' : '#2563eb';
  const midpointColor = data?.edgeStyle === 'red-dashed' ? '#fca5a5' : '#93c5fd';

  return (
    <>
      <BaseEdge 
        path={path} 
        markerEnd={markerEnd} 
        style={style} 
      />
      
      {selected && (
      <EdgeLabelRenderer>
        {/* Existing Points */}
        {points.map((point, index) => (
          <div
            key={`point-${index}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${point.x}px,${point.y}px)`,
              pointerEvents: 'all',
              cursor: 'move',
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              background: edgeColor,
              borderRadius: '50%',
              border: '2px solid white',
              zIndex: 1001,
            }}
            onMouseDown={(event) => onPointDrag(index, event)}
            onDoubleClick={(event) => onPointDoubleClick(index, event)}
            title="Drag to move, Double-click to remove"
          />
        ))}

        {/* Midpoints (Virtual Handles) */}
        {segments.map((midpoint, i) => (
          <div
            key={`midpoint-${i}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${midpoint.x}px,${midpoint.y}px)`,
              pointerEvents: 'all',
              cursor: 'copy', // Indicates adding something
              width: MIDPOINT_HANDLE_SIZE,
              height: MIDPOINT_HANDLE_SIZE,
              background: midpointColor,
              borderRadius: '50%',
              zIndex: 1000,
              opacity: 0.8,
            }}
            onMouseDown={(event) => onMidpointDrag(midpoint.index, event)}
            title="Drag to add point"
          />
        ))}
      </EdgeLabelRenderer>
      )}
    </>
  );
}
