import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DocNode, AppMode } from './types';
import { saveToStorage, loadFromStorage } from './utils/storage';
import { exportToHtml } from './utils/export';
import { createNode } from './utils/nodeOps';
import { DocumentView } from './components/DocumentView';

// ===== Sample data for first load =====
function createSampleData(): DocNode[] {
  const root1 = createNode('text', null, null);
  Object.assign(root1, { title: '運用設計ドキュメント', text: 'システムの運用・保守作業項目を実アプリの運用に落とし込んだ設計ドキュメントです。' });

  const meta = createNode('metadata', root1.id, null);
  Object.assign(meta, { title: '文書情報', date: new Date().toISOString().slice(0, 10), user: '管理者' });

  const sec1 = createNode('text', root1.id, meta.id);
  Object.assign(sec1, { title: '1. システム概要', text: 'システムの全体構成と運用方針を記述します。' });

  const sec1_1 = createNode('text', sec1.id, null);
  Object.assign(sec1_1, { title: 'システム構成', text: 'アプリケーションサーバ、DBサーバ、バッチサーバの3層構成。' });

  const sec2 = createNode('text', root1.id, sec1.id);
  Object.assign(sec2, { title: '2. 定期メンテナンス', text: '定期的なメンテナンス作業の手順と担当者を定義します。' });

  const tbl = createNode('table', sec2.id, null);
  Object.assign(tbl, {
    title: 'メンテナンス作業一覧',
    columns: [
      { key: 'task', label: '作業名', type: 'string' },
      { key: 'cycle', label: '周期', type: 'string' },
      { key: 'owner', label: '担当', type: 'string' },
      { key: 'enabled', label: '有効', type: 'boolean' },
    ],
    keyColumn: 'task',
    rows: [
      { task: 'DBバックアップ', cycle: '毎日', owner: 'インフラ担当', enabled: true },
      { task: 'ログローテーション', cycle: '週次', owner: 'インフラ担当', enabled: true },
      { task: 'セキュリティパッチ適用', cycle: '月次', owner: 'セキュリティ担当', enabled: true },
    ],
  });

  const sec3 = createNode('text', root1.id, sec2.id);
  Object.assign(sec3, { title: '3. 障害対応', text: '障害発生時の対応フローを定義します。', disabled: true });

  const root2 = createNode('text', null, root1.id);
  Object.assign(root2, { title: 'バッチ処理 運用設計', text: 'バッチ処理の運用設計ドキュメントです。' });

  const b1 = createNode('text', root2.id, null);
  Object.assign(b1, { title: 'バッチ一覧', text: '定期実行バッチの一覧と実行スケジュール。' });

  return [root1, meta, sec1, sec1_1, sec2, tbl, sec3, root2, b1];
}

export default function App() {
  const [nodes, setNodes] = useState<DocNode[]>([]);
  const [mode, setMode] = useState<AppMode>('view');
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [exportRootId, setExportRootId] = useState<string>('all');
  const [restored, setRestored] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Load from storage or sample
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      // 旧フォーマット互換: enabled: false → disabled: true
      const migrated = saved.nodes.map((n: DocNode & { enabled?: boolean }) => {
        const { enabled, ...rest } = n as DocNode & { enabled?: boolean };
        if (enabled === false) return { ...rest, disabled: true };
        if (enabled === true) { const r = { ...rest }; delete (r as { disabled?: boolean }).disabled; return r; }
        return rest;
      }) as DocNode[];
      setNodes(migrated);
      setRestored(true);
    } else {
      setNodes(createSampleData());
    }
  }, []);

  // Auto-save
  useEffect(() => {
    if (nodes.length > 0) saveToStorage(nodes);
  }, [nodes]);

  // Compute roots
  const roots = nodes.filter(n => !n.parentId);

  // Set default active root
  useEffect(() => {
    if (roots.length > 0 && (!activeRootId || !roots.find(r => r.id === activeRootId))) {
      setActiveRootId(roots[0].id);
    }
  }, [roots.length]);

  const handleNodesChange = useCallback((updated: DocNode[]) => {
    setNodes(updated);
  }, []);

  // Drag & drop JSON
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith('.json')) return alert('JSONファイルをドロップしてください');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const raw: DocNode[] = Array.isArray(data) ? data : data.nodes ?? [];
        if (raw.length === 0) return alert('有効なノードデータが見つかりません');
        // 旧フォーマット互換: enabled: false → disabled: true に変換
        const arr = raw.map((n: DocNode & { enabled?: boolean }) => {
          const { enabled, ...rest } = n as DocNode & { enabled?: boolean };
          if (enabled === false) return { ...rest, disabled: true };
          if (enabled === true) { const r = { ...rest }; delete (r as { disabled?: boolean }).disabled; return r; }
          return rest;
        }) as DocNode[];
        if (confirm('現在のデータを置き換えますか？（キャンセルで追加）')) {
          setNodes(arr);
        } else {
          setNodes(prev => [...prev, ...arr]);
        }
      } catch {
        alert('JSONの解析に失敗しました');
      }
    };
    reader.readAsText(file);
  };

  // Export HTML
  const handleExportHtml = () => {
    if (!activeRootId) return;
    const root = nodes.find(n => n.id === activeRootId);
    if (!root) return;
    const html = exportToHtml(nodes, activeRootId, root.title);
    downloadFile(html, `${root.title}.html`, 'text/html');
  };

  // Export JSON
  const handleExportJson = () => {
    let exportNodes: DocNode[];
    if (exportRootId === 'all') {
      exportNodes = nodes;
    } else {
      const inScope = new Set<string>([exportRootId]);
      const queue = [exportRootId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const n of nodes) {
          if (n.parentId === cur) { inScope.add(n.id); queue.push(n.id); }
        }
      }
      exportNodes = nodes.filter(n => inScope.has(n.id));
    }
    const root = nodes.find(n => n.id === exportRootId);
    const filename = exportRootId === 'all' ? 'docs.json' : `${root?.title ?? 'export'}.json`;
    downloadFile(JSON.stringify(exportNodes, null, 2), filename, 'application/json');
  };

  const addRootNode = () => {
    const lastRoot = roots[roots.length - 1];
    const newRoot = createNode('text', null, lastRoot?.id ?? null);
    Object.assign(newRoot, { title: '新しいドキュメント' });
    setNodes(prev => [...prev, newRoot]);
    setActiveRootId(newRoot.id);
  };

  const deleteRootNode = (rootId: string) => {
    const root = nodes.find(n => n.id === rootId);
    if (!root) return;
    if (!confirm(`ドキュメント「${root.title}」を削除しますか？\n（配下の全項目も削除されます）`)) return;
    // Collect all descendants
    const toDelete = new Set<string>();
    const queue = [rootId];
    while (queue.length) {
      const cur = queue.shift()!;
      toDelete.add(cur);
      nodes.filter(n => n.parentId === cur).forEach(n => queue.push(n.id));
    }
    // Fix prevSiblingId chain for root siblings
    const updated = nodes
      .map(n => {
        if (n.prevSiblingId === rootId) return { ...n, prevSiblingId: root.prevSiblingId ?? null };
        return n;
      })
      .filter(n => !toDelete.has(n.id));
    setNodes(updated);
    if (activeRootId === rootId) {
      const remaining = updated.filter(n => !n.parentId);
      setActiveRootId(remaining[0]?.id ?? null);
    }
  };

  return (
    <div
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        minHeight: '100vh',
        background: isDragging ? '#e7f5ff' : '#f8f9fa',
        transition: 'background 0.2s',
        fontFamily: "'Segoe UI', 'Hiragino Sans', sans-serif",
      }}
    >
      {/* Top bar */}
      <header style={{
        background: '#1a1a2e',
        color: '#fff',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <span style={{ fontWeight: 700, fontSize: 16, marginRight: 8 }}>📄 Doc</span>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#2c2c54', borderRadius: 6, overflow: 'hidden' }}>
          {(['view', 'edit'] as AppMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '4px 14px',
                border: 'none',
                background: mode === m ? '#3b5bdb' : 'transparent',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: mode === m ? 600 : 400,
              }}
            >
              {m === 'view' ? '👁 閲覧' : '✏️ 編集'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Export controls */}
        {mode === 'edit' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select
              aria-label="出力範囲"
              value={exportRootId}
              onChange={e => setExportRootId(e.target.value)}
              style={{ fontSize: 12, padding: '3px 6px', borderRadius: 4, border: '1px solid #4a4a7a', background: '#2c2c54', color: '#fff' }}
            >
              <option value="all">全ドキュメント</option>
              {roots.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
            <button className="btn-header" onClick={handleExportJson}>⬇ JSON出力</button>
          </div>
        )}
        {activeRootId && (
          <button className="btn-header" onClick={handleExportHtml}>⬇ HTML出力</button>
        )}

        <span style={{ fontSize: 11, color: '#868e96' }}>JSONをドロップして読み込み</span>
      </header>

      {/* Restore notice */}
      {restored && (
        <div style={{ background: '#fff3cd', padding: '6px 1.5rem', fontSize: 13, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>💾 前回の編集内容を復元しました</span>
          <button
            style={{ fontSize: 12, padding: '2px 8px', border: '1px solid #ffc107', borderRadius: 4, background: 'transparent', cursor: 'pointer' }}
            onClick={() => { if (confirm('復元データを破棄してサンプルデータを読み込みますか？')) { setNodes(createSampleData()); setRestored(false); } }}
          >
            リセット
          </button>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }} onClick={() => setRestored(false)}>✕</button>
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(59,91,219,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, pointerEvents: 'none',
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '2rem 3rem', fontSize: 18, fontWeight: 600, color: '#3b5bdb', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            JSONファイルをドロップ
          </div>
        </div>
      )}

      <div style={{ display: 'flex', maxWidth: 1200, margin: '0 auto', padding: '0 1rem' }}>
        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #dee2e6', marginTop: '1rem', flexWrap: 'wrap' }}>
            {roots.map(root => (
              <div
                key={root.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: activeRootId === root.id ? '2px solid #3b5bdb' : '2px solid transparent',
                  marginBottom: -2,
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveRootId(root.id)}
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: activeRootId === root.id ? 700 : 400,
                    color: activeRootId === root.id ? '#3b5bdb' : '#495057',
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {root.title}
                </button>
                {mode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => deleteRootNode(root.id)}
                    title="このドキュメントを削除"
                    style={{
                      padding: '2px 5px',
                      marginRight: 4,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#adb5bd',
                      fontSize: 13,
                      lineHeight: 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#c92a2a')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#adb5bd')}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {mode === 'edit' && (
              <button
                type="button"
                onClick={addRootNode}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#868e96',
                  fontSize: 14,
                }}
                title="新しいドキュメントを追加"
              >
                + 追加
              </button>
            )}
          </div>

          {/* Document */}
          {activeRootId && (
            <div style={{ background: '#fff', borderRadius: '0 0 8px 8px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minHeight: 400 }}>
              <DocumentView
                rootId={activeRootId}
                allNodes={nodes}
                editMode={mode === 'edit'}
                onNodesChange={handleNodesChange}
              />
            </div>
          )}

          {roots.length === 0 && (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#adb5bd' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
              <div>JSONファイルをドロップするか、編集モードでドキュメントを追加してください</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
