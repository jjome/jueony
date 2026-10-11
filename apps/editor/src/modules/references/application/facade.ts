import {indexSelectedSources,searchSelectedSources} from './selected-sources.ts';
import type {ContentHashPort} from '../ports/content-hash.ts';
import type {Source,RetrievalScope} from '../public/contracts.ts';
export function createReferenceFacade(hash:ContentHashPort){
 return {
  index:(scope:RetrievalScope,sources:Source[],signal?:AbortSignal)=>indexSelectedSources(scope,sources,signal,text=>hash.digest(text)),
  search:searchSelectedSources,
  async retrieve(scope:RetrievalScope,sources:Source[],request:string,signal?:AbortSignal){
   const index=await indexSelectedSources(scope,sources,signal,text=>hash.digest(text));
   return searchSelectedSources(index,scope,request,signal);
  },
 };
}
export type ReferenceFacade=ReturnType<typeof createReferenceFacade>;
