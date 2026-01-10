import { useCallback, useState } from 'react';
import { Node, XYPosition, Rect, NodeChange } from 'reactflow';

// Threshold for snapping and showing helper lines
const SNAP_DISTANCE = 5;

type HelperLineConfig = {
  horizontal?: number;
  vertical?: number;
  snapPosition: XYPosition;
};

export const useHelperLines = () => {
  const [helperLines, setHelperLines] = useState<{
    horizontal?: number;
    vertical?: number;
  }>({});

  const calculateHelperLines = useCallback((
    change: NodeChange,
    nodes: Node[],
    distance = SNAP_DISTANCE
  ): HelperLineConfig | null => {
    // If not a position change or not dragging, clear lines and return
    if (change.type !== 'position' || !change.dragging || !change.position) {
      return null;
    }

    const movingNode = nodes.find((n) => n.id === change.id);

    if (!movingNode) {
      return null;
    }

    // Use dimensions from the node (React Flow fills these after first render)
    const movingWidth = movingNode.width ?? 0;
    const movingHeight = movingNode.height ?? 0;

    const result: HelperLineConfig = {
      snapPosition: { x: change.position.x, y: change.position.y },
    };

    const movingNodeRect: Rect = {
      x: change.position.x,
      y: change.position.y,
      width: movingWidth,
      height: movingHeight,
    };

    let minDistanceHorizontal = distance;
    let minDistanceVertical = distance;
    
    let matchedHorizontal = false;
    let matchedVertical = false;

    nodes.forEach((node) => {
      // Don't align with itself or nodes without dimensions
      if (node.id === movingNode.id || !node.width || !node.height) return;

      const nodeRect: Rect = {
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
      };

      // Vertical alignment (x-axis)
      const verticalMatchPositions = [
        { moving: movingNodeRect.x, target: nodeRect.x }, // Left-Left
        { moving: movingNodeRect.x, target: nodeRect.x + nodeRect.width }, // Left-Right
        { moving: movingNodeRect.x + movingNodeRect.width, target: nodeRect.x }, // Right-Left
        { moving: movingNodeRect.x + movingNodeRect.width, target: nodeRect.x + nodeRect.width }, // Right-Right
        { moving: movingNodeRect.x + movingWidth / 2, target: nodeRect.x + nodeRect.width / 2 }, // Center-Center
      ];

      verticalMatchPositions.forEach(({ moving, target }) => {
        const diff = Math.abs(moving - target);
        if (diff < minDistanceVertical) {
          result.vertical = target;
          minDistanceVertical = diff;
          matchedVertical = true;
          
          if (moving === movingNodeRect.x) result.snapPosition.x = target;
          else if (moving === movingNodeRect.x + movingNodeRect.width) result.snapPosition.x = target - movingWidth;
          else if (moving === movingNodeRect.x + movingWidth / 2) result.snapPosition.x = target - movingWidth / 2;
        }
      });

      // Horizontal alignment (y-axis)
      const horizontalMatchPositions = [
        { moving: movingNodeRect.y, target: nodeRect.y }, // Top-Top
        { moving: movingNodeRect.y, target: nodeRect.y + nodeRect.height }, // Top-Bottom
        { moving: movingNodeRect.y + movingNodeRect.height, target: nodeRect.y }, // Bottom-Top
        { moving: movingNodeRect.y + movingNodeRect.height, target: nodeRect.y + nodeRect.height }, // Bottom-Bottom
        { moving: movingNodeRect.y + movingHeight / 2, target: nodeRect.y + nodeRect.height / 2 }, // Center-Center
      ];

      horizontalMatchPositions.forEach(({ moving, target }) => {
        const diff = Math.abs(moving - target);
        if (diff < minDistanceHorizontal) {
          result.horizontal = target;
          minDistanceHorizontal = diff;
          matchedHorizontal = true;
          
          if (moving === movingNodeRect.y) result.snapPosition.y = target;
          else if (moving === movingNodeRect.y + movingNodeRect.height) result.snapPosition.y = target - movingHeight;
          else if (moving === movingNodeRect.y + movingHeight / 2) result.snapPosition.y = target - movingHeight / 2;
        }
      });
    });

    setHelperLines({
      horizontal: matchedHorizontal ? result.horizontal : undefined,
      vertical: matchedVertical ? result.vertical : undefined,
    });

    return result;
  }, []);

  return {
    helperLines,
    setHelperLines,
    calculateHelperLines,
  };
};
