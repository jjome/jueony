import type {EditProposal} from '../../document/public/index.ts';
export type Generation=EditProposal;
export type RunStatus='preparing_context'|'generating'|'validating'|'applying'|'completed'|'cancelled'|'conflict'|'failed_no_change'|'failed_rolled_back'|'failed_partial'|'interrupted';
export type AgentEvent={phase:'generating'|'reviewing'|'validated'|'ready'|'applying'|'completed'|'stopped';call:number;maxCalls:number;elapsedMs:number;inputCharacters?:number;operationCount?:number;reason?:string};
export type ExecutionSummary={mode:'bounded';calls:number;stopReason:'stable-plan'|'call-budget';elapsedMs:number;inputCharacters:number};
