import type {DocumentEnginePort} from '../ports/engine.ts';
import type {DocumentFacades} from '../public/facades.ts';
import {validateEditProposal} from '../domain/edit-proposal.ts';
/** A batch can only reach an engine after the module's semantic validation. */
export function createDocumentFacades(engine: DocumentEnginePort): DocumentFacades {
 return {
  query: {async readSnapshot() {return engine.readSnapshot();}},
  edit: {
   async preflight(base, proposal) {return engine.preflight(base,validateEditProposal(proposal,base,proposal.sourceIds));},
   async apply(runId,base,proposal) {return engine.apply(runId,base,validateEditProposal(proposal,base,proposal.sourceIds));},
   async undoRequest(receipt) {return engine.undoRequest(receipt);},
  },
 };
}
