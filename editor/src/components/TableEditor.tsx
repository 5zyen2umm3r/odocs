import React, { useState, useRef } from 'react';
import { TableNode, ColumnDef, CellValue } from '../types';
import { parseTsvToRows } from '../utils/nodeOps';

interface Props {
  node: TableNode;
  editMode: boolean;
  onChange?: (updated: TableNode) => void;
}

export const TableEditor: React.FC<Props> = ({ node, editMode, onChange }) => {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [colDraft, setColDraft] = useState<ColumnDef | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const update = (patch: Partial<TableNode>) => onChange?.({ ...node, ...patch });

  const addColumn = () => {
    const key = `col_${Date.now()}`;
    update({ columns: [...node.columns, { key, label: '新列', type: 'string' }] });
  };

  const removeColumn = (key: string) => {
    update({
      columns: node.columns.filter(c => c.key !== key),
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

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      applyPaste(text);
    } catch {
      pasteRef.current?.focus();
    }
  };

  const applyPaste = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return;

    // Check if first line looks like headers (all strings matching column labels)
    const firstCells = lines[0].split('\t').map(s => s.trim());
    const isHeader = firstCells.every(c => node.columns.some(col => col.label === c || col.key === c));
    const dataLines = isHeader ? lines.slice(1) : lines;

    // Determine target columns
    let targetCols = node.columns;
    if (isHeader) {
      targetCols = firstCells.map(c => node.columns.find(col => col.label === c || col.key === c) ?? { key: c, label: c, type: 'string' as const });
    }

    const newRows = parseTsvToRows(dataLines.join('\n'), targetCols);

    if (selectedRows.size > 0) {
      // Paste starting from first selected row
      const startIdx = Math.min(...selectedRows);
      const rows = [...node.rows];
      newRows.forEach((r, i) => {
        if (startIdx + i < rows.length) {
          rows[startIdx + i] = { ...rows[startIdx + i], ...r };
        } else {
          rows.push(r);
        }
      });
      update({ rows });
    } else if (isHeader && node.keyColumn) {
      // Full table paste with key: upsert
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
      // Append
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

  const selectAll = () => setSelectedRows(new Set(node.rows.map((_, i) => i)));
  const clearSelection = () => setSelectedRows(new Set());

  return (
    <div style={{ overflowX: 'auto', margin: '0.5rem 0' }}>
      {editMode && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <button className="btn-sm" onClick={addColumn}>+ 列追加</button>
          <button className="btn-sm" onClick={addRow}>+ 行追加</button>
          <button className="btn-sm" onClick={() => removeRows([...selectedRows])} disabled={selectedRows.size === 0}>選択行削除</button>
          <button className="btn-sm" onClick={selectAll}>全選択</button>
          <button className="btn-sm" onClick={clearSelection}>選択解除</button>
          <button className="btn-sm" onClick={handlePaste}>📋 貼り付け</button>
          <button className="btn-sm btn-danger" onClick={() => update({ rows: [] })}>行初期化</button>
          <button className="btn-sm btn-danger" onClick={() => update({ columns: [], rows: [] })}>全初期化</button>
          <select
            aria-label="ソート列と方向"
            className="btn-sm"
            style={{ minWidth: 80 }}
            defaultValue=""
            onChange={e => {
              const [col, dir] = e.target.value.split(':');
              if (col) sortRows(col, dir === 'asc');
              e.target.value = '';
            }}
          >
            <option value="">ソート...</option>
            {node.columns.map(c => (
              <React.Fragment key={c.key}>
                <option value={`${c.key}:asc`}>{c.label} ↑</option>
                <option value={`${c.key}:desc`}>{c.label} ↓</option>
              </React.Fragment>
            ))}
          </select>
          {/* Hidden textarea for paste fallback */}
          <textarea
            ref={pasteRef}
            aria-label="クリップボード貼り付け用"
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
            onPaste={e => { e.preventDefault(); applyPaste(e.clipboardData.getData('text')); }}
          />
        </div>
      )}

      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {editMode && <th style={thStyle}>#</th>}
            {node.columns.map((col, ci) => (
              <th key={col.key} style={thStyle}>
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
                      <button className="btn-sm" onClick={() => {
                        const cols = node.columns.map((c, i) => i === ci ? colDraft : c);
                        update({ columns: cols });
                        setEditingColIdx(null); setColDraft(null);
                      }}>✓</button>
                      <button className="btn-sm" onClick={() => { setEditingColIdx(null); setColDraft(null); }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span
                      style={{ cursor: editMode ? 'pointer' : 'default', fontWeight: 600 }}
                      onClick={() => { if (editMode) { setEditingColIdx(ci); setColDraft({ ...col }); } }}
                    >
                      {col.label}
                      {node.keyColumn === col.key && <span style={{ color: '#f59f00', marginLeft: 2 }}>🔑</span>}
                    </span>
                    {editMode && (
                      <>
                        <button className="btn-icon" onClick={() => moveColumn(ci, 'left')} title="左へ">◀</button>
                        <button className="btn-icon" onClick={() => moveColumn(ci, 'right')} title="右へ">▶</button>
                        <button className="btn-icon" onClick={() => {
                          update({ keyColumn: node.keyColumn === col.key ? undefined : col.key });
                        }} title="キー列に設定">🔑</button>
                        <button className="btn-icon btn-danger" onClick={() => removeColumn(col.key)} title="削除">✕</button>
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
              style={{ background: selectedRows.has(ri) ? '#e7f5ff' : ri % 2 === 0 ? '#fff' : '#f8f9fa', cursor: editMode ? 'pointer' : 'default' }}
              onClick={e => toggleRowSelect(ri, e)}
            >
              {editMode && (
                <td style={tdStyle}>
                  <input type="checkbox" aria-label={`行${ri + 1}を選択`} checked={selectedRows.has(ri)} onChange={() => {}} onClick={e => e.stopPropagation()} />
                </td>
              )}
              {node.columns.map(col => (
                <td key={col.key} style={tdStyle} onClick={e => { if (editMode) { e.stopPropagation(); setEditingCell({ row: ri, col: col.key }); } }}>
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
                    <button className="btn-icon" onClick={() => moveRow(ri, 'up')}>↑</button>
                    <button className="btn-icon" onClick={() => moveRow(ri, 'down')}>↓</button>
                    <button className="btn-icon btn-danger" onClick={() => removeRows([ri])}>✕</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {node.rows.length === 0 && (
            <tr><td colSpan={node.columns.length + (editMode ? 2 : 0)} style={{ ...tdStyle, textAlign: 'center', color: '#adb5bd' }}>データなし</td></tr>
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
