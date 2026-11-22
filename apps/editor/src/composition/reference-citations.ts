import {fingerprint} from '../adapters/files/fingerprints.ts';
import {readOfficeTextCitation} from '../adapters/files/office-reference.ts';
import {readCitedReference, type LiveReference, type resolveReferenceOrigin} from '../adapters/files/references.ts';
import {readSpreadsheetCitation} from '../adapters/files/spreadsheet-reference.ts';
import type {HwpReferenceAddress, RetrievalScope, Source, SourceAddress} from '../modules/references/public/index.ts';

type CitationSource = Pick<Source,'id'|'originSourceId'|'sha256'|'sourceVersion'>;
type CitationOrigin = Awaited<ReturnType<typeof resolveReferenceOrigin>>;
export type OfficeCitation = {name:string;value:string;address:Exclude<SourceAddress,HwpReferenceAddress>};

type CitationTab = {
  workspaceId:string;
  initialized:boolean;
  api:{
    fileHandle():FileSystemFileHandle|null;
    open(bytes:Uint8Array,name:string):Promise<void>;
    readOpenReference?():LiveReference;
    jumpToReference?(address:HwpReferenceAddress,revision:string):void;
    focusEditor():void;
  }|null;
};

type CitationNavigationOptions<Tab extends CitationTab> = {
  isCurrent(scope:RetrievalScope):boolean;
  resolveOrigin(id:string,scope:RetrievalScope):Promise<CitationOrigin>;
  tabs():readonly Tab[];
  select(tab:Tab):void;
  create(workspaceId:string):Promise<Tab>;
  remove(tab:Tab):Promise<unknown>;
  persist(tab:Tab):Promise<unknown>;
  showOfficeCitation(citation:OfficeCitation):void;
  status(message:string):void;
  reportError(error:unknown):void;
};

function jumpToCitation(tab:CitationTab,proof:LiveReference,address:HwpReferenceAddress) {
  const known=proof.locations?.some(place=>JSON.stringify(place.address)===JSON.stringify(address));
  if(!known||!tab.api?.jumpToReference)throw new Error('인용한 문단 또는 표 셀 위치를 확인할 수 없습니다.');
  tab.api.jumpToReference(address,proof.revision);
  tab.api.focusEditor();
}

export function createCitationNavigation<Tab extends CitationTab>(options:CitationNavigationOptions<Tab>) {
  return async (scope:RetrievalScope,source:CitationSource,address:SourceAddress):Promise<void>=>{
    function assertScope(){
      if(!options.isCurrent(scope))throw new Error('이 자료를 인용한 채팅에서 문서 작업을 마친 뒤 다시 열어 주세요.');
    }
    const resolve=()=>options.resolveOrigin(source.originSourceId??source.id,scope);
    assertScope();
    const origin=await resolve();
    async function assertCurrentOrigin(){
      const current=await resolve();
      const same='file' in origin?'file' in current&&current.file===origin.file:
        'handle' in current&&await origin.handle.isSameEntry(current.handle);
      assertScope();
      if(!same)throw new Error('인용한 자료 연결이 바뀌었습니다. 현재 업무에서 다시 요청해 주세요.');
    }

    if(address.kind!=='hwp'){
      const {bytes,name}=await readCitedReference(origin,source.sha256,address.kind);
      const value=address.kind==='xlsx'?await readSpreadsheetCitation(bytes,address):
        await readOfficeTextCitation(bytes,address,AbortSignal.timeout(45_000));
      await assertCurrentOrigin();
      options.showOfficeCitation({name,value,address});
      return;
    }

    if(source.sourceVersion){
      if('handle' in origin){
        for(const tab of options.tabs()){
          if(!tab.initialized||tab.workspaceId!==scope.workspaceId)continue;
          const handle=tab.api?.fileHandle();
          if(!handle||!await origin.handle.isSameEntry(handle))continue;
          const proof=tab.api?.readOpenReference?.();
          if(!proof||proof.revision!==source.sourceVersion.revision||await fingerprint(new TextEncoder().encode(proof.text).buffer)!==source.sha256)break;
          await assertCurrentOrigin();
          options.select(tab);
          jumpToCitation(tab,proof,address);
          options.status('인용한 열린 문서 위치로 이동했습니다.');
          return;
        }
      }
      throw new Error('인용한 열린 문서의 버전이 바뀌었습니다. 최신 문서로 다시 요청해 주세요.');
    }

    const {bytes,name}=await readCitedReference(origin,source.sha256);
    assertScope();
    const tab=await options.create(scope.workspaceId);
    try{
      await tab.api?.open(bytes,name);
      await assertCurrentOrigin();
      const proof=tab.api?.readOpenReference?.();
      if(!proof)throw new Error('현재 편집기에서 원본 위치를 확인할 수 없습니다.');
      jumpToCitation(tab,proof,address);
    }catch(error){
      if(tab.initialized)await options.remove(tab);
      throw error;
    }
    options.status('인용한 원본의 확인용 사본을 열었습니다.');
    await options.persist(tab).catch(options.reportError);
  };
}
