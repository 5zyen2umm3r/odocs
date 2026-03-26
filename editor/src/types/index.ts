// ===== Base Node =====
export interface BaseNode {
  id: string;
  parentId?: string | null;
  prevSiblingId?: string | null;
  title: string;
  text?: string;
  enabled: boolean;
  index?: string | null; // manual index override
  type: NodeType;
}

export type NodeType = 'text' | 'metadata' | 'image' | 'table';

// ===== Text Node =====
export interface TextNode extends BaseNode {
  type: 'text';
}

// ===== Metadata Node =====
export interface MetadataNode extends BaseNode {
  type: 'metadata';
  date?: string;
  user?: string;
}

// ===== Image Node =====
export interface ImageNode extends BaseNode {
  type: 'image';
  imageUrl?: string;
}

// ===== Table Node =====
export type CellValue = string | number | boolean | null;

export interface ColumnDef {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'boolean' | 'date';
}

export interface TableNode extends BaseNode {
  type: 'table';
  columns: ColumnDef[];
  rows: Record<string, CellValue>[];
  keyColumn?: string; // key column for upsert
}

export type DocNode = TextNode | MetadataNode | ImageNode | TableNode;

// ===== Tree structure =====
export interface TreeNode {
  node: DocNode;
  children: TreeNode[];
  indexLabel: string; // computed e.g. "1.2.3"
}

// ===== App mode =====
export type AppMode = 'view' | 'edit';
