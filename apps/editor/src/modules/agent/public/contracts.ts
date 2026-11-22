import type {EditProposal,NestedTable,Snapshot,Structure} from '../../document/public/index.ts';
export type Generation=EditProposal;
export type ReferenceChangeReview={
 request:string;
 document:Pick<Snapshot,'name'|'nodes'|'fileContext'>;
 tableLocations:Array<Pick<NestedTable,'id'|'section'|'paragraph'|'control'>&Partial<Pick<NestedTable,'ancestors'>>>;
 shapeFills:Record<string,Pick<NonNullable<Snapshot['shapeFillSources']>[string],'section'|'paragraph'|'control'|'color'>>;
 referenceNames:string[];
 operations:Generation['operations'];
 verifiedStructure?:{before:Structure;after:Structure};
};
export type RunStatus='preparing_context'|'generating'|'validating'|'applying'|'completed'|'cancelled'|'conflict'|'failed_no_change'|'failed_rolled_back'|'failed_partial'|'interrupted';
export type AgentEvent={phase:'generating'|'reviewing'|'validated'|'ready'|'applying'|'completed'|'stopped';call:number;maxCalls:number;elapsedMs:number;inputCharacters?:number;operationCount?:number;reason?:string};
export type ExecutionSummary={mode:'bounded';calls:number;stopReason:'stable-plan'|'call-budget';elapsedMs:number;inputCharacters:number};

export type RunScope = {workspaceId:string;chatId:string};
export interface RunRepository<T extends RunScope> {
  append(run:T):void;
  list(scope:RunScope):T[];
}

import type {AgentFileContext,AgentFileOp,AgentFileReceipt} from '../../document/public/index.ts';
export interface AgentFilePort{snapshot():AgentFileContext;execute(runId:string,operation:AgentFileOp,expected:AgentFileContext,signal:AbortSignal):Promise<AgentFileReceipt>;}
