import { DocNode, NodeType, CellValue, ColumnDef } from '../types';

let _idCounter = Date.now();
export function genId(): string {
  return `node_${(_idCounter++).toString(36)}`;
}

/** Create a new node with defaults */
export function createNode(
  type: NodeType,
  parentId: string | null,
  prevSiblingId: string | null
): DocNode {
  const base = {
    id: genId(),
    parentId,
    prevSiblingId,
    title: '新しい項目',
    text: '',
    enabled: true,
    index: null,
  };
  if (type === 'text') return { ...base, type: 'text' };
  if (type === 'metadata') return { ...base, type: 'metadata', date: new Date().toISOString().slice(0, 10), user: '' };
  if (type === 'image') return { ...base, type: 'image', imageUrl: '' };
  return { ...base, type: 'table', columns: [], rows: [], keyColumn: undefined };
}

/** Update a node in the list */
export function updateNode(nodes: DocNode[], updated: DocNode): DocNode[] {
  return nodes.map(n => n.id === updated.id ? updated : n);
}

/** Delete a node and all its descendants, fix sibling refs */
export function deleteNode(nodes: DocNode[], id: string): DocNode[] {
  // Collect all descendant ids
  const toDelete = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    toDelete.add(cur);
    nodes.filter(n => n.parentId === cur).forEach(n => queue.push(n.id));
  }

  // Find the node being deleted to fix sibling chain
  const target = nodes.find(n => n.id === id);
  if (target) {
    // The node after target (prevSiblingId === id) should point to target's prev
    nodes = nodes.map(n => {
      if (n.prevSiblingId === id) {
        return { ...n, prevSiblingId: target.prevSiblingId ?? null };
      }
      return n;
    });
  }

  return nodes.filter(n => !toDelete.has(n.id));
}

/** Move node: change its position in sibling order */
export function moveNode(nodes: DocNode[], id: string, direction: 'up' | 'down'): DocNode[] {
  const node = nodes.find(n => n.id === id);
  if (!node) return nodes;

  const siblings = nodes.filter(n => (n.parentId ?? null) === (node.parentId ?? null));
  // Build ordered siblings
  const ordered = orderSiblings(siblings);
  const idx = ordered.findIndex(n => n.id === id);
  if (direction === 'up' && idx === 0) return nodes;
  if (direction === 'down' && idx === ordered.length - 1) return nodes;

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  // Swap positions by rebuilding prevSiblingId chain
  const newOrdered = [...ordered];
  [newOrdered[idx], newOrdered[swapIdx]] = [newOrdered[swapIdx], newOrdered[idx]];

  // Rebuild prevSiblingId for affected nodes
  let updated = [...nodes];
  for (let i = 0; i < newOrdered.length; i++) {
    const prev = i === 0 ? null : newOrdered[i - 1].id;
    updated = updated.map(n => n.id === newOrdered[i].id ? { ...n, prevSiblingId: prev } : n);
  }
  // Fix the node after the last in original that pointed to one of the swapped
  return updated;
}

function orderSiblings(siblings: DocNode[]): DocNode[] {
  if (siblings.length === 0) return [];
  const afterMap = new Map<string | null | undefined, DocNode>();
  for (const n of siblings) afterMap.set(n.prevSiblingId ?? null, n);
  const ordered: DocNode[] = [];
  let cur: DocNode | undefined = afterMap.get(null);
  while (cur) {
    ordered.push(cur);
    cur = afterMap.get(cur.id);
  }
  const orderedIds = new Set(ordered.map(n => n.id));
  for (const n of siblings) if (!orderedIds.has(n.id)) ordered.push(n);
  return ordered;
}

/** Parse clipboard TSV (Excel paste) into rows */
export function parseTsvToRows(tsv: string, columns: ColumnDef[]): Record<string, CellValue>[] {
  const lines = tsv.trim().split('\n');
  return lines.map(line => {
    const cells = line.split('\t');
    const row: Record<string, CellValue> = {};
    columns.forEach((col, i) => {
      const raw = cells[i]?.trim() ?? '';
      if (col.type === 'number') {
        const n = parseFloat(raw);
        row[col.key] = isNaN(n) ? raw : n;
      } else if (col.type === 'boolean') {
        row[col.key] = raw === 'true' || raw === '1' || raw === 'TRUE';
      } else {
        row[col.key] = raw;
      }
    });
    return row;
  });
}
