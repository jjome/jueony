import type {DocumentEnginePort} from '../ports/engine.ts';
import type {DocumentFacades} from '../public/facades.ts';
import {validateEditProposal} from '../domain/edit-proposal.ts';
import {auditAdministrativeProfile} from '../domain/administrative-audit.ts';
/** A batch can only reach an engine after the module's semantic validation. */
export function createDocumentFacades(engine: DocumentEnginePort): DocumentFacades {
 return {
  query: {
   async readSnapshot() {return engine.readSnapshot();},
   async auditAdministrativeDocument(options) {
    if (!engine.readAdministrativeAuditProfile) throw new Error('이 문서는 행정 문서 검사를 지원하지 않습니다.');
    return auditAdministrativeProfile(await engine.readAdministrativeAuditProfile(options), options);
   },
   async inspectLayout() {
    return engine.inspectLayout?.() ?? {findings:[],count:0,status:'unavailable',checkedPages:0,limitations:['이 문서는 배치 검사를 지원하지 않습니다.']};
   },
  },
  edit: {
   async preflight(base, proposal, includeStructure) {
    return engine.preflight(base,validateEditProposal(proposal,base,proposal.sourceIds),includeStructure);
   },
   async apply(runId,base,proposal) {return engine.apply(runId,base,validateEditProposal(proposal,base,proposal.sourceIds));},
   async undoRequest(receipt) {return engine.undoRequest(receipt);},
  },
 };
}
