import {recoveryIntegrity} from '../adapters/storage/recovery-integrity.ts';
import type {SavedDocument} from '../mvp/model.ts';
import {partitionRecoveryRecords} from '../modules/document-files/public/index.ts';

export function createWorkspaceRecovery(options:{
  read(workspaceId:string):Promise<SavedDocument[]>;
  order(workspaceId:string,records:SavedDocument[]):SavedDocument[];
  isOpen(documentId:string):boolean;
  open(workspaceId:string,record:SavedDocument):Promise<unknown>;
  onError(error:unknown):void;
}){
  const restored=new Set<string>();
  return async function restoreWorkspace(workspaceId:string){
    if(restored.has(workspaceId))return;
    const {valid,errors}=partitionRecoveryRecords(await options.read(workspaceId),workspaceId,recoveryIntegrity);
    for(const error of errors)options.onError(error);
    for(const document of options.order(workspaceId,valid)){
      if(options.isOpen(document.id))continue;
      try{await options.open(workspaceId,document);}
      catch(error){options.onError(error);}
    }
    restored.add(workspaceId);
  };
}
