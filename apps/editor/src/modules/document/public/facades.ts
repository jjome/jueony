import type {Snapshot, EditProposal, Receipt} from './types.ts';
/** Async public surface remains usable across a future document transport. */
export interface DocumentQueryFacade { readSnapshot(): Promise<Snapshot>; }
export interface DocumentEditFacade {
 preflight(base: Snapshot, proposal: EditProposal): Promise<void>;
 apply(runId: string, base: Snapshot, proposal: EditProposal): Promise<Receipt>;
 undoRequest(receipt: Receipt): Promise<void>;
}
export type DocumentFacades = {query: DocumentQueryFacade; edit: DocumentEditFacade};
