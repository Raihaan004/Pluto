import React, { useCallback, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  useReactFlow,
  Edge,
  getSmoothStepPath,
  Position,
} from 'reactflow';

const HANDLE_SIZE = 10;
const MIDPOINT_HANDLE_SIZE = 8;
const HIT_WIDTH = 20; // Width of the invisible "grab" area
const SNAP_DISTANCE = 15;

type Point = { x: number; y: number };

interface DragInfo {
  index: number;
  type: 'point' | 'midpoint' | 'segment';
  currentPos: Point;
  points: Point[];
}

const parsePathPoints = (path: string): Point[] => {
  const points: Point[] = [];
  // Robust match for M/L commands and their coordinates
  const matches = path.match(/[ML][^ML]+/g);
  
  if (matches) {
    matches.forEach(match => {
      const coords = match.slice(1).trim().split(/[,\s]+/).filter(Boolean);
      if (coords.length >= 2) {
        points.push({ x: parseFloat(coords[0]), y: parseFloat(coords[1]) });
      }
    });
  }
  return points;
};

export default function EditableStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
  selected,
  animated,
}: EdgeProps) {
  const { setEdges, screenToFlowPosition } = useReactFlow();
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const points: Point[] = data?.points || [];

  // Logic to accurately match React Flow's getSmoothStepPath behavior
  const getDefaultPoints = useCallback(() => {
    const [path] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 0,
    });
    
    const allParsedPoints = parsePathPoints(path);
    // Remove the first and last points as they are sourceX/Y and targetX/Y
    if (allParsedPoints.length >= 2) {
      return allParsedPoints.slice(1, -1);
    }
    return [];
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

  const getPointsForInteraction = useCallback(() => {
    if (dragInfo) return dragInfo.points;
    if (points.length > 0) return points;
    return getDefaultPoints();
  }, [points, dragInfo, getDefaultPoints]);

  const effectivePoints = getPointsForInteraction();
  const allPoints = [{ x: sourceX, y: sourceY }, ...effectivePoints, { x: targetX, y: targetY }];
  
  const getSegments = useCallback(() => {
    const res = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
        res.push({
            p1: allPoints[i],
            p2: allPoints[i+1],
            index: i
        });
    }
    return res;
  }, [allPoints]);

  const segments = getSegments();

  // Construct the path
  let path = '';
  if (points.length === 0 && !dragInfo) {
    [path] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 0,
    });
  } else {
    // If we have points, we draw exactly as they are defined for full control
    path = `M ${sourceX},${sourceY}`;
    effectivePoints.forEach((p) => {
      path += ` L ${p.x},${p.y}`;
    });
    path += ` L ${targetX},${targetY}`;
  }

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

    const startPoints = points.length > 0 ? [...points] : getDefaultPoints();

    const onMouseMove = (e: MouseEvent) => {
      const newPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      
      const newPoints = [...startPoints];
      const prev = index === 0 ? { x: sourceX, y: sourceY } : startPoints[index - 1];
      const next = index === startPoints.length - 1 ? { x: targetX, y: targetY } : startPoints[index + 1];

      // Step Behavior: Maintain orthogonality with neighbors
      if (Math.abs(newPos.x - prev.x) < 20) newPos.x = prev.x;
      else if (Math.abs(newPos.y - prev.y) < 20) newPos.y = prev.y;
      
      if (Math.abs(newPos.x - next.x) < 20) newPos.x = next.x;
      else if (Math.abs(newPos.y - next.y) < 20) newPos.y = next.y;

      newPoints[index] = newPos;
      setDragInfo({
        index,
        type: 'point',
        currentPos: newPos,
        points: newPoints
      });
    };

    const onMouseUp = () => {
      setDragInfo((curr) => {
        if (curr) updatePoints(curr.points);
        return null;
      });
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMidpointDrag = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    const startPoints = points.length > 0 ? [...points] : getDefaultPoints();
    const allPointsList = [{ x: sourceX, y: sourceY }, ...startPoints, { x: targetX, y: targetY }];
    const p1 = allPointsList[index];
    const p2 = allPointsList[index + 1];
    
    const isHorizontal = Math.abs(p1.y - p2.y) < 2;

    const onMouseMove = (e: MouseEvent) => {
      const newPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      
      let newPointsToAdd: Point[] = [];
      if (isHorizontal) {
        newPointsToAdd = [
          { x: p1.x, y: newPos.y },
          { x: p2.x, y: newPos.y }
        ];
      } else {
        newPointsToAdd = [
          { x: newPos.x, y: p1.y },
          { x: newPos.x, y: p2.y }
        ];
      }

      const currentPoints = [...startPoints];
      currentPoints.splice(index, 0, ...newPointsToAdd);
      
      setDragInfo({
        index: index + 1, // Focus on the new "elbow"
        type: 'midpoint',
        currentPos: newPos,
        points: currentPoints
      });
    };

    const onMouseUp = () => {
      setDragInfo((curr) => {
        if (curr) updatePoints(curr.points);
        return null;
      });
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onSegmentDrag = (segmentIndex: number, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    const startPoints = points.length > 0 ? [...points] : getDefaultPoints();
    const allPointsList = [{ x: sourceX, y: sourceY }, ...startPoints, { x: targetX, y: targetY }];
    const p1 = allPointsList[segmentIndex];
    const p2 = allPointsList[segmentIndex + 1];

    const isHorizontal = Math.abs(p1.y - p2.y) < 2;

    const onMouseMove = (e: MouseEvent) => {
      const newPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      let nextPoints = [...startPoints];

      if (isHorizontal) {
        if (segmentIndex === 0) {
            nextPoints = [{ x: startPoints[0].x, y: newPos.y }, ...startPoints.slice(1)];
        } else if (segmentIndex === startPoints.length) {
            nextPoints = [...startPoints.slice(0, -1), { x: startPoints[startPoints.length - 1].x, y: newPos.y }];
        } else {
            nextPoints[segmentIndex - 1].y = newPos.y;
            nextPoints[segmentIndex].y = newPos.y;
        }
      } else {
        if (segmentIndex === 0) {
            nextPoints = [{ x: newPos.x, y: startPoints[0].y }, ...startPoints.slice(1)];
        } else if (segmentIndex === startPoints.length) {
            nextPoints = [...startPoints.slice(0, -1), { x: newPos.x, y: startPoints[startPoints.length - 1].y }];
        } else {
            nextPoints[segmentIndex - 1].x = newPos.x;
            nextPoints[segmentIndex].x = newPos.x;
        }
      }
      
      setDragInfo({
        index: segmentIndex,
        type: 'segment',
        currentPos: newPos,
        points: nextPoints
      });
    };

    const onMouseUp = () => {
      setDragInfo((curr) => {
        if (curr) updatePoints(curr.points);
        return null;
      });
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onPointDoubleClick = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    const startPoints = points.length > 0 ? [...points] : getDefaultPoints();
    const newPoints = startPoints.filter((_, i) => i !== index);
    updatePoints(newPoints);
  };

  const edgeColor = data?.edgeStyle === 'red-dashed' ? '#ef4444' : '#2563eb';
  const midpointColor = data?.edgeStyle === 'red-dashed' ? '#fca5a5' : '#93c5fd';

  // Preview path during drag
  const previewPath = dragInfo ? (
     `M ${sourceX},${sourceY} ` + dragInfo.points.map(p => `L ${p.x},${p.y}`).join(' ') + ` L ${targetX},${targetY}`
  ) : null;

  return (
    <>
      <BaseEdge 
        path={path} 
        markerEnd={markerEnd} 
        style={{
            ...style,
            opacity: dragInfo ? 0.3 : 1
        }} 
      />

      {previewPath && (
        <path
          d={previewPath}
          fill="none"
          stroke={edgeColor}
          strokeWidth={2}
          strokeDasharray="5,5"
          pointerEvents="none"
        />
      )}
      
      {/* Invisible Interactive Segments (Anywhere dragging) */}
      <EdgeLabelRenderer>
        {segments.map((seg, i) => {
          const isHorizontal = Math.abs(seg.p1.y - seg.p2.y) < 2;
          const left = Math.min(seg.p1.x, seg.p2.x);
          const top = Math.min(seg.p1.y, seg.p2.y);
          const width = isHorizontal ? Math.abs(seg.p1.x - seg.p2.x) : HIT_WIDTH;
          const height = isHorizontal ? HIT_WIDTH : Math.abs(seg.p1.y - seg.p2.y);
          
          return (
            <div
              key={`seg-${i}`}
              style={{
                position: 'absolute',
                transform: `translate(${isHorizontal ? left : left - HIT_WIDTH/2}px, ${isHorizontal ? top - HIT_WIDTH/2 : top}px)`,
                width: Math.max(width, 5),
                height: Math.max(height, 5),
                pointerEvents: 'all',
                cursor: isHorizontal ? 'ns-resize' : 'ew-resize',
                zIndex: 999,
              }}
              onMouseDown={(event) => onSegmentDrag(i, event)}
            />
          );
        })}

        {dragInfo && (
            <div
                style={{
                    position: 'absolute',
                    transform: `translate(${dragInfo.currentPos.x + 10}px, ${dragInfo.currentPos.y - 25}px)`,
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    pointerEvents: 'none',
                    zIndex: 2000,
                    whiteSpace: 'nowrap'
                }}
            >
                {Math.round(dragInfo.currentPos.x)}, {Math.round(dragInfo.currentPos.y)}
            </div>
        )}

        {selected && (
          <>
            {/* Existing and Automatic/Default Points */}
        {effectivePoints.map((point, index) => (
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
            {!dragInfo && segments.map((midpoint, i) => (
              <div
                key={`midpoint-${i}`}
                style={{
                  position: 'absolute',
                  transform: `translate(-50%, -50%) translate(${midpoint.p1.x + (midpoint.p2.x - midpoint.p1.x)/2}px, ${midpoint.p1.y + (midpoint.p2.y - midpoint.p1.y)/2}px)`,
                  pointerEvents: 'all',
                  cursor: 'copy',
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
          </>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
