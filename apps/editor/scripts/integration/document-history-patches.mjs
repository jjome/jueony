import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
function once(source,before,after,label){if(source.split(before).length!==2)throw Error('Document history integration drift: '+label);return source.replace(before,after);}
/** Preserve upstream comparison UI; replace only persistence and async ownership boundaries. */
export async function applyDocumentHistoryPatches({root}){
 const shim=`import type {CompareDocumentSnapshot} from '@/compare/types';
import {openDocumentHistory} from '@/jueony/adapters/browser/document-history-context.ts';
export function createHistorySession(){const store=openDocumentHistory();return{...store,async getPayload(id:string){const snapshot=await store.get(id);return snapshot?{kind:'ir' as const,snapshot:snapshot as CompareDocumentSnapshot}:null;}};}
`;
 await writeFile(join(root,'src/history/idb-store.ts'),shim);
 const path=join(root,'src/ui/history-dialog.ts');let source=(await readFile(path,'utf8')).replace(/\r\n/g,'\n');
 source=once(source,"import { clearHistory, deleteHistorySnapshot, getHistoryPayload, listHistoryMeta, saveHistoryIrSnapshot } from '@/history/idb-store';","import { createHistorySession } from '@/history/idb-store';",'store facade');
 source=once(source,'  private entries: DocHistoryEntryMeta[] = [];','  private entries: DocHistoryEntryMeta[] = [];\n  private history!: ReturnType<typeof createHistorySession>;\n  private historyError(error:unknown):void { if(this._open) this.resultMetaEl.textContent = error instanceof Error ? error.message : String(error); }','session');
 source=once(source,'    if (this._open) return;\n    this._open = true;','    if (this._open) return;\n    this.history = createHistorySession();\n    this.selectedId = null;\n    this._open = true;','trusted host scope');
 source=once(source,'    void this.refreshList();','    void this.refreshList().catch(error=>this.historyError(error));','initial read failure');
 source=once(source,"      t('dialog.history.hint.text');","      '현재 업무·문서·창의 이력만 보관합니다. 최근 최대 24개이며 문서 한 개당 총 32MiB까지 보관합니다. 다른 문서와 이전 공용 저장소의 이력은 불러오거나 삭제하지 않습니다.';",'scope disclosure');
 for(const method of ['onSaveSnapshot','onDeleteSelected','onClearAll','onCompareWithCurrent']) source=once(source,`() => void this.${method}()`,`() => void this.${method}().catch(error=>this.historyError(error))`,method+' errors');
 source=once(source,'    this.entries = await listHistoryMeta();','    const history=this.history, entries=await history.list();\n    if(!this._open || this.history!==history)return;\n    this.entries = entries;','read scope CAS');
 source=once(source,'      await saveHistoryIrSnapshot(label, wasm.fileName, snap);','      const history=this.history; await history.save(label, wasm.fileName, snap);\n      if(!this._open || this.history!==history)return;','save completion');
 source=once(source,'    await deleteHistorySnapshot(this.selectedId);','    const history=this.history; await history.remove(this.selectedId);\n    if(!this._open || this.history!==history)return;','delete completion');
 source=once(source,'    await clearHistory();','    const history=this.history; await history.clear();\n    if(!this._open || this.history!==history)return;','scope-only clear');
 source=once(source,'    const payload = await getHistoryPayload(this.selectedId);','    const history=this.history, payload=await history.getPayload(this.selectedId);\n    if(!this._open || this.history!==history)return;\n    history.assertCurrent();','compare read');
 const legacyStart=source.indexOf("      if (payload.kind === 'ir') {");const legacyEnd=source.indexOf("      console.log('[rhwp:history] 최종 Diff 배열', session.diffItems);",legacyStart);
 if(legacyStart<0||legacyEnd<0)throw Error('History legacy compare integration drift');
 source=source.slice(0,legacyStart)+"      const rightSnap = buildSnapshotFromWasm(wasm, rightName, HISTORY_COMPARE_OPTS);\n      session = compareSnapshots(payload.snapshot, rightSnap, HISTORY_COMPARE_OPTS);\n      history.assertCurrent();\n"+source.slice(legacyEnd+"      console.log('[rhwp:history] 최종 Diff 배열', session.diffItems);\n".length);
 source=once(source,'        this.compareSessionStore.gotoDiff(idx);','        try { this.history.assertCurrent(); } catch(error) { this.historyError(error); return; }\n        this.compareSessionStore.gotoDiff(idx);','stale anchors');
 await writeFile(path,source);
 const commandsPath=join(root,'src/command/commands/edit.ts');let commands=(await readFile(commandsPath,'utf8')).replace(/\r\n/g,'\n');
 commands="import {documentHistoryAvailable} from '@/jueony/adapters/browser/document-history-context.ts';\n"+commands;
 const historyStart=commands.indexOf("    id: 'edit:document-history',"),canStart=commands.indexOf('    canExecute: () => true,',historyStart);
 if(historyStart<0||canStart<0||canStart>commands.indexOf('    execute(services)',historyStart))throw Error('History command readiness integration drift');
 commands=commands.slice(0,canStart)+commands.slice(canStart).replace('    canExecute: () => true,','    canExecute: () => documentHistoryAvailable(),');await writeFile(commandsPath,commands);
}
