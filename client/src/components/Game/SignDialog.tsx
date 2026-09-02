import React from 'react';
import type { SignEntry } from '../../data/SignData';

interface SignDialogProps {
  sign: SignEntry;
  onClose: () => void;
}

export const SignDialog: React.FC<SignDialogProps> = ({ sign, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'absolute',
      bottom: '10%',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(520px, 80vw)',
      padding: '18px 22px',
      background: 'rgba(10,10,12,0.92)',
      border: '1px solid rgba(180,40,40,0.5)',
      color: '#e5e5e5',
      fontFamily: 'monospace',
      zIndex: 50,
      cursor: 'pointer',
    }}
  >
    <div style={{ color: '#c0392b', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
      {sign.title.toUpperCase()}
    </div>
    <div style={{ fontSize: 14, lineHeight: 1.5 }}>{sign.body}</div>
    <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
      <span style={{ color: '#c0392b', fontWeight: 700 }}>[E]</span> Close
    </div>
  </div>
);
