import { DocNode, TreeNode } from '../types';

/**
 * Flat node list -> ordered children map using prevSiblingId linked list
 */
function orderChildren(nodes: DocNode[]): DocNode[] {
  if (nodes.length === 0) return [];

  // Build a map: prevSiblingId -> node
  const afterMap = new Map<string | null | undefined, DocNode>();
  for (const n of nodes) {
    afterMap.set(n.prevSiblingId ?? null, n);
  }

  const ordered: DocNode[] = [];
  let current: DocNode | undefined = afterMap.get(null);
  while (current) {
    ordered.push(current);
    current = afterMap.get(current.id);
  }

  // Fallback: append any nodes not reachable via linked list (broken refs)
  const orderedIds = new Set(ordered.map(n => n.id));
  for (const n of nodes) {
    if (!orderedIds.has(n.id)) ordered.push(n);
  }

  return ordered;
}

/**
 * Build tree from flat node array.
 * Returns array of root TreeNodes (parentId == null/undefined).
 */
export function buildTree(nodes: DocNode[]): TreeNode[] {
  const byParent = new Map<string | null, DocNode[]>();
  for (const n of nodes) {
    const key = n.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }

  function buildChildren(parentId: string | null, parentIndex: string): TreeNode[] {
    const children = byParent.get(parentId) ?? [];
    const ordered = orderChildren(children);

    let autoCounter = 1;
    return ordered.map((node) => {
      let label: string;
      if (node.index != null && node.index !== '') {
        // manual index: parse as number if possible
        const parsed = parseInt(node.index, 10);
        if (!isNaN(parsed)) {
          autoCounter = parsed + 1;
          label = parentIndex ? `${parentIndex}.${node.index}` : node.index;
        } else {
          label = parentIndex ? `${parentIndex}.${node.index}` : node.index;
          autoCounter++;
        }
      } else {
        const idx = autoCounter++;
        label = parentIndex ? `${parentIndex}.${idx}` : String(idx);
      }

      const treeNode: TreeNode = {
        node,
        children: buildChildren(node.id, label),
        indexLabel: label,
      };
      return treeNode;
    });
  }

  return buildChildren(null, '');
}

/** Flatten tree back to ordered array */
export function flattenTree(roots: TreeNode[]): DocNode[] {
  const result: DocNode[] = [];
  function walk(nodes: TreeNode[]) {
    for (const tn of nodes) {
      result.push(tn.node);
      walk(tn.children);
    }
  }
  walk(roots);
  return result;
}

/** Collect all TreeNodes into a flat list */
export function flattenTreeNodes(roots: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(nodes: TreeNode[]) {
    for (const tn of nodes) {
      result.push(tn);
      walk(tn.children);
    }
  }
  walk(roots);
  return result;
}

/** Get all root nodes (parentId == null) */
export function getRoots(nodes: DocNode[]): DocNode[] {
  return nodes.filter(n => !n.parentId);
}
