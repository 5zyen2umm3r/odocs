import { TreeNode, DocNode, TableNode, ImageNode, MetadataNode } from '../types';
import { buildTree } from './tree';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderNode(tn: TreeNode, depth: number): string {
  const { node, children, indexLabel } = tn;
  const hLevel = Math.min(depth + 1, 6);
  const titleHtml = `<h${hLevel} id="node-${node.id}"><span class="index-label">${escapeHtml(indexLabel)}</span> ${escapeHtml(node.title)}</h${hLevel}>`;

  let bodyHtml = '';

  if (node.type === 'metadata') {
    const m = node as MetadataNode;
    bodyHtml += `<div class="metadata">`;
    if (m.date) bodyHtml += `<span class="meta-date">📅 ${escapeHtml(m.date)}</span>`;
    if (m.user) bodyHtml += `<span class="meta-user">👤 ${escapeHtml(m.user)}</span>`;
    bodyHtml += `</div>`;
  }

  if (node.text) {
    bodyHtml += `<div class="node-text">${escapeHtml(node.text).replace(/\n/g, '<br>')}</div>`;
  }

  if (node.type === 'image') {
    const img = node as ImageNode;
    if (img.imageUrl) {
      bodyHtml += `<div class="node-image"><img src="${escapeHtml(img.imageUrl)}" alt="${escapeHtml(node.title)}"></div>`;
    }
  }

  if (node.type === 'table') {
    const tbl = node as TableNode;
    bodyHtml += `<table class="node-table"><thead><tr>`;
    for (const col of tbl.columns) {
      bodyHtml += `<th>${escapeHtml(col.label)}</th>`;
    }
    bodyHtml += `</tr></thead><tbody>`;
    for (const row of tbl.rows) {
      bodyHtml += `<tr>`;
      for (const col of tbl.columns) {
        const val = row[col.key];
        bodyHtml += `<td>${val != null ? escapeHtml(String(val)) : ''}</td>`;
      }
      bodyHtml += `</tr>`;
    }
    bodyHtml += `</tbody></table>`;
  }

  if (!node.enabled) {
    // disabled: show title+text only, no children
    return `<section class="doc-node disabled" data-depth="${depth}">${titleHtml}${bodyHtml}<p class="disabled-notice">[この項目は無効です]</p></section>`;
  }

  let childrenHtml = '';
  for (const child of children) {
    childrenHtml += renderNode(child, depth + 1);
  }

  return `<section class="doc-node" data-depth="${depth}">${titleHtml}${bodyHtml}${childrenHtml}</section>`;
}

function buildToc(roots: TreeNode[]): string {
  function tocList(nodes: TreeNode[]): string {
    if (nodes.length === 0) return '';
    let html = '<ul>';
    for (const tn of nodes) {
      html += `<li><a href="#node-${tn.node.id}">${escapeHtml(tn.indexLabel)} ${escapeHtml(tn.node.title)}</a>`;
      if (tn.node.enabled && tn.children.length > 0) {
        html += tocList(tn.children);
      }
      html += '</li>';
    }
    html += '</ul>';
    return html;
  }
  return `<nav class="toc"><h2>目次</h2>${tocList(roots)}</nav>`;
}

export function exportToHtml(nodes: DocNode[], rootId: string, rootTitle: string): string {
  const rootNode = nodes.find(n => n.id === rootId);

  // 子孫ノードのみでツリーを構築（rootを除外）、parentIdをnullに差し替えて渡す
  const inScope = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of nodes) {
      if (n.parentId === cur) { inScope.add(n.id); queue.push(n.id); }
    }
  }
  const childNodes = nodes
    .filter(n => inScope.has(n.id))
    .map(n => n.parentId === rootId ? { ...n, parentId: null } : n);
  const tree = buildTree(childNodes);

  // 表紙用メタデータ
  const coverMeta = nodes.find(n => n.parentId === rootId && n.type === 'metadata') as MetadataNode | undefined;

  // 表紙HTML
  let coverHtml = `<div class="cover">`;
  coverHtml += `<h1>${escapeHtml(rootTitle)}</h1>`;
  if (rootNode?.text) {
    coverHtml += `<div class="cover-text">${escapeHtml(rootNode.text).replace(/\n/g, '<br>')}</div>`;
  }
  if (coverMeta) {
    coverHtml += `<div class="cover-meta">`;
    if (coverMeta.date) coverHtml += `<span>📅 ${escapeHtml(coverMeta.date)}</span>`;
    if (coverMeta.user) coverHtml += `<span>👤 ${escapeHtml(coverMeta.user)}</span>`;
    coverHtml += `</div>`;
  }
  coverHtml += `</div>`;

  const toc = buildToc(tree);
  let body = '';
  for (const tn of tree) {
    body += renderNode(tn, 1);
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(rootTitle)}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; color: #1a1a2e; }
  .cover { border-bottom: 2px solid #3b5bdb; margin-bottom: 2rem; padding-bottom: 1.5rem; }
  .cover h1 { margin: 0 0 0.5rem; font-size: 1.8rem; }
  .cover-text { white-space: pre-wrap; color: #495057; line-height: 1.7; margin: 0.5rem 0; }
  .cover-meta { display: flex; gap: 1rem; font-size: 0.85em; color: #868e96; margin-top: 0.75rem; }
  .toc { background: #f0f4ff; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
  .toc ul { margin: 0.25rem 0; padding-left: 1.5rem; }
  .toc a { color: #3b5bdb; text-decoration: none; }
  .toc a:hover { text-decoration: underline; }
  .index-label { color: #868e96; font-size: 0.9em; }
  .doc-node { margin: 1rem 0; padding-left: 1rem; border-left: 3px solid #e9ecef; }
  .doc-node[data-depth="1"] { border-left-color: #3b5bdb; }
  .doc-node[data-depth="2"] { border-left-color: #7950f2; }
  .doc-node.disabled { opacity: 0.5; }
  .disabled-notice { color: #adb5bd; font-style: italic; font-size: 0.85em; }
  .node-text { white-space: pre-wrap; margin: 0.5rem 0; line-height: 1.7; }
  .metadata { display: flex; gap: 1rem; font-size: 0.85em; color: #868e96; margin: 0.5rem 0; }
  .node-image img { max-width: 100%; border-radius: 4px; }
  .node-table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
  .node-table th, .node-table td { border: 1px solid #dee2e6; padding: 0.5rem 0.75rem; text-align: left; }
  .node-table th { background: #f1f3f5; font-weight: 600; }
  h2 { color: #2c2c54; } h3 { color: #3d3d6b; } h4,h5,h6 { color: #555; }
</style>
</head>
<body>
${coverHtml}
${toc}
${body}
</body>
</html>`;
}

