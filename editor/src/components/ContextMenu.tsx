import React, { useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: false;
  indent?: boolean; // グループ内インデント
}
export interface MenuSeparator {
  separator: true;
}
export interface MenuGroup {
  group: string; // グループヘッダラベル
}
export type MenuEntry = MenuItem | MenuSeparator | MenuGroup;

interface Props {
  x: number;
  y: number;
  items: MenuEntry[];
  onClose: () => void;
}

export const ContextMenu: React.FC<Props> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const menuW = 220;
  const estHeight = items.length * 30;
  const adjustedX = x + menuW > window.innerWidth ? x - menuW : x;
  const adjustedY = y + estHeight > window.innerHeight ? Math.max(4, y - estHeight) : y;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: adjustedY,
        left: adjustedX,
        zIndex: 9999,
        background: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        minWidth: menuW,
        padding: '4px 0',
        fontSize: 13,
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      {items.map((item, i) => {
        if ('separator' in item && item.separator) {
          return <div key={i} style={{ height: 1, background: '#e9ecef', margin: '3px 0' }} />;
        }
        if ('group' in item) {
          return (
            <div key={i} style={{
              padding: '4px 12px 2px',
              fontSize: 11,
              fontWeight: 700,
              color: '#868e96',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              userSelect: 'none',
            }}>
              {item.group}
            </div>
          );
        }
        const mi = item as MenuItem;
        return (
          <button
            key={i}
            type="button"
            disabled={mi.disabled}
            onClick={() => { mi.onClick(); onClose(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: `5px ${mi.indent ? '24px' : '14px'}`,
              border: 'none',
              background: 'none',
              cursor: mi.disabled ? 'not-allowed' : 'pointer',
              color: mi.danger ? '#c92a2a' : mi.disabled ? '#adb5bd' : '#212529',
              textAlign: 'left',
              fontSize: 13,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (!mi.disabled) (e.currentTarget as HTMLElement).style.background = '#f1f3f5'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            {mi.icon && <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>{mi.icon}</span>}
            {mi.label}
          </button>
        );
      })}
    </div>
  );
};
