import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Add a host-owned save entry, reusing the ordinary command's payload and
 * completion plus its existing strict snapshot writer. No picker branch. */
export async function applyAgentBoundSavePatches({root}){
 const file=join(root,'src/command/commands/file.ts'),mainFile=join(root,'src/main.ts');
 let source=await readFile(file,'utf8'),main=await readFile(mainFile,'utf8');
 const replace=(text,before,after)=>{if(text.split(before).length!==2)throw Error('Bound-save integration anchor mismatch: '+before);return text.replace(before,after);};
 source="import {createBoundDocumentSave} from '../../jueony/adapters/files/bound-save.ts';\nimport {writeSnapshot} from '../../jueony/adapters/files/save-runtime.ts';\n"+source;
 source+=`
// Agent has no format/path/password/picker authority. The ordinary save payload
// still performs content-loss, semantic and whole-layout preservation checks.
export function createBoundSaveForServices(services: CommandServices) {
  const api = () => (window as any).jueonyEditor;
  const format = (): 'hwp' | 'hwpx' | undefined => {
    const wasm = services.wasm;
    if (!wasm.currentFileHandle || wasm.requiresPasswordForSave) return undefined;
    const target = resolveSaveTarget(wasm.getSourceFormat(), wasm.fileName, wasm.currentFileHandle);
    if (target.forceSaveAs || (target.format !== 'hwp' && target.format !== 'hwpx')) return undefined;
    return target.format;
  };
  return createBoundDocumentSave({
    read: () => ({instance: api().documentInstance(), revision: api().revision(),
      name: services.wasm.fileName, dirty: services.documentState.isDirty(),
      handle: services.wasm.currentFileHandle,
      eligible: api().isBoundSaveEligible?.() === true && !services.wasm.requiresPasswordForSave}),
    locked: () => api().hostMutationLocked(), format,
    prepare: (target, authority) => api().prepareFileSave(target, authority),
    payload: target => createSavePayload(services, target).blob,
    write: writeSnapshot,
    complete: (target, handle) => {
      const current = services.wasm.currentFileHandle;
      if (!current || current !== handle) throw new Error('파일 기록 후 원본 연결이 바뀌었습니다.');
      completeHandleSave(services, services.wasm.getSourceFormat(), target,
        {method: 'current-handle', handle: current, fileName: current.name}, 'save', false);
    },
  });
}
`;
 main=replace(main,'confirmSaveBeforeReplacingDocument, saveCurrentDocument, fileCommands','confirmSaveBeforeReplacingDocument, saveCurrentDocument, createBoundSaveForServices, fileCommands');
 main=replace(main,'  save: () => saveCurrentDocument(commandServices),','  save: () => saveCurrentDocument(commandServices),\n  createBoundSave: () => createBoundSaveForServices(commandServices),');
 await writeFile(file,source);await writeFile(mainFile,main);
}
