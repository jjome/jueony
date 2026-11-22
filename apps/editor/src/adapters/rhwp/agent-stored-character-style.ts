import {agentStoredCharacterStyle} from '../../modules/document/public/engine-integration.ts';
import type {Snapshot} from '../../modules/document/public/index.ts';
import {verifyStoredCharacterStyle} from './character-style-reference.ts';

type BodyReader={
 getStyleList():string;
 getStyleDetail(styleId:number):string;
 getDocumentMetadata():string;
 getParagraphLength(section:number,paragraph:number):number;
 getTextRange(section:number,paragraph:number,start:number,count:number):string;
 getCharShapeRuns(section:number,paragraph:number,start:number,end:number):string;
 setCharShapeRuns(section:number,paragraph:number,start:number,end:number,runs:string):string;
};
type Run={startOffset:number;endOffset:number;charShapeId:number};

function bodyShapes(doc:BodyReader,section:number,paragraph:number,length:number):number[]{
 const runs=JSON.parse(doc.getCharShapeRuns(section,paragraph,0,length)) as Run[];
 const result:number[]=[];
 for(const {startOffset,endOffset,charShapeId} of runs){
  if(startOffset!==result.length||!Number.isSafeInteger(endOffset)||endOffset<=startOffset||endOffset>length||
     !Number.isSafeInteger(charShapeId)||charShapeId<0)throw new Error('본문의 글자 모양 구간을 확인할 수 없습니다.');
  for(let offset=startOffset;offset<endOffset;offset++)result.push(charShapeId);
 }
 if(result.length!==length)throw new Error('본문의 글자 모양 구간이 텍스트와 일치하지 않습니다.');
 return result;
}

export function executeAgentStoredCharacterStyle(doc:BodyReader,base:Snapshot,target:string,properties:Record<string,unknown>):void{
 const {node,reference,start,count}=agentStoredCharacterStyle(target,properties,base);
 const {section,paragraph,text}=node;
 const {charShapeId}=verifyStoredCharacterStyle(doc,reference);
 const length=doc.getParagraphLength(section,paragraph);
 if(JSON.parse(doc.getDocumentMetadata()).editable!==true||length!==Array.from(text).length||length>4000||
    doc.getTextRange(section,paragraph,0,length)!==text){
  throw new Error('본문이 바뀌었거나 보호되어 글자 스타일을 적용할 수 없습니다.');
 }
 const end=start+count;
 const expected=bodyShapes(doc,section,paragraph,length);
 expected.fill(charShapeId,start,end);
 const result=JSON.parse(doc.setCharShapeRuns(section,paragraph,start,end,JSON.stringify([{startOffset:start,endOffset:end,charShapeId}])));
 if(result.ok!==true||doc.getTextRange(section,paragraph,0,length)!==text||
    bodyShapes(doc,section,paragraph,length).some((shape,offset)=>shape!==expected[offset])){
  throw new Error('지정 범위의 스타일 적용과 이웃 글자 모양 보존을 확인하지 못했습니다.');
 }
 verifyStoredCharacterStyle(doc,reference);
}
