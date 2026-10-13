import type {Snapshot,AgentSectionSplitOp} from '../../modules/document/public/index.ts';
import {validateAgentSectionSplit} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed} from './structure.ts';
/** Uses the already guarded native splitter; no file rewrite or parallel document state. */
export function executeAgentSectionSplit(wasm:any,base:Snapshot,op:AgentSectionSplitOp):void {
 validateAgentSectionSplit(op,base);const doc=nativeDocument(wasm),node=base.nodes.find(n=>n.id===op.target)!;
 if(typeof doc.insertSectionBreak!=='function')throw new Error('이 엔진에는 AI 구역 나누기가 없습니다.');
 const read=()=>Array.from({length:doc.getSectionCount()},(_,s)=>Array.from({length:doc.getParagraphCount(s)},(_,p)=>doc.getTextRange(s,p,0,doc.getParagraphLength(s,p)) as string));
 const before=read(),original=before[node.section]?.[node.paragraph];
 if(original!==node.text||before.length!==base.structure!.sections.length)throw new Error('구역 나누기의 원문이나 구역이 바뀌었습니다.');
 const expected=structuredClone(before),source=before[node.section],chars=Array.from(original),p=node.paragraph;
 let left:string[],right:string[];
 if(op.offset===chars.length&&chars.length){left=source.slice(0,p+1);right=source.slice(p+1);if(!right.length)right=[''];}
 else if(op.offset===0&&p>0){left=source.slice(0,p);right=source.slice(p);}
 else {left=[...source.slice(0,p),chars.slice(0,op.offset).join('')];right=[chars.slice(op.offset).join(''),...source.slice(p+1)];}
 expected.splice(node.section,1,left,right);
 const result=parsed(doc.insertSectionBreak(node.section,p,op.offset));
 if(result?.ok!==true||result.sectionIdx!==node.section+1||doc.getSectionCount()!==before.length+1||JSON.stringify(read())!==JSON.stringify(expected))throw new Error('구역 나누기 결과의 위치·본문이 명령과 다릅니다.');
}
