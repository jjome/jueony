import {indexSelectedSources,searchSelectedSources} from './selected-sources.ts';
import type {ContentHashPort} from '../ports/content-hash.ts';
import type {Source,RetrievalScope,RetrievalMode} from '../public/contracts.ts';
import type {RankedIndexPort} from '../ports/ranked-index.ts';
export function createReferenceFacade(hash:ContentHashPort,persistent?:RankedIndexPort){
 return {
  index:(scope:RetrievalScope,sources:Source[],signal?:AbortSignal)=>indexSelectedSources(scope,sources,signal,text=>hash.digest(text)),
  search:searchSelectedSources,
  async retrieve(scope:RetrievalScope,sources:Source[],request:string,signal?:AbortSignal,mode:RetrievalMode='lexical'){
   const index=await indexSelectedSources(scope,sources,signal,text=>hash.digest(text));
   let ranks: ReadonlyMap<string,number>|undefined;
   let warning: string|undefined;
   if(mode==='bm25'&&persistent){
    try {ranks=await persistent.rank(index,request,signal);}
    catch {signal?.throwIfAborted();warning='로컬 색인을 사용할 수 없어 이번 요청의 선택 자료만 메모리에서 검색했습니다.';}
   }
   const result=searchSelectedSources(index,scope,request,signal,mode,ranks);
   if(warning)result.retrieval.warnings.push(warning);
   return result;
  },
  async clearIndex(scope:Pick<RetrievalScope,'workspaceId'>&Partial<Pick<RetrievalScope,'chatId'>>){await persistent?.clear(scope);},
  async refreshIndex(scope:RetrievalScope,sources:Source[],signal:AbortSignal){
   if(!persistent)return;
   const index=await indexSelectedSources(scope,sources,signal,text=>hash.digest(text));
   await persistent.rank(index,'',signal);
  },
 };
}
export type ReferenceFacade=ReturnType<typeof createReferenceFacade>;
