import {readReferences, type Reference} from '../adapters/files/references.ts';
import type {TemporaryReference} from '../adapters/files/temporary-references.ts';
import type {DocumentFrameClient} from '../adapters/iframe/document-client.ts';
import type {Folder} from '../adapters/storage/legacy-records.ts';
import type {RetrievalScope} from '../modules/references/public/index.ts';

type OpenReferenceDocument = {
  workspaceId: string;
  closed: boolean;
  api: Pick<DocumentFrameClient,'fileHandle'|'readOpenReference'|'snapshot'> | null;
};

type WorkspaceReferenceInput = {
  scope: RetrievalScope;
  selected: Reference[];
  folders: Folder[];
  reader: Pick<DocumentFrameClient,'readReference'|'readReferenceDetails'>;
  openDocuments?: () => readonly OpenReferenceDocument[];
  temporary?: TemporaryReference[];
  pdfOcr?: boolean;
  skipUnavailable?: true;
};

export function readWorkspaceReferences(input: WorkspaceReferenceInput,signal: AbortSignal,cache?:Parameters<typeof readReferences>[8]) {
  const {scope,selected,folders,reader,openDocuments,temporary,pdfOcr}=input;
  const live=openDocuments?async (handle: FileSystemFileHandle)=>{
    for(const document of openDocuments()){
      if(document.closed||document.workspaceId!==scope.workspaceId)continue;
      const api=document.api,existing=api?.fileHandle();
      if(!api||!existing)continue;
      const same=await handle.isSameEntry(existing);
      signal.throwIfAborted();
      if(!same||document.closed||document.api!==api||api.fileHandle()!==existing)continue;
      if(api.readOpenReference)return api.readOpenReference();
      const snapshot=api.snapshot();
      return {revision:snapshot.revision,text:snapshot.plainText??snapshot.nodes.map(node=>node.text).join('\n')};
    }
  }:undefined;
  return readReferences(selected,folders,scope.workspaceId,bytes=>reader.readReferenceDetails?.(bytes)??reader.readReference(bytes),
    signal,live,temporary?{chatId:scope.chatId,items:temporary}:undefined,pdfOcr,cache,input.skipUnavailable);
}
