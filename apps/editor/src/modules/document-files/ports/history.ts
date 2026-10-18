export interface HistoryRecords {
  read(key: string): Promise<unknown>;
  /** Compare and replace in one durable transaction; check the loaded document before commit. */
  exchange(key: string, expected: unknown, value: unknown, assertOwner: () => void): Promise<void>;
}
export type HistoryScope = {windowScope: string; workspaceId: string; documentId: string};
export type HistoryOwner = {instance: string; revision: string; available: boolean};
export type HistoryMeta = {id: string; label: string; createdAt: number; sourceFileName: string; byteLength: number; storageKind: 'ir'};
