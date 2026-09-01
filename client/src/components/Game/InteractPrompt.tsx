import React from 'react';

export const InteractPrompt: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      bottom: '18%',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '6px 14px',
      background: 'rgba(0,0,0,0.75)',
      border: '1px solid rgba(180,40,40,0.5)',
      color: '#e5e5e5',
      fontFamily: 'monospace',
      fontSize: '14px',
      letterSpacing: '0.1em',
      pointerEvents: 'none',
      zIndex: 40,
    }}
  >
    <span style={{ color: '#c0392b', fontWeight: 700 }}>[E]</span> Interact
  </div>
);
