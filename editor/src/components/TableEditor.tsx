import React, { useState, useRef } from 'react';
import { TableNode, ColumnDef, CellValue } from '../types';
import { parseTsvToRows } from '../utils/nodeOps';
import { ContextMenu, MenuEntry } from './ContextMenu';

interface Props {
  node: TableNode;
  editMode: boolean;
  onChange?: (updated: TableNode) => void;
}

type CtxTarget =
  | { kind: 'col'; colIdx: number }
  | { kind: 'row'; rowIdx: number };

export const TableEditor: React.FC<Props> = ({ node, editMode, onChange }) => {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [colDraft, setColDraft] = useState<ColumnDef | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target: CtxTarget } | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const update = (patch: Partial<TableNode>) => onChange?.({ ...node, ...patch });

  const addColumn = () => {
    const key = `col_${Date.now()}`;
    update({ columns: [...node.columns, { key, label: '新列', type: 'string' }] });
  };

  const insertColumnAt = (idx: number, after: boolean) => {
    const key = `col_${Date.now()}`;
    const cols = [...node.columns];
    cols.splice(after ? idx + 1 : idx, 0, { key, label: '新列', type: 'string' });
    update({ columns: cols });
  };

  const removeColumn = (key: string) => {
    const newCols = node.columns.filter(c => c.key !== key);
    const safeCols = newCols.length > 0
      ? newCols
      : [{ key: 'col_1', label: '列1', type: 'string' as const }];
    update({
      columns: safeCols,
      rows: node.rows.map(r => { const nr = { ...r }; delete nr[key]; return nr; }),
    });
  };

  const moveColumn = (idx: number, dir: 'left' | 'right') => {
    const cols = [...node.columns];
    const swap = dir === 'left' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= cols.length) return;
    [cols[idx], cols[swap]] = [cols[swap], cols[idx]];
    update({ columns: cols });
  };

  const addRow = () => {
    const row: Record<string, CellValue> = {};
    node.columns.forEach(c => { row[c.key] = ''; });
    update({ rows: [...node.rows, row] });
  };

  const insertRowAt = (idx: number, after: boolean) => {
    const row: Record<string, CellValue> = {};
    node.columns.forEach(c => { row[c.key] = ''; });
    const rows = [...node.rows];
    rows.splice(after ? idx + 1 : idx, 0, row);
    update({ rows });
  };

  const removeRows = (indices: number[]) => {
    const set = new Set(indices);
    update({ rows: node.rows.filter((_, i) => !set.has(i)) });
    setSelectedRows(new Set());
  };

  const moveRow = (idx: number, dir: 'up' | 'down') => {
    const rows = [...node.rows];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= rows.length) return;
    [rows[idx], rows[swap]] = [rows[swap], rows[idx]];
    update({ rows });
  };

  const sortRows = (colKey: string, asc: boolean) => {
    const rows = [...node.rows].sort((a, b) => {
      const av = a[colKey] ?? '';
      const bv = b[colKey] ?? '';
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    update({ rows });
  };

  const setCellValue = (rowIdx: number, colKey: string, val: string) => {
    const rows = node.rows.map((r, i) => i === rowIdx ? { ...r, [colKey]: val } : r);
    update({ rows });
  };

  const handlePaste = async (startRowIdx?: number) => {
    try {
      const text = await navigator.clipboard.readText();
      applyPaste(text, startRowIdx);
    } catch {
      pasteRef.current?.focus();
    }
  };

  const applyPaste = (text: string, startRowIdx?: number) => {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return;
    const firstCells = lines[0].split('\t').map(s => s.trim());
    const isHeader = firstCells.every(c => node.columns.some(col => col.label === c || col.key === c));
    const dataLines = isHeader ? lines.slice(1) : lines;
    let targetCols = node.columns;
    if (isHeader) {
      targetCols = firstCells.map(c => node.columns.find(col => col.label === c || col.key === c) ?? { key: c, label: c, type: 'string' as const });
    }
    const newRows = parseTsvToRows(dataLines.join('\n'), targetCols);

    const effectiveStart = startRowIdx ?? (selectedRows.size > 0 ? Math.min(...selectedRows) : undefined);

    if (effectiveStart !== undefined) {
      const rows = [...node.rows];
      newRows.forEach((r, i) => {
        if (effectiveStart + i < rows.length) rows[effectiveStart + i] = { ...rows[effectiveStart + i], ...r };
        else rows.push(r);
      });
      update({ rows });
    } else if (isHeader && node.keyColumn) {
      const keyCol = node.keyColumn;
      const rows = [...node.rows];
      for (const nr of newRows) {
        const keyVal = nr[keyCol];
        const existing = rows.findIndex(r => r[keyCol] === keyVal);
        if (existing >= 0) rows[existing] = { ...rows[existing], ...nr };
        else rows.push(nr);
      }
      update({ rows });
    } else {
      update({ rows: [...node.rows, ...newRows] });
    }
    setSelectedRows(new Set());
  };

  const toggleRowSelect = (idx: number, e: React.MouseEvent) => {
    if (!editMode) return;
    const newSel = new Set(selectedRows);
    if (e.shiftKey && newSel.size > 0) {
      const last = Math.max(...newSel);
      const min = Math.min(idx, last);
      const max = Math.max(idx, last);
      for (let i = min; i <= max; i++) newSel.add(i);
    } else {
      if (newSel.has(idx)) newSel.delete(idx);
      else newSel.add(idx);
    }
    setSelectedRows(newSel);
  };

  const openCtx = (e: React.MouseEvent, target: CtxTarget) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, target });
  };

  // ── メニュー構築 ──────────────────────────────────────────────────────────

  const buildColMenu = (ci: number): MenuEntry[] => {
    const col = node.columns[ci];
    const items: MenuEntry[] = [];

    // ── この列 ──
    items.push({ group: col.label });
    items.push({ label: '編集', icon: '✏️', onClick: () => { setEditingColIdx(ci); setColDraft({ ...col }); }, indent: true });
    items.push({ label: '左に列を挿入', icon: '◀', onClick: () => insertColumnAt(ci, false), indent: true });
    items.push({ label: '右に列を挿入', icon: '▶', onClick: () => insertColumnAt(ci, true), indent: true });
    items.push({ label: '左へ移動', icon: '←', onClick: () => moveColumn(ci, 'left'), disabled: ci === 0, indent: true });
    items.push({ label: '右へ移動', icon: '→', onClick: () => moveColumn(ci, 'right'), disabled: ci === node.columns.length - 1, indent: true });
    items.push({ label: node.keyColumn === col.key ? 'キー設定を解除' : 'キー列に設定', icon: '🔑', onClick: () => update({ keyColumn: node.keyColumn === col.key ? undefined : col.key }), indent: true });
    items.push({ label: '昇順ソート', icon: '↑', onClick: () => sortRows(col.key, true), indent: true });
    items.push({ label: '降順ソート', icon: '↓', onClick: () => sortRows(col.key, false), indent: true });
    items.push({ label: 'この列を削除', icon: '🗑', onClick: () => { if (confirm(`列「${col.label}」を削除しますか？`)) removeColumn(col.key); }, danger: true, indent: true });

    items.push({ separator: true });

    // ── すべての列 ──
    items.push({ group: 'すべての列' });
    items.push({ label: '列を末尾に追加', icon: '➕', onClick: addColumn, indent: true });

    items.push({ separator: true });

    // ── テーブル ──
    items.push({ group: 'テーブル' });
    items.push({ label: '全行を初期化', icon: '🗑', onClick: () => { if (confirm('全行を削除しますか？')) update({ rows: [] }); }, danger: true, indent: true });
    items.push({ label: 'テーブルを全初期化', icon: '⚠️', onClick: () => { if (confirm('列・行をすべて削除しますか？')) update({ columns: [{ key: 'col_1', label: '列1', type: 'string' }], rows: [] }); }, danger: true, indent: true });

    return items;
  };

  const buildRowMenu = (ri: number): MenuEntry[] => {
    const items: MenuEntry[] = [];

    // ── この行 ──
    items.push({ group: `行 ${ri + 1}` });
    items.push({ label: '上に行を挿入', icon: '↑', onClick: () => insertRowAt(ri, false), indent: true });
    items.push({ label: '下に行を挿入', icon: '↓', onClick: () => insertRowAt(ri, true), indent: true });
    items.push({ label: '上へ移動', icon: '↑', onClick: () => moveRow(ri, 'up'), disabled: ri === 0, indent: true });
    items.push({ label: '下へ移動', icon: '↓', onClick: () => moveRow(ri, 'down'), disabled: ri === node.rows.length - 1, indent: true });
    items.push({ label: 'クリップボードを貼り付け', icon: '📋', onClick: () => handlePaste(ri), indent: true });
    items.push({ label: 'この行を削除', icon: '🗑', onClick: () => removeRows([ri]), danger: true, indent: true });

    items.push({ separator: true });

    // ── すべての行 ──
    items.push({ group: 'すべての行' });
    items.push({ label: '行を末尾に追加', icon: '➕', onClick: addRow, indent: true });
    items.push({ label: '全行を選択', icon: '☑', onClick: () => setSelectedRows(new Set(node.rows.map((_, i) => i))), indent: true });
    items.push({ label: '選択を解除', icon: '☐', onClick: () => setSelectedRows(new Set()), disabled: selectedRows.size === 0, indent: true });
    if (selectedRows.size > 0) {
      items.push({ label: `選択中の ${selectedRows.size} 行を削除`, icon: '🗑', onClick: () => removeRows([...selectedRows]), danger: true, indent: true });
    }
    items.push({ label: 'クリップボードから末尾に貼り付け', icon: '📋', onClick: () => handlePaste(), indent: true });

    items.push({ separator: true });

    // ── テーブル ──
    items.push({ group: 'テーブル' });
    items.push({ label: '全行を初期化', icon: '🗑', onClick: () => { if (confirm('全行を削除しますか？')) update({ rows: [] }); }, danger: true, indent: true });
    items.push({ label: 'テーブルを全初期化', icon: '⚠️', onClick: () => { if (confirm('列・行をすべて削除しますか？')) update({ columns: [{ key: 'col_1', label: '列1', type: 'string' }], rows: [] }); }, danger: true, indent: true });

    return items;
  };

  return (
    <div
      style={{ overflowX: 'auto', margin: '0.5rem 0' }}
      onContextMenu={e => { if (editMode) e.preventDefault(); }} // テーブル外への伝播を止める
    >
      <textarea
        ref={pasteRef}
        aria-label="クリップボード貼り付け用"
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
        onPaste={e => { e.preventDefault(); applyPaste(e.clipboardData.getData('text')); }}
      />

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.target.kind === 'col'
            ? buildColMenu(ctxMenu.target.colIdx)
            : buildRowMenu(ctxMenu.target.rowIdx)
          }
          onClose={() => setCtxMenu(null)}
        />
      )}

      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {/* 行ヘッダ列（チェックボックス） — 編集時のみ */}
            {editMode && <th style={{ ...thStyle, width: 28 }} />}
            {node.columns.map((col, ci) => (
              <th
                key={col.key}
                style={{ ...thStyle, cursor: editMode ? 'context-menu' : 'default' }}
                onContextMenu={e => openCtx(e, { kind: 'col', colIdx: ci })}
              >
                {editMode && editingColIdx === ci && colDraft ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <input
                      aria-label="列名"
                      value={colDraft.label}
                      onChange={e => setColDraft({ ...colDraft, label: e.target.value })}
                      style={{ width: 80, fontSize: 12 }}
                    />
                    <select
                      aria-label="列タイプ"
                      value={colDraft.type ?? 'string'}
                      onChange={e => setColDraft({ ...colDraft, type: e.target.value as ColumnDef['type'] })}
                      style={{ fontSize: 11 }}
                    >
                      <option value="string">文字列</option>
                      <option value="number">数値</option>
                      <option value="boolean">真偽値</option>
                      <option value="date">日付</option>
                    </select>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button type="button" className="btn-sm" onClick={() => {
                        const cols = node.columns.map((c, i) => i === ci ? colDraft : c);
                        update({ columns: cols });
                        setEditingColIdx(null); setColDraft(null);
                      }}>✓</button>
                      <button type="button" className="btn-sm" onClick={() => { setEditingColIdx(null); setColDraft(null); }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span
                      style={{ cursor: editMode ? 'pointer' : 'default', fontWeight: 600 }}
                      onClick={() => { if (editMode) { setEditingColIdx(ci); setColDraft({ ...col }); } }}
                      title={editMode ? '右クリックで列メニュー' : undefined}
                    >
                      {col.label}
                      {node.keyColumn === col.key && <span style={{ color: '#f59f00', marginLeft: 2 }}>🔑</span>}
                    </span>
                    {editMode && (
                      <>
                        <button type="button" className="btn-icon" onClick={() => moveColumn(ci, 'left')} title="左へ">◀</button>
                        <button type="button" className="btn-icon" onClick={() => moveColumn(ci, 'right')} title="右へ">▶</button>
                        <button type="button" className="btn-icon btn-danger" onClick={() => removeColumn(col.key)} title="削除">✕</button>
                      </>
                    )}
                  </div>
                )}
              </th>
            ))}
            {editMode && <th style={thStyle}>操作</th>}
          </tr>
        </thead>
        <tbody>
          {node.rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ background: selectedRows.has(ri) ? '#e7f5ff' : ri % 2 === 0 ? '#fff' : '#f8f9fa' }}
              onClick={e => toggleRowSelect(ri, e)}
            >
              {/* 行ヘッダ（チェックボックス）— 右クリックで行メニュー */}
              {editMode && (
                <td
                  style={{ ...tdStyle, cursor: 'context-menu', background: selectedRows.has(ri) ? '#d0ebff' : '#f8f9fa' }}
                  onContextMenu={e => openCtx(e, { kind: 'row', rowIdx: ri })}
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    aria-label={`行${ri + 1}を選択`}
                    checked={selectedRows.has(ri)}
                    onChange={() => {}}
                    onClick={e => { e.stopPropagation(); toggleRowSelect(ri, e as unknown as React.MouseEvent); }}
                  />
                </td>
              )}
              {node.columns.map(col => (
                <td
                  key={col.key}
                  style={{ ...tdStyle, cursor: editMode ? 'text' : 'default' }}
                  onContextMenu={e => openCtx(e, { kind: 'row', rowIdx: ri })}
                  onClick={e => { if (editMode) { e.stopPropagation(); setEditingCell({ row: ri, col: col.key }); } }}
                >
                  {editMode && editingCell?.row === ri && editingCell?.col === col.key ? (
                    <input
                      autoFocus
                      aria-label={col.label}
                      value={String(row[col.key] ?? '')}
                      onChange={e => setCellValue(ri, col.key, e.target.value)}
                      onBlur={() => setEditingCell(null)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null); }}
                      style={{ width: '100%', border: 'none', outline: '2px solid #3b5bdb', padding: '2px 4px', fontSize: 13 }}
                    />
                  ) : (
                    <span>{row[col.key] != null ? String(row[col.key]) : ''}</span>
                  )}
                </td>
              ))}
              {editMode && (
                <td style={tdStyle} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button type="button" className="btn-icon" onClick={() => moveRow(ri, 'up')}>↑</button>
                    <button type="button" className="btn-icon" onClick={() => moveRow(ri, 'down')}>↓</button>
                    <button type="button" className="btn-icon btn-danger" onClick={() => removeRows([ri])}>✕</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {node.rows.length === 0 && (
            <tr>
              <td
                colSpan={node.columns.length + (editMode ? 2 : 0)}
                style={{ ...tdStyle, textAlign: 'center', color: '#adb5bd' }}
                onContextMenu={e => { if (editMode) { e.preventDefault(); e.stopPropagation(); addRow(); } }}
              >
                データなし（右クリックで行を追加）
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  border: '1px solid #dee2e6',
  padding: '6px 10px',
  background: '#f1f3f5',
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  border: '1px solid #dee2e6',
  padding: '4px 8px',
  fontSize: 13,
  verticalAlign: 'top',
};
