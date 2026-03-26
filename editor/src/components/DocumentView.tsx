import React, { useMemo } from 'react';
import { DocNode, MetadataNode } from '../types';
import { buildTree } from '../utils/tree';
import { TableOfContents } from './TableOfContents';
import { NodeView } from './NodeView';

interface Props {
  rootId: string;
  allNodes: DocNode[];
  editMode: boolean;
  onNodesChange?: (nodes: DocNode[]) => void;
}

export const DocumentView: React.FC<Props> = ({ rootId, allNodes, editMode, onNodesChange }) => {
  const rootNode = allNodes.find(n => n.id === rootId);

  // rootIdを起点とした全子孫IDセットを反復で収集
  const childNodes = useMemo(() => {
    const childrenOf = new Map<string, string[]>();
    for (const n of allNodes) {
      const p = n.parentId ?? null;
      if (p) {
        if (!childrenOf.has(p)) childrenOf.set(p, []);
        childrenOf.get(p)!.push(n.id);
      }
    }
    const inScope = new Set<string>();
    const queue = [rootId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const childId of childrenOf.get(cur) ?? []) {
        inScope.add(childId);
        queue.push(childId);
      }
    }
    return allNodes.filter(n => inScope.has(n.id));
  }, [allNodes, rootId]);

  // buildTree はparentId===nullのノードを起点にするため、
  // 直接の子（parentId===rootId）のparentIdをnullに差し替えて渡す
  const treeNodes = useMemo(() => {
    return childNodes.map(n =>
      n.parentId === rootId ? { ...n, parentId: null } : n
    );
  }, [childNodes, rootId]);

  const tree = useMemo(() => buildTree(treeNodes), [treeNodes]);

  // 表紙用メタデータ（rootの直接子でmetadataタイプ）
  const coverMeta = useMemo(() =>
    allNodes.find(n => n.parentId === rootId && n.type === 'metadata') as MetadataNode | undefined,
    [allNodes, rootId]
  );

  return (
    <div style={{ padding: '1rem 0' }}>
      {/* 表紙 */}
      {rootNode && (
        <div style={{
          borderBottom: '2px solid #3b5bdb',
          marginBottom: '2rem',
          paddingBottom: '1.5rem',
        }}>
          <h1 style={{ margin: '0 0 0.5rem', color: '#1a1a2e', fontSize: '1.8rem' }}>
            {rootNode.title}
          </h1>
          {rootNode.text && (
            <p style={{ margin: '0.5rem 0', whiteSpace: 'pre-wrap', color: '#495057', lineHeight: 1.7 }}>
              {rootNode.text}
            </p>
          )}
          {coverMeta && (
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#868e96', marginTop: '0.75rem' }}>
              {coverMeta.date && <span>📅 {coverMeta.date}</span>}
              {coverMeta.user && <span>👤 {coverMeta.user}</span>}
            </div>
          )}
          {/* 編集モード時はrootノード自体の編集をNodeViewで行う */}
          {editMode && rootNode && (() => {
            const dummyTree = buildTree([rootNode]);
            return dummyTree.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                <NodeView
                  key={rootNode.id}
                  treeNode={{ ...dummyTree[0], children: [] }}
                  allNodes={allNodes}
                  editMode={true}
                  depth={0}
                  onNodesChange={onNodesChange}
                  coverMode
                />
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* 目次（rootを除いた子孫ツリー） */}
      <TableOfContents roots={tree} />

      {/* 本文 */}
      {tree.map(tn => (
        <NodeView
          key={tn.node.id}
          treeNode={tn}
          allNodes={allNodes}
          editMode={editMode}
          depth={1}
          onNodesChange={onNodesChange}
        />
      ))}
    </div>
  );
};
