import React, { useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  useReactFlow,
  Edge,
  getSmoothStepPath,
} from 'reactflow';

const HANDLE_SIZE = 10;
const MIDPOINT_HANDLE_SIZE = 8;
const HIT_WIDTH = 20; // Width of the invisible "grab" area
const SNAP_DISTANCE = 15;

type Point = { x: number; y: number };

const parsePathPoints = (path: string): Point[] => {
  const points: Point[] = [];
  // Match both M and L commands and their coordinates
  const matches = path.match(/[ML]\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g);
  
  if (matches) {
    matches.forEach(match => {
      const parts = match.replace(/[ML]/, '').split(',');
      points.push({ x: parseFloat(parts[0]), y: parseFloat(parts[1]) });
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
    if (points.length > 0) return points;
    return getDefaultPoints();
  }, [points, getDefaultPoints]);

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
  if (points.length === 0) {
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
    points.forEach((p) => {
      path += ` L ${p.x},${p.y}`;
    });
    path += ` L ${targetX},${targetY}`;
  }

  // If there are no points, we calculate an initial step path representation
  // but only when starting an interaction
  const ensureInitialPoints = useCallback(() => {
    if (points.length === 0) {
      const initialPoints = getDefaultPoints();
      updatePoints(initialPoints);
      return initialPoints;
    }
    return points;
  }, [points, sourceX, sourceY, targetX, targetY, sourcePosition]);

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
      updatePoints(currentPoints);
    };

    const onMouseUp = () => {
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
      
      updatePoints(nextPoints);
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

  const edgeColor = data?.edgeStyle === 'red-dashed' ? '#ef4444' : '#2563eb';
  const midpointColor = data?.edgeStyle === 'red-dashed' ? '#fca5a5' : '#93c5fd';

  return (
    <>
      <BaseEdge 
        path={path} 
        markerEnd={markerEnd} 
        style={style} 
      />
      
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
                // background: 'rgba(255,0,0,0.1)', // Uncomment to debug hit areas
              }}
              onMouseDown={(event) => onSegmentDrag(i, event)}
            />
          );
        })}

        {selected && (
          <>
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
