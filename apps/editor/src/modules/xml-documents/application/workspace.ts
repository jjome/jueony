import type {XmlCodecPort} from '../ports/xml-codec.ts';
import type {XmlEditRequest,XmlElementValue,XmlExportArtifact,XmlWorkspaceSnapshot,XmlFieldValue} from '../public/contracts.ts';
import {compileXmlSchema,validateXmlInstance,XmlContractError} from '../domain/schema.ts';
export const XML_LIMITATIONS=Object.freeze(['로컬 sequence 프로필의 XML/XSD만 지원합니다.','HWT 서식·HWP 문서 매핑·XSL 지면 변환은 아직 지원하지 않습니다.','일반 XSD의 import/include·choice·속성·사용자 자료형은 지원하지 않습니다.']);
export function createXmlWorkspace(codec:XmlCodecPort,source:string,schemaSource:string){
 const schema=compileXmlSchema(codec.parse(schemaSource));
 const checked=(value:string):XmlElementValue=>{const tree=codec.parse(value),issues=validateXmlInstance(tree,schema);if(issues.length)throw new XmlContractError(issues.map(i=>`${i.path}: ${i.message}`).join('\n'));return tree;};
 checked(source);let current=source,revision=0;const past:string[]=[],future:string[]=[];
 function snapshot():XmlWorkspaceSnapshot{const fields:XmlFieldValue[]=[];function visit(node:XmlElementValue,path:number[]){fields.push({path,name:node.name,namespace:node.namespace,value:node.text,simple:node.children.length===0});node.children.forEach((n,i)=>visit(n,[...path,i]));}visit(checked(current),[]);return{revision,dirty:current!==source,canUndo:past.length>0,canRedo:future.length>0,fields,profile:'local-sequence-v1',limitations:XML_LIMITATIONS};}
 function edit(op:XmlEditRequest):XmlWorkspaceSnapshot{
  if(!op||!['replace','repeat','remove'].includes(op.kind))throw new XmlContractError('지원하지 않는 XML 편집 명령입니다.');
  if(op.revision!==revision)throw new XmlContractError('XML 문서 버전이 바뀌었습니다. 다시 조회해 주세요.');
  if(!Array.isArray(op.path)||op.path.length>32||op.path.some(x=>!Number.isSafeInteger(x)||x<0))throw new XmlContractError('XML 요소 위치가 올바르지 않습니다.');
  let node=checked(current);for(const i of op.path){if(!node.children[i])throw new XmlContractError('XML 요소가 없습니다.');node=node.children[i];}
  let candidate:string;
  if(op.kind==='replace'){if(node.children.length||node.text!==op.originalText)throw new XmlContractError('단순 필드의 원문이 바뀌었거나 복합 요소입니다.');if(typeof op.text!=='string'||op.text.length>100000)throw new XmlContractError('XML 필드 크기 제한을 초과했습니다.');if(op.text===op.originalText)throw new XmlContractError('변경할 내용이 없습니다.');candidate=codec.replaceText(current,op.path,op.text);}
  else {if(!op.path.length)throw new XmlContractError('루트 요소는 반복·삭제할 수 없습니다.');candidate=op.kind==='repeat'?codec.repeat(current,op.path):codec.remove(current,op.path);}
  checked(candidate);if(past.length>=100)throw new XmlContractError('XML 작업 기록 한도에 도달했습니다. 새 내보내기 사본으로 다시 여세요.');past.push(current);current=candidate;future.length=0;revision++;return snapshot();
 }
 function undo(){if(!past.length)throw new XmlContractError('되돌릴 XML 작업이 없습니다.');future.push(current);current=past.pop()!;revision++;return snapshot();}
 function redo(){if(!future.length)throw new XmlContractError('다시 실행할 XML 작업이 없습니다.');past.push(current);current=future.pop()!;revision++;return snapshot();}
 function exportArtifact():XmlExportArtifact{checked(current);return{xml:current,schema:schemaSource,profile:'local-sequence-v1'};}
 return{snapshot,edit,undo,redo,exportArtifact};
}
export type XmlWorkspace=ReturnType<typeof createXmlWorkspace>;
