import React, { useState, useRef } from 'react';
import { TreeNode, DocNode, ImageNode, MetadataNode, TableNode, NodeType } from '../types';
import { Switch } from './Switch';
import { TableEditor } from './TableEditor';
import { updateNode, createNode, deleteNode, moveNode } from '../utils/nodeOps';

interface Props {
  treeNode: TreeNode;
  allNodes: DocNode[];
  editMode: boolean;
  depth: number;
  onNodesChange?: (nodes: DocNode[]) => void;
  coverMode?: boolean; // 表紙モード：タイトル・テキスト編集のみ表示
}

export const NodeView: React.FC<Props> = ({ treeNode, allNodes, editMode, depth, onNodesChange, coverMode = false }) => {
  const { node, children, indexLabel } = treeNode;
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [addType, setAddType] = useState<NodeType>('text');
  const imgInputRef = useRef<HTMLInputElement>(null);

  const update = (updated: DocNode) => {
    // allNodes から常に最新のノードを取得して更新（古いクロージャ参照を避ける）
    onNodesChange?.(allNodes.map(n => n.id === updated.id ? updated : n));
  };

  const hLevel = Math.min(depth + 1, 6);
  const HTag = `h${hLevel}` as keyof JSX.IntrinsicElements;

  const borderColors = ['#3b5bdb', '#7950f2', '#0ca678', '#f59f00', '#e64980', '#1098ad'];
  const borderColor = borderColors[(depth - 1) % borderColors.length];

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      update({ ...node, imageUrl: ev.target?.result as string } as ImageNode);
    };
    reader.readAsDataURL(file);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      update({ ...node, imageUrl: ev.target?.result as string } as ImageNode);
    };
    reader.readAsDataURL(file);
  };

  const addChild = () => {
    // Find last child to set as prevSibling
    const lastChild = children.length > 0 ? children[children.length - 1].node : null;
    const newNode = createNode(addType, node.id, lastChild?.id ?? null);
    onNodesChange?.([...allNodes, newNode]);
  };

  const handleDelete = () => {
    if (!confirm(`「${node.title}」を削除しますか？（子項目も全て削除されます）`)) return;
    onNodesChange?.(deleteNode(allNodes, node.id));
  };

  const handleMove = (dir: 'up' | 'down') => {
    onNodesChange?.(moveNode(allNodes, node.id, dir));
  };

  return (
    <div
      id={`node-${node.id}`}
      style={{
        marginTop: '0.75rem',
        paddingLeft: depth > 1 ? '1rem' : 0,
        borderLeft: depth > 1 ? `3px solid ${borderColor}` : 'none',
        opacity: node.enabled ? 1 : 0.6,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {/* Collapse toggle — 表紙モードでは非表示 */}
        {!coverMode && (
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#868e96', padding: '0 2px', flexShrink: 0,
            }}
            title={collapsed ? '展開' : '折りたたむ'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        )}

        {/* Index label — 表紙モードでは非表示 */}
        {!coverMode && (
          <span style={{ color: '#868e96', fontSize: '0.85em', flexShrink: 0 }}>{indexLabel}</span>
        )}

        {/* Title */}
        {editMode && editingTitle ? (
          <input
            autoFocus
            aria-label="タイトル"
            value={node.title}
            onChange={e => update({ ...node, title: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={e => { if (e.key === 'Enter') setEditingTitle(false); }}
            style={{ fontSize: 'inherit', fontWeight: 600, border: '1px solid #3b5bdb', borderRadius: 4, padding: '2px 6px', flex: 1 }}
          />
        ) : (
          <HTag
            style={{ margin: 0, fontWeight: 600, cursor: editMode ? 'pointer' : 'default', flex: 1 }}
            onClick={() => { if (editMode) setEditingTitle(true); }}
            title={editMode ? 'クリックで編集' : undefined}
          >
            {node.title}
          </HTag>
        )}

        {/* Edit controls */}
        {editMode && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
            {!coverMode && (
              <Switch
                checked={node.enabled}
                onChange={v => {
                  const latest = allNodes.find(n => n.id === node.id);
                  if (latest) update({ ...latest, enabled: v });
                }}
                label="有効"
              />
            )}
            {!coverMode && <button type="button" className="btn-icon" onClick={() => handleMove('up')} title="上へ">↑</button>}
            {!coverMode && <button type="button" className="btn-icon" onClick={() => handleMove('down')} title="下へ">↓</button>}
            {!coverMode && <button type="button" className="btn-icon btn-danger" onClick={handleDelete} title="削除">🗑</button>}
          </div>
        )}
      </div>

      {/* Body (hidden when collapsed) */}
      {!collapsed && (
        <div style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
          {/* Metadata */}
          {node.type === 'metadata' && (
            <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#868e96', marginBottom: 4 }}>
              {editMode ? (
                <>
                  <label>日付: <input type="date" value={(node as MetadataNode).date ?? ''} onChange={e => update({ ...node, date: e.target.value } as MetadataNode)} style={{ fontSize: 13 }} /></label>
                  <label>ユーザ: <input value={(node as MetadataNode).user ?? ''} onChange={e => update({ ...node, user: e.target.value } as MetadataNode)} style={{ fontSize: 13, width: 120 }} /></label>
                </>
              ) : (
                <>
                  {(node as MetadataNode).date && <span>📅 {(node as MetadataNode).date}</span>}
                  {(node as MetadataNode).user && <span>👤 {(node as MetadataNode).user}</span>}
                </>
              )}
            </div>
          )}

          {/* Text */}
          {editMode && editingText ? (
            <textarea
              autoFocus
              aria-label="テキスト内容"
              value={node.text ?? ''}
              onChange={e => update({ ...node, text: e.target.value })}
              onBlur={() => setEditingText(false)}
              style={{ width: '100%', minHeight: 80, fontSize: 13, lineHeight: 1.6, border: '1px solid #3b5bdb', borderRadius: 4, padding: '6px 8px', resize: 'vertical', boxSizing: 'border-box' }}
            />
          ) : (
            node.text && (
              <p
                style={{ margin: '0.25rem 0', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 14, cursor: editMode ? 'pointer' : 'default' }}
                onClick={() => { if (editMode) setEditingText(true); }}
                title={editMode ? 'クリックで編集' : undefined}
              >
                {node.text}
              </p>
            )
          )}
          {editMode && !editingText && (
            <button className="btn-sm" style={{ marginTop: 2 }} onClick={() => setEditingText(true)} aria-label="テキスト編集">
              {node.text ? '✏️ テキスト編集' : '+ テキスト追加'}
            </button>
          )}

          {/* Image */}
          {node.type === 'image' && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleImageDrop}
              style={{ margin: '0.5rem 0' }}
            >
              {(node as ImageNode).imageUrl ? (
                <div>
                  <img
                    src={(node as ImageNode).imageUrl}
                    alt={node.title}
                    style={{ maxWidth: '100%', borderRadius: 6, display: 'block' }}
                  />
                  {editMode && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <input
                        placeholder="画像URL"
                        value={(node as ImageNode).imageUrl ?? ''}
                        onChange={e => update({ ...node, imageUrl: e.target.value } as ImageNode)}
                        style={{ flex: 1, fontSize: 12, padding: '2px 6px', border: '1px solid #ced4da', borderRadius: 4 }}
                      />
                      <button className="btn-sm" onClick={() => imgInputRef.current?.click()}>ファイル選択</button>
                    </div>
                  )}
                </div>
              ) : editMode ? (
                <div
                  style={{
                    border: '2px dashed #ced4da', borderRadius: 8, padding: '1.5rem',
                    textAlign: 'center', color: '#adb5bd', cursor: 'pointer',
                  }}
                  onClick={() => imgInputRef.current?.click()}
                >
                  画像をドロップ or クリックして選択
                  <br />
                  <input
                    aria-label="画像URL入力"
                    placeholder="または画像URLを入力"
                    style={{ marginTop: 8, width: '80%', fontSize: 12, padding: '4px 8px', border: '1px solid #ced4da', borderRadius: 4 }}
                    onChange={e => update({ ...node, imageUrl: e.target.value } as ImageNode)}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              ) : (
                <span style={{ color: '#adb5bd', fontSize: 13 }}>[画像なし]</span>
              )}
              <input ref={imgInputRef} type="file" accept="image/*" aria-label="画像ファイル選択" style={{ display: 'none' }} onChange={handleImageFile} />
            </div>
          )}

          {/* Table */}
          {node.type === 'table' && (
            <TableEditor
              node={node as TableNode}
              editMode={editMode}
              onChange={updated => update(updated)}
            />
          )}

          {/* Children (only if enabled) */}
          {node.enabled && children.map(child => (
            <NodeView
              key={child.node.id}
              treeNode={child}
              allNodes={allNodes}
              editMode={editMode}
              depth={depth + 1}
              onNodesChange={onNodesChange}
            />
          ))}

          {/* Add child */}
          {editMode && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
              <select
                aria-label="追加する項目タイプ"
                value={addType}
                onChange={e => setAddType(e.target.value as NodeType)}
                style={{ fontSize: 12, padding: '2px 6px', border: '1px solid #ced4da', borderRadius: 4 }}
              >
                <option value="text">テキスト</option>
                <option value="metadata">メタデータ</option>
                <option value="image">画像</option>
                <option value="table">テーブル</option>
              </select>
              <button className="btn-sm" onClick={addChild}>+ 子項目追加</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
