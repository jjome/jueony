import {runOnce} from './run-once.ts';
import {runBounded} from './run-bounded.ts';
import type {BoundedRunOptions} from './run-bounded.ts';
import {buildContext,buildRetrievedContext} from './context.ts';
import type {ReferenceFacade} from '../../references/public/index.ts';
export function createAgentFacade(references:ReferenceFacade){
 return {
  context:buildContext,
  contextWithRetrieval:(args:Parameters<typeof buildContext>,signal?:AbortSignal)=>buildRetrievedContext(...args,signal,references),
  execute:(options:BoundedRunOptions,mode:'single'|'bounded'='single')=>mode==='bounded'?runBounded(options):runOnce(options),
 };
}
export type AgentFacade=ReturnType<typeof createAgentFacade>;
