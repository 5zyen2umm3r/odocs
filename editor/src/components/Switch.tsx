import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={e => { e.stopPropagation(); onChange(!checked); }}
      style={{
        display: 'inline-block',
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? '#3b5bdb' : '#ced4da',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: checked ? 18 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
    {label && (
      <span
        style={{ fontSize: 12, color: '#868e96', cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); onChange(!checked); }}
      >
        {label}
      </span>
    )}
  </div>
);
