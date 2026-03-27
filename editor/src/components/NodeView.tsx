import React, { useState, useRef } from 'react';
import { TreeNode, DocNode, ImageNode, MetadataNode, TableNode, NodeType } from '../types';
import { Switch } from './Switch';
import { TableEditor } from './TableEditor';
import { ContextMenu, MenuEntry } from './ContextMenu';
import { createNode, deleteNode, moveNode } from '../utils/nodeOps';

interface Props {
  treeNode: TreeNode;
  allNodes: DocNode[];
  editMode: boolean;
  depth: number;
  onNodesChange?: (nodes: DocNode[]) => void;
  coverMode?: boolean;
}

export const NodeView: React.FC<Props> = ({ treeNode, allNodes, editMode, depth, onNodesChange, coverMode = false }) => {
  const { node, children, indexLabel } = treeNode;
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // allNodes上の実際のparentId（DocumentViewがparentIdをnullに差し替えるため、
  // 表示ツリー上のnode.parentIdは信頼できない。allNodesから取得する）
  const realParentId = allNodes.find(n => n.id === node.id)?.parentId ?? null;

  const update = (updated: DocNode) => {
    // allNodes上の元ノードをベースにマージすることで、
    // DocumentViewがparentIdをnullに差し替えた影響を受けないようにする
    const original = allNodes.find(n => n.id === updated.id);
    const merged = original ? { ...original, ...updated, parentId: original.parentId } : updated;
    onNodesChange?.(allNodes.map(n => n.id === merged.id ? merged : n));
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
    reader.onload = ev => { update({ ...node, imageUrl: ev.target?.result as string } as ImageNode); };
    reader.readAsDataURL(file);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { update({ ...node, imageUrl: ev.target?.result as string } as ImageNode); };
    reader.readAsDataURL(file);
  };

  const addChild = (type: NodeType) => {
    const lastChild = children.length > 0 ? children[children.length - 1].node : null;
    const newNode = createNode(type, node.id, lastChild?.id ?? null);
    onNodesChange?.([...allNodes, newNode]);
  };

  // 上に挿入：このノードの直前（prevSiblingId を引き継ぐ）
  const insertBefore = (type: NodeType) => {
    const original = allNodes.find(n => n.id === node.id)!;
    const newNode = createNode(type, realParentId, original.prevSiblingId ?? null);
    // このノードの prevSiblingId を新ノードに付け替え
    const updated = allNodes.map(n =>
      n.id === node.id ? { ...n, prevSiblingId: newNode.id } : n
    );
    onNodesChange?.([...updated, newNode]);
  };

  // 下に挿入：このノードの直後
  const insertAfter = (type: NodeType) => {
    const newNode = createNode(type, realParentId, node.id);
    // このノードの次の兄弟（prevSiblingId === node.id）を新ノードの後ろに付け替え
    const updated = allNodes.map(n =>
      n.prevSiblingId === node.id ? { ...n, prevSiblingId: newNode.id } : n
    );
    onNodesChange?.([...updated, newNode]);
  };

  const handleDelete = () => {
    if (!confirm(`「${node.title}」を削除しますか？（子項目も全て削除されます）`)) return;
    onNodesChange?.(deleteNode(allNodes, node.id));
  };

  const handleMove = (dir: 'up' | 'down') => {
    onNodesChange?.(moveNode(allNodes, node.id, dir));
  };

  const typeLabel: Record<NodeType, string> = {
    text: 'テキスト', metadata: 'メタデータ', image: '画像', table: 'テーブル',
  };

  const changeType = (newType: NodeType) => {
    if (newType === node.type) return;
    if (!confirm(`タイプを「${typeLabel[newType]}」に変更しますか？\nタイプ固有のデータ（画像URL・テーブルデータ等）は失われます。`)) return;
    // allNodes から実際のノードを取得して parentId を保持
    const original = allNodes.find(n => n.id === node.id)!;
    const base = {
      id: original.id,
      parentId: original.parentId,
      prevSiblingId: original.prevSiblingId,
      title: original.title,
      text: original.text,
      disabled: original.disabled,
      index: original.index,
    };
    let changed: DocNode;
    if (newType === 'text') changed = { ...base, type: 'text' };
    else if (newType === 'metadata') changed = { ...base, type: 'metadata', date: '', user: '' };
    else if (newType === 'image') changed = { ...base, type: 'image', imageUrl: '' };
    else changed = { ...base, type: 'table', columns: [], rows: [] };
    update(changed);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!editMode || coverMode) return;
    if (editingText || editingTitle) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const buildMenuItems = (): MenuEntry[] => {
    const items: MenuEntry[] = [];
    const types: NodeType[] = ['text', 'metadata', 'image', 'table'];

    // ── タイプ変更 ──
    items.push({ group: 'タイプ変更' });
    types.forEach(t => {
      items.push({ label: typeLabel[t], icon: { text: '📝', metadata: '📋', image: '🖼️', table: '📊' }[t], onClick: () => changeType(t), disabled: node.type === t, indent: true });
    });

    items.push({ separator: true });

    // ── 画像固有 ──
    if (node.type === 'image') {
      items.push({ group: '画像' });
      items.push({ label: '画像ファイルを選択', icon: '📂', onClick: () => imgInputRef.current?.click(), indent: true });
      items.push({ separator: true });
    }

    // ── 子項目を追加 ──
    items.push({ group: '子項目を追加' });
    types.forEach(t => {
      items.push({ label: typeLabel[t], icon: '↳', onClick: () => addChild(t), indent: true });
    });

    // ── 上/下に挿入（rootノード以外） ──
    // realParentId が null でなければ兄弟操作が可能
    if (realParentId !== null) {
      items.push({ separator: true });
      items.push({ group: '上に項目を挿入' });
      types.forEach(t => {
        items.push({ label: typeLabel[t], icon: '↑', onClick: () => insertBefore(t), indent: true });
      });
      items.push({ separator: true });
      items.push({ group: '下に項目を挿入' });
      types.forEach(t => {
        items.push({ label: typeLabel[t], icon: '↓', onClick: () => insertAfter(t), indent: true });
      });
    }

    return items;
  };

  return (
    <div
      id={`node-${node.id}`}
      onContextMenu={handleContextMenu}
      style={{
        marginTop: '0.75rem',
        paddingLeft: depth > 1 ? '1rem' : 0,
        borderLeft: depth > 1 ? `3px solid ${borderColor}` : 'none',
        opacity: node.disabled ? 0.6 : 1,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {!coverMode && (
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#868e96', padding: '0 2px', flexShrink: 0 }}
            title={collapsed ? '展開' : '折りたたむ'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        )}
        {editMode && editingTitle ? (
          <>
            {!coverMode && (
              <span style={{ fontWeight: 600, flexShrink: 0 }}>{indexLabel}</span>
            )}
            <input
              autoFocus
              aria-label="タイトル"
              value={node.title}
              onChange={e => update({ ...node, title: e.target.value })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => { if (e.key === 'Enter') setEditingTitle(false); }}
              style={{ fontSize: 'inherit', fontWeight: 600, border: '1px solid #3b5bdb', borderRadius: 4, padding: '2px 6px', flex: 1 }}
            />
          </>
        ) : (
          <HTag
            style={{ margin: 0, fontWeight: 600, cursor: editMode ? 'pointer' : 'default', flex: 1 }}
            onClick={() => { if (editMode) setEditingTitle(true); }}
            title={editMode ? 'クリックで編集' : undefined}
          >
            {!coverMode && indexLabel && node.type !== 'metadata' && <span style={{ marginRight: '0.4em' }}>{indexLabel}</span>}
            {node.title}
          </HTag>
        )}

        {editMode && !coverMode && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
            <Switch
              checked={!node.disabled}
              onChange={v => {
                const latest = allNodes.find(n => n.id === node.id);
                if (latest) update({ ...latest, disabled: !v });
              }}
              label="有効"
            />
            <button type="button" className="btn-icon" onClick={() => handleMove('up')} title="上へ">↑</button>
            <button type="button" className="btn-icon" onClick={() => handleMove('down')} title="下へ">↓</button>
            <button type="button" className="btn-icon btn-danger" onClick={handleDelete} title="削除">🗑</button>
          </div>
        )}
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={buildMenuItems()}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Body */}
      {!collapsed && (
        <div style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
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

          {/* Text — クリックで直接編集 */}
          {editMode && editingText ? (
            <textarea
              autoFocus
              aria-label="テキスト内容"
              value={node.text ?? ''}
              onChange={e => {
                update({ ...node, text: e.target.value });
                // 高さを内容に合わせて自動調整
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onBlur={() => setEditingText(false)}
              onContextMenu={e => e.stopPropagation()}
              ref={el => {
                // 初期高さ：現在の行数＋1行分
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight + 22}px`;
                }
              }}
              style={{ width: '100%', minHeight: '3em', fontSize: 13, lineHeight: 1.6, border: '1px solid #3b5bdb', borderRadius: 4, padding: '6px 8px', resize: 'vertical', boxSizing: 'border-box' }}
            />
          ) : (
            <p
              style={{ margin: '0.25rem 0', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 14, cursor: editMode ? 'text' : 'default', minHeight: editMode ? '1.5em' : undefined }}
              onClick={() => { if (editMode) setEditingText(true); }}
              title={editMode ? 'クリックで編集' : undefined}
            >
              {node.text || (editMode
                ? <span style={{ color: '#adb5bd', fontStyle: 'italic' }}>クリックしてテキストを入力...</span>
                : null)}
            </p>
          )}

          {node.type === 'image' && (
            <div onDragOver={e => e.preventDefault()} onDrop={handleImageDrop} style={{ margin: '0.5rem 0' }}>
              {(node as ImageNode).imageUrl ? (
                <div>
                  <img src={(node as ImageNode).imageUrl} alt={node.title} style={{ maxWidth: '100%', borderRadius: 6, display: 'block' }} />
                  {editMode && (
                    <input
                      aria-label="画像URL"
                      placeholder="画像URL"
                      value={(node as ImageNode).imageUrl ?? ''}
                      onChange={e => update({ ...node, imageUrl: e.target.value } as ImageNode)}
                      style={{ marginTop: 4, width: '100%', fontSize: 12, padding: '2px 6px', border: '1px solid #ced4da', borderRadius: 4, boxSizing: 'border-box' }}
                    />
                  )}
                </div>
              ) : editMode ? (
                <div
                  style={{ border: '2px dashed #ced4da', borderRadius: 8, padding: '1.5rem', textAlign: 'center', color: '#adb5bd', cursor: 'pointer' }}
                  onClick={() => imgInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleImageDrop}
                >
                  画像をドロップ、または右クリックメニューからファイル選択
                </div>
              ) : (
                <span style={{ color: '#adb5bd', fontSize: 13 }}>[画像なし]</span>
              )}
              <input ref={imgInputRef} type="file" accept="image/*" aria-label="画像ファイル選択" style={{ display: 'none' }} onChange={handleImageFile} />
            </div>
          )}

          {node.type === 'table' && (
            <TableEditor
              node={node as TableNode}
              editMode={editMode}
              onChange={updated => update(updated)}
            />
          )}

          {!node.disabled && children.map(child => (
            <NodeView
              key={child.node.id}
              treeNode={child}
              allNodes={allNodes}
              editMode={editMode}
              depth={depth + 1}
              onNodesChange={onNodesChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};
