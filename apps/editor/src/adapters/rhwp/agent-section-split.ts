import {samePageBorderSettings,samePageSetup} from '../../modules/document/public/index.ts';
import type {Snapshot,AgentSectionSplitOp,PageSetupSettings,PageBorderSettings,PageBorderKind} from '../../modules/document/public/index.ts';
import {validateAgentSectionSplit} from '../../modules/document/public/engine-integration.ts';
import {nativeDocument,parsed} from './structure.ts';
import {executePageSetupEdits,planPageSetupEdits} from './page-setup-settings.ts';
import {readPageBorderSettings,supportsPageBorderEntries} from './page-border-settings.ts';
import {executeAgentPageBorderInclusion} from './agent-page-border-inclusion.ts';

const unchangedBorder=(actual:PageBorderSettings,expected:PageBorderSettings)=>
 samePageBorderSettings(actual,expected)&&actual.attr===expected.attr;

/** Uses the already guarded native splitter; no file rewrite or parallel document state. */
export function executeAgentSectionSplit(wasm:any,base:Snapshot,op:AgentSectionSplitOp):void {
 const {node,section,newPage,newBorder}=validateAgentSectionSplit(op,base),doc=nativeDocument(wasm);
 if(typeof doc.insertSectionBreak!=='function')throw new Error('이 엔진에는 AI 구역 나누기가 없습니다.');
 const read=()=>Array.from({length:doc.getSectionCount()},(_,s)=>Array.from({length:doc.getParagraphCount(s)},(_,p)=>doc.getTextRange(s,p,0,doc.getParagraphLength(s,p)) as string));
 const before=read(),original=before[node.section]?.[node.paragraph];
 if(original!==node.text||before.length!==base.structure!.sections.length)throw new Error('구역 나누기의 원문이나 구역이 바뀌었습니다.');
 const readPage=(index:number):PageSetupSettings=>parsed(doc.getPageDef(index));
 const borderKinds:PageBorderKind[]=supportsPageBorderEntries(doc)?['both','even','odd']:['both'];
 const readBorders=(index:number)=>borderKinds.map(kind=>readPageBorderSettings(doc,index,kind));
 const configured=Boolean(newPage||newBorder);
 const pages=configured?before.map((_,index)=>readPage(index)):[];
 const borders=configured?before.map((_,index)=>readBorders(index)):[];
 if(configured&&!samePageSetup(pages[node.section],section.page as PageSetupSettings))throw new Error('구역 나누기 전에 원래 구역의 편집 용지가 바뀌었습니다.');
 const expected=structuredClone(before),source=before[node.section],chars=Array.from(original),p=node.paragraph;
 let left:string[],right:string[];
 if(op.offset===chars.length&&chars.length){left=source.slice(0,p+1);right=source.slice(p+1);if(!right.length)right=[''];}
 else if(op.offset===0&&p>0){left=source.slice(0,p);right=source.slice(p);}
 else {left=[...source.slice(0,p),chars.slice(0,op.offset).join('')];right=[chars.slice(op.offset).join(''),...source.slice(p+1)];}
 expected.splice(node.section,1,left,right);
 const result=parsed(doc.insertSectionBreak(node.section,p,op.offset));
 if(result?.ok!==true||result.sectionIdx!==node.section+1||doc.getSectionCount()!==before.length+1||JSON.stringify(read())!==JSON.stringify(expected))throw new Error('구역 나누기 결과의 위치·본문이 명령과 다릅니다.');
 if(!configured)return;
 const created=node.section+1;
 if(!samePageSetup(readPage(created),pages[node.section])||!readBorders(created).every((entry,index)=>unchangedBorder(entry,borders[node.section][index]))){
  throw new Error('새 구역의 상속된 편집 용지 또는 테두리를 확인하지 못했습니다.');
 }
 if(newPage)executePageSetupEdits(doc,planPageSetupEdits(doc,created,newPage,'current'));
 if(newBorder){
  const inherited={...base,structure:{...base.structure!,sections:[{...section,index:created}]}};
  executeAgentPageBorderInclusion(doc,inherited,created,{borderIncludesHeader:newBorder.headerInside,borderIncludesFooter:newBorder.footerInside});
 }
 const inheritedBorders=borders[node.section].map(entry=>({...entry,
  headerInside:newBorder?.headerInside??entry.headerInside,footerInside:newBorder?.footerInside??entry.footerInside,
 }));
 if(!samePageSetup(readPage(created),newPage??pages[node.section])||!readBorders(created).every((entry,index)=>{
  const old=borders[node.section][index];
  return samePageBorderSettings(entry,inheritedBorders[index])&&((Number(entry.attr)^Number(old.attr))&~6)===0;
 }))throw new Error('새 구역에서 적용할 용지 또는 테두리 결과가 다릅니다.');
 for(const [oldIndex,page] of pages.entries()){
  const index=oldIndex<created?oldIndex:oldIndex+1;
  if(!samePageSetup(readPage(index),page)||!readBorders(index).every((entry,j)=>unchangedBorder(entry,borders[oldIndex][j]))){
   throw new Error('새 구역에 적용하는 동안 앞뒤 구역의 용지나 테두리가 바뀌었습니다.');
  }
 }
 if(JSON.stringify(read())!==JSON.stringify(expected))throw new Error('새 구역 설정 중 본문이 바뀌었습니다.');
}
