import React from 'react';
import { useStore } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';

interface HelperLinesProps {
  horizontal?: number;
  vertical?: number;
}

const canvasStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'absolute',
  top: 0,
  left: 0,
  zIndex: 10,
  pointerEvents: 'none',
};

export function HelperLines({ horizontal, vertical }: HelperLinesProps) {
  const transform = useStore((store) => store.transform);

  return (
    <svg style={canvasStyle} className="react-flow__helperlines">
      <AnimatePresence>
        {vertical !== undefined && (
          <motion.line
            key="vertical"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 0.6,
              x1: vertical * transform[2] + transform[0],
              x2: vertical * transform[2] + transform[0]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            y1={0}
            y2="100%"
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
        {horizontal !== undefined && (
          <motion.line
            key="horizontal"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 0.6,
              y1: horizontal * transform[2] + transform[1],
              y2: horizontal * transform[2] + transform[1]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            x1={0}
            x2="100%"
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
      </AnimatePresence>
    </svg>
  );
}
