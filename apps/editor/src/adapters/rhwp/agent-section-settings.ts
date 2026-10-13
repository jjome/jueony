import type {AgentSectionOp} from '../../modules/document/public/types.ts';
import {agentTabSpacingRaw,agentLineNumberSettings} from '../../modules/document/public/engine-integration.ts';
import {planLineNumberEdits,executeLineNumberEdits,readLineNumberSettings} from './line-numbers.ts';
import {nativeDocument,parsed} from './structure.ts';

export function executeAgentSectionOperation(wasm:any,name:string,op:AgentSectionOp):void {
 const doc=nativeDocument(wasm);
 if(op.kind==='set_section_tabs'){
  const raw=agentTabSpacingRaw(op.spacingPt),before=parsed(doc.getSectionDef(op.section));
  if((before.defaultTabSpacing||8000)===raw)return;
  const result=parsed(doc.setSectionDef(op.section,JSON.stringify({defaultTabSpacing:raw})));
  if(result?.ok===false||parsed(doc.getSectionDef(op.section)).defaultTabSpacing!==raw)throw new Error('기본 탭 적용 결과가 명령과 다릅니다.');
  return;
 }
 const current=readLineNumberSettings(doc,op.section);
 if(current.enabled&&!current.editable)throw new Error('지원 범위 밖의 원본 줄 번호는 변경하지 않습니다.');
 const wrapped={fileName:name,borrowDocumentHandle:()=>doc};
 const edits=planLineNumberEdits(wrapped,op.section,agentLineNumberSettings(op),'current');
 executeLineNumberEdits(wrapped,edits);
}
