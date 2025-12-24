import React from 'react';
import { getBezierPath, ConnectionLineComponentProps } from 'reactflow';
import { getEdgeParams, InternalNode } from '@/lib/floating-edge-utils';
import { Node } from 'reactflow';

function FloatingConnectionLine({ toX, toY, fromPosition, toPosition, fromNode }: ConnectionLineComponentProps) {
  if (!fromNode) {
    return null;
  }

  const targetNode = {
    id: 'connection-target',
    width: 1,
    height: 1,
    positionAbsolute: { x: toX, y: toY },
    position: { x: toX, y: toY },
    data: {},
  } as unknown as InternalNode;

  const { sx, sy } = getEdgeParams(fromNode as unknown as InternalNode, targetNode);

  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: fromPosition,
    targetPosition: toPosition,
    targetX: toX,
    targetY: toY,
  });

  return (
    <g>
      <path
        fill="none"
        stroke="#222"
        strokeWidth={1.5}
        className="animated"
        d={edgePath}
      />
      <circle cx={toX} cy={toY} fill="#fff" r={3} stroke="#222" strokeWidth={1.5} />
    </g>
  );
}

export default FloatingConnectionLine;
