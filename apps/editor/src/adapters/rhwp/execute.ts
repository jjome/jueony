import {executeAgentEmptySection} from './agent-empty-section.ts';
import type { EditOp, BodyOp, Snapshot } from '../../modules/document/public/index.ts';
import { executeBodyOperations } from './body-operations.ts';
import { controlKinds, executeControlOperation } from './operations.ts';
import type { ControlOp } from '../../modules/document/public/index.ts';
import { nativeDocument } from './structure.ts';

// Called inside the editor's single SnapshotCommand. IDs retain their meaning
// while structural insertions move native paragraph indices within this batch.
export function executeDocumentOperations(wasm: any, base: Snapshot, operations: EditOp[]) {
  const snapshot = structuredClone(base), doc = nativeDocument(wasm);
  if(operations.length===1&&operations[0].kind==='remove_empty_section')return executeAgentEmptySection(doc,snapshot,operations[0]);
  const tables = new Map((snapshot.structure?.tables ?? []).map(t => [t.id, t]));
  for (const op of operations) {
    let insertion: { section: number; after: number; count: number } | undefined;
    if (controlKinds.includes(op.kind)) insertion = executeControlOperation(doc, snapshot, op as ControlOp, tables);
    else {
      const body = op as BodyOp;
      executeBodyOperations(doc, snapshot, [body]);
      if (body.kind === 'insert_body_paragraphs') {
        const n = snapshot.nodes.find(n => n.id === body.after)!;
        insertion = { section: n.section, after: n.paragraph, count: body.paragraphs.length };
      } else if (body.kind !== 'create_document') {
        const n = snapshot.nodes.find(n => n.id === body.target)!;
        n.text = doc.getTextRange(n.section, n.paragraph, 0, doc.getParagraphLength(n.section, n.paragraph));
      }
    }
    if (insertion) {
      const { section, after, count } = insertion;
      for (const n of snapshot.nodes) if (n.section === section && n.paragraph > after) n.paragraph += count;
      for (const [id, t] of tables) if (!(op.kind === 'create_table' && id === '@' + op.resultId) && t.section === section && t.paragraph > after) t.paragraph += count;
    }
  }
}
