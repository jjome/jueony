import {runOnce} from './run-once.ts';
import {runBounded} from './run-bounded.ts';
import type {BoundedRunOptions} from './run-bounded.ts';
import {runDocumentTools, type DocumentToolRunOptions} from './run-document-tools.ts';
import {buildContext,buildRetrievedContext} from './context.ts';
import type {ReferenceFacade,RetrievalMode} from '../../references/public/index.ts';
export function createAgentFacade(references:ReferenceFacade){
 return {
  context:buildContext,
  contextWithRetrieval:(args:Parameters<typeof buildContext>,signal?:AbortSignal,mode?:RetrievalMode)=>buildRetrievedContext(...args,signal,references,mode),
  execute:(options:BoundedRunOptions,mode:'single'|'bounded'='single')=>mode==='bounded'?runBounded(options):runOnce(options),
  executeWithDocumentTools:(options:DocumentToolRunOptions)=>runDocumentTools(options),
 };
}
export type AgentFacade=ReturnType<typeof createAgentFacade>;
