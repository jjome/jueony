import {saveSourceConflictMessage} from '../modules/document-files/public/index.ts';

type FileEditor = {
  fileHandle(): FileSystemFileHandle | null;
  open(bytes: Uint8Array, name: string, handle?: FileSystemFileHandle): Promise<void>;
  save(): Promise<string>;
};

type FileTab = {
  workspaceId: string;
  closed: boolean;
  initialized: boolean;
  api: FileEditor | null;
  handle?: FileSystemFileHandle;
};

type DocumentFileActionsOptions<Tab extends FileTab> = {
  currentWorkspace(): string;
  tabs(): readonly Tab[];
  activeTab(): Tab | undefined;
  allowOpen(): boolean;
  allowSave(): boolean;
  permission(handle: FileSystemFileHandle): Promise<boolean>;
  select(tab: Tab): void;
  create(workspaceId: string): Promise<Tab>;
  persist(tab: Tab): Promise<unknown>;
  status(message: string): void;
};

export function createDocumentFileActions<Tab extends FileTab>(options: DocumentFileActionsOptions<Tab>) {
  async function load(file: File, workspaceId: string, handle?: FileSystemFileHandle) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (options.currentWorkspace() !== workspaceId) return;
    const tab = await options.create(workspaceId);
    if (tab.closed || !tab.api) return;
    await tab.api.open(bytes, file.name, handle);
    if (handle) tab.handle = handle;
    await options.persist(tab);
    if (handle && options.activeTab() === tab) options.status('문서를 열었습니다.');
  }

  return {
    async openBound(handle: FileSystemFileHandle, workspaceId = options.currentWorkspace()) {
      if (options.currentWorkspace() !== workspaceId || !options.allowOpen()) return;
      const granted = await options.permission(handle);
      if (options.currentWorkspace() !== workspaceId) return;
      if (!granted) throw new Error('파일 접근 권한이 없습니다.');
      for (const tab of options.tabs()) {
        if (tab.workspaceId !== workspaceId || tab.closed) continue;
        const existing = tab.api?.fileHandle();
        if (!existing) continue;
        const same = await handle.isSameEntry(existing);
        if (options.currentWorkspace() !== workspaceId) return;
        if (same && !tab.closed && tab.api?.fileHandle() === existing) {
          options.select(tab);
          return;
        }
      }
      const file = await handle.getFile();
      if (options.currentWorkspace() !== workspaceId) return;
      if (file.size > 64 * 1024 * 1024) throw new Error('MVP 문서 열기는 64MB까지 지원합니다.');
      await load(file, workspaceId, handle);
    },
    async openFile(file: File, workspaceId = options.currentWorkspace()) {
      if (options.currentWorkspace() === workspaceId && options.allowOpen()) await load(file, workspaceId);
    },
    async saveActive() {
      if (!options.allowSave()) return;
      const tab = options.activeTab();
      if (!tab?.initialized || !tab.api || tab.closed) return;
      const result = await tab.api.save();
      await options.persist(tab);
      if (options.activeTab() !== tab || tab.closed) return;
      if (result === 'source-conflict') {
        options.status(saveSourceConflictMessage);
        return;
      }
      options.status(result === 'saved' ? '파일에 저장했습니다.' : '저장을 완료하지 않았습니다.');
    },
  };
}
