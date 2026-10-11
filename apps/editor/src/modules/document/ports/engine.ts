import type {Snapshot, EditProposal, Receipt} from '../public/types.ts';
/** Native transaction/history/revision bookkeeping stays behind this boundary. */
export interface DocumentEnginePort {
 readSnapshot(): Snapshot | Promise<Snapshot>;
 preflight(base: Snapshot, proposal: EditProposal): Promise<void>;
 apply(runId: string, base: Snapshot, proposal: EditProposal): Promise<Receipt>;
 undoRequest(receipt: Receipt): Promise<void>;
}
