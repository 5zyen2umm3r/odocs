import { DocNode } from '../types';

const STORAGE_KEY = 'doc_editor_v1';

export interface StorageData {
  nodes: DocNode[];
  savedAt: string;
}

export function saveToStorage(nodes: DocNode[]): void {
  try {
    const data: StorageData = { nodes, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to localStorage', e);
  }
}

export function loadFromStorage(): StorageData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StorageData;
  } catch {
    return null;
  }
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
