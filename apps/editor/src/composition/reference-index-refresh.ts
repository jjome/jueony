import type {ExtractedReference,ReferenceExtractionCache} from '../adapters/files/references.ts';
import type {ReferenceFacade,RetrievalScope,Source} from '../modules/references/public/index.ts';

type RefreshScope={
  scope:RetrievalScope;
  readSources(signal:AbortSignal,cache:{previous:ReferenceExtractionCache;next:Map<string,ExtractedReference>}):Promise<Source[]>;
};

export function createReferenceIndexRefresh(
  capture:()=>RefreshScope|undefined,
  index:Pick<ReferenceFacade,'refreshIndex'|'clearIndex'>,
){
  let active:{request:AbortController;done:Promise<void>}|undefined;
  let queued:Promise<void>|undefined;
  let extracted=new Map<string,ExtractedReference>();

  async function refresh():Promise<void>{
    if(active){
      queued??=active.done.then(()=>{
        queued=undefined;
        return refresh();
      });
      return queued;
    }
    const selection=capture();
    if(!selection)return;
    const request=new AbortController();
    const {signal}=request;
    const next=new Map<string,ExtractedReference>();
    const done=Promise.resolve().then(async()=>{
      try{
        signal.throwIfAborted();
        const sources=await selection.readSources(signal,{previous:extracted,next});
        signal.throwIfAborted();
        await index.refreshIndex(selection.scope,sources,signal);
        signal.throwIfAborted();
        extracted=next;
      }catch{
        if(!signal.aborted){
          extracted.clear();
          await index.clearIndex(selection.scope).catch(()=>{});
        }
      }
    }).finally(()=>{active=undefined;});
    active={request,done};
    return done;
  }
  return {
    cancel(){
      active?.request.abort();
      extracted.clear();
    },
    refresh,
  };
}
