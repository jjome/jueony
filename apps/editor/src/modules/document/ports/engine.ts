import type {Snapshot, EditProposal, Receipt, Structure} from '../public/types.ts';
import type {AuditOptions, AuditProfile} from '../domain/administrative-audit.ts';
import type {LayoutDiagnostics} from '../public/facades.ts';
/** Native transaction/history/revision bookkeeping stays behind this boundary. */
export interface DocumentEnginePort {
 readSnapshot(): Snapshot | Promise<Snapshot>;
 readAdministrativeAuditProfile?(options: AuditOptions): AuditProfile | Promise<AuditProfile>;
 inspectLayout?(): LayoutDiagnostics | Promise<LayoutDiagnostics>;
 preflight(base: Snapshot, proposal: EditProposal, includeStructure?:boolean): Promise<Structure|void>;
 apply(runId: string, base: Snapshot, proposal: EditProposal): Promise<Receipt>;
 undoRequest(receipt: Receipt): Promise<void>;
}
