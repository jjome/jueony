import type { SessionFacade } from '../public/contracts.ts';
import type { SessionLifecyclePort, SessionStatePort } from '../ports/lifecycle.ts';
import { openedOrder, ownerOf, preferredTab, recoverOrder, selectableTab } from '../domain/tabs.ts';

export function createSessionFacade(options: { state: SessionStatePort; lifecycle: SessionLifecyclePort }): SessionFacade {
  const owner = (id: string) => ownerOf(options.state.workspaces(), id);
  return {
    opened(tab) {
      const order = openedOrder(owner(tab.workspaceId), tab, options.state.tabs());
      options.lifecycle.setOrder(tab.workspaceId, order);
    },
    canSelect(tabId) {
      return Boolean(selectableTab(options.state.tabs(), options.state.activeWorkspaceId(), tabId));
    },
    select(tabId) {
      const workspaceId = options.state.activeWorkspaceId();
      if (!selectableTab(options.state.tabs(), workspaceId, tabId)) return false;
      owner(workspaceId);
      options.lifecycle.setActiveDocument(workspaceId, tabId);
      return true;
    },
    closed(tab) {
      const workspace = owner(tab.workspaceId);
      // Confirm that the shell finished its close transaction before bookkeeping.
      if (options.state.tabs().some(item => item.id === tab.id && !item.closed)) throw new Error('문서 닫기를 완료한 뒤 탭 순서를 갱신해 주세요.');
      options.lifecycle.setOrder(tab.workspaceId, (workspace.documentOrder ?? []).filter(id => id !== tab.id));
      // Existing UI chooses the first surviving tab after every successful close.
      const next = preferredTab(options.state.tabs(), options.state.activeWorkspaceId());
      if (tab.workspaceId === options.state.activeWorkspaceId()) options.lifecycle.setActiveDocument(tab.workspaceId, next);
      else if (workspace.activeDocumentId === tab.id) options.lifecycle.setActiveDocument(tab.workspaceId, undefined);
      return next;
    },
    preferred(workspaceId: string, ...previousIds: [string?]) {
      const workspace = owner(workspaceId);
      // During restore, opening each iframe temporarily selects it. An explicitly
      // missing persisted selection must still fall back to the first restored tab.
      const previousId = previousIds.length ? previousIds[0] : workspace.activeDocumentId;
      return preferredTab(options.state.tabs(), workspaceId, previousId);
    },
    restore(workspaceId, records) { return recoverOrder(owner(workspaceId), records); },
  };
}
