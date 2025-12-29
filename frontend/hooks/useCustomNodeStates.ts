import { useState, useCallback } from 'react';
import { applyNodeChanges, Node, NodeChange, OnNodesChange } from 'reactflow';

const PADDING = 20;

const doNodesOverlap = (node1: Node, node2: Node) => {
  const n1Width = node1.width || 150;
  const n1Height = node1.height || 50;
  const n2Width = node2.width || 150;
  const n2Height = node2.height || 50;

  return (
    node1.position.x < node2.position.x + n2Width + PADDING &&
    node1.position.x + n1Width + PADDING > node2.position.x &&
    node1.position.y < node2.position.y + n2Height + PADDING &&
    node1.position.y + n1Height + PADDING > node2.position.y
  );
};

export const useCustomNodeStates = (initialNodes: Node[]): [Node[], React.Dispatch<React.SetStateAction<Node[]>>, OnNodesChange] => {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((currentNodes) => {
      // Apply changes first
      const nextNodes = applyNodeChanges(changes, currentNodes);

      // Only do collision detection if not dragging (to avoid infinite loops during drag)
      const positionChanges = changes.filter(
        (change): change is NodeChange & { type: 'position' } => {
          return (
            change.type === 'position' &&
            !!change.position &&
            change.dragging === false
          );
        }
      );

      // Skip collision detection entirely if dragging or if no position changes
      if (positionChanges.length === 0) {
        return nextNodes;
      }

      let updatedNodes = [...nextNodes];

      for (const change of positionChanges) {
        const movingNode = updatedNodes.find((n) => n.id === change.id);
        if (!movingNode) continue;

        // Skip collision detection for swim lanes - they can be placed anywhere
        if (movingNode.type === 'swimLane') {
          continue;
        }

        for (const otherNode of updatedNodes) {
          if (movingNode.id === otherNode.id || otherNode.type === 'swimLane') continue;

          if (doNodesOverlap(movingNode, otherNode)) {
            const dx = (movingNode.position.x + (movingNode.width || 150) / 2) - (otherNode.position.x + (otherNode.width || 150) / 2);
            const dy = (movingNode.position.y + (movingNode.height || 50) / 2) - (otherNode.position.y + (otherNode.height || 50) / 2);
            const overlapX = (movingNode.width || 150) / 2 + (otherNode.width || 150) / 2 - Math.abs(dx) + PADDING;
            const overlapY = (movingNode.height || 50) / 2 + (otherNode.height || 50) / 2 - Math.abs(dy) + PADDING;

            const newPosition = { ...movingNode.position };

            if (overlapX > 0 && overlapY > 0) {
              if (overlapX < overlapY) {
                newPosition.x += dx > 0 ? overlapX : -overlapX;
              } else {
                newPosition.y += dy > 0 ? overlapY : -overlapY;
              }
            }
            
            updatedNodes = updatedNodes.map(n => n.id === movingNode.id ? { ...n, position: newPosition } : n);
          }
        }
      }
      return updatedNodes;
    });
  }, []); // Empty dependency array - setNodes is stable and doesn't need to be in deps

  return [nodes, setNodes, onNodesChange];
};
