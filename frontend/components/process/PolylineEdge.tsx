import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  useReactFlow,
} from 'reactflow';

export default function PolylineEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const { setEdges, screenToFlowPosition } = useReactFlow();
  const points = data?.points || [];

  let path = `M ${sourceX},${sourceY}`;
  points.forEach((p: any) => {
    path += ` L ${p.x},${p.y}`;
  });
  path += ` L ${targetX},${targetY}`;

  const onHandleDrag = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const onMouseMove = (e: MouseEvent) => {
      const newPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      
      setEdges((edges) =>
        edges.map((edge) => {
          if (edge.id === id) {
            const newPoints = [...(edge.data?.points || [])];
            newPoints[index] = newPos;
            return {
              ...edge,
              data: { ...edge.data, points: newPoints },
            };
          }
          return edge;
        })
      );
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        {points.map((point: any, index: number) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${point.x}px,${point.y}px)`,
              pointerEvents: 'all',
              cursor: 'move',
              width: 10,
              height: 10,
              background: '#ff0072',
              borderRadius: '50%',
              zIndex: 1000, 
            }}
            onMouseDown={(event) => onHandleDrag(index, event)}
          />
        ))}
      </EdgeLabelRenderer>
    </>
  );
}
