import type { RecoveryDescriptor, SessionTab, SessionWorkspace } from '../public/contracts.ts';
import { orderRecoveredDocuments } from './document-order.ts';

export function ownerOf(workspaces: readonly SessionWorkspace[], workspaceId: string): SessionWorkspace {
  const owner = workspaces.find(workspace => workspace.id === workspaceId);
  if (!owner) throw new Error('문서의 업무를 찾을 수 없습니다.');
  return owner;
}
export function selectableTab(tabs: readonly SessionTab[], workspaceId: string, tabId: string): SessionTab | undefined {
  const matches = tabs.filter(tab => tab.id === tabId && !tab.closed);
  return matches.length === 1 && matches[0].workspaceId === workspaceId ? matches[0] : undefined;
}
export function preferredTab(tabs: readonly SessionTab[], workspaceId: string, previousId?: string): string | undefined {
  const previous = previousId ? selectableTab(tabs, workspaceId, previousId) : undefined;
  return previous?.id ?? tabs.find(tab => tab.workspaceId === workspaceId && !tab.closed)?.id;
}
export function openedOrder(owner: SessionWorkspace, tab: SessionTab, tabs: readonly SessionTab[]): string[] {
  if (!tab.id || tab.closed || tab.workspaceId !== owner.id) throw new Error('이 업무에 문서 탭을 추가할 수 없습니다.');
  const matches = tabs.filter(item => item.id === tab.id && !item.closed);
  if (matches.length !== 1 || matches[0].workspaceId !== tab.workspaceId) throw new Error('문서 탭 식별자가 중복되었거나 등록되지 않았습니다.');
  const order = owner.documentOrder ?? [];
  return order.includes(tab.id) ? [...order] : [...order, tab.id];
}
export function recoverOrder<T extends RecoveryDescriptor>(owner: SessionWorkspace, records: T[]): T[] {
  const ids = new Set<string>();
  for (const record of records) {
    if (!record.id || record.workspaceId !== owner.id) throw new Error('다른 업무의 문서를 복원할 수 없습니다.');
    if (ids.has(record.id)) throw new Error('복원 문서 식별자가 중복되었습니다. 기존 복구본은 보존합니다.');
    ids.add(record.id);
  }
  return orderRecoveredDocuments(records, owner.documentOrder);
}
