import React from 'react';
import { TreeNode } from '../types';

interface Props {
  roots: TreeNode[];
}

export const TableOfContents: React.FC<Props> = ({ roots }) => {
  const renderList = (nodes: TreeNode[]): React.ReactNode => {
    // メタデータを除外
    const filtered = nodes.filter(tn => tn.node.type !== 'metadata');
    if (filtered.length === 0) return null;
    return (
      <ul style={{ margin: '0.25rem 0', paddingLeft: '1.25rem', listStyle: 'none' }}>
        {filtered.map(tn => (
          <li key={tn.node.id} style={{ margin: '0.2rem 0' }}>
            <a
              href={`#node-${tn.node.id}`}
              style={{ color: '#3b5bdb', textDecoration: 'none', fontSize: 13 }}
              onClick={e => {
                e.preventDefault();
                document.getElementById(`node-${tn.node.id}`)?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {tn.indexLabel && <span style={{ marginRight: 4 }}>{tn.indexLabel}</span>}
              {tn.node.title}
            </a>
            {!tn.node.disabled && renderList(tn.children)}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <nav style={{
      background: '#f0f4ff',
      borderRadius: 8,
      padding: '1rem 1.25rem',
      marginBottom: '1.5rem',
      borderLeft: '4px solid #3b5bdb',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#1a1a2e' }}>目次</div>
      {renderList(roots)}
    </nav>
  );
};
