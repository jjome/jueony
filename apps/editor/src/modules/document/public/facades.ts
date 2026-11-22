import type {Snapshot, EditProposal, Receipt, Structure} from './types.ts';
import type {AdministrativeAuditResult, AuditAddress, AuditOptions} from '../domain/administrative-audit.ts';
export type LayoutDiagnostics = {
 findings: {rule:'cell-overflow'|'page-overflow'|'isolated-heading';label:string;address:AuditAddress;page:number}[];
 count:number;
 status:'checked'|'partial'|'unavailable';
 checkedPages:number;
 limitations:string[];
};
/** Async public surface remains usable across a future document transport. */
export interface DocumentQueryFacade {
 readSnapshot(): Promise<Snapshot>;
 auditAdministrativeDocument(options: AuditOptions): Promise<AdministrativeAuditResult>;
 inspectLayout(): Promise<LayoutDiagnostics>;
}
export interface DocumentEditFacade {
 preflight(base: Snapshot, proposal: EditProposal, includeStructure?:boolean): Promise<Structure|void>;
 apply(runId: string, base: Snapshot, proposal: EditProposal): Promise<Receipt>;
 undoRequest(receipt: Receipt): Promise<void>;
}
export type DocumentFacades = {query: DocumentQueryFacade; edit: DocumentEditFacade};
