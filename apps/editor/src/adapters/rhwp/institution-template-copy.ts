import type {EditOp,Snapshot} from '../../modules/document/public/index.ts';
import type {InstitutionTemplateField,WorkTemplateValues} from '../../modules/document/public/work-templates.ts';
import {executeDocumentOperations} from './execute.ts';
import {verifyPreservedExport} from './preservation.ts';
import {readStructure} from './structure.ts';
import {readHwpReferenceText} from './reference-locations.ts';

const markers=/\{\{(본문:)?([\p{L}\p{N}][\p{L}\p{N} _.()-]{0,39})\}\}/gu;
const plainHwp=[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1];
const zip=[0x50,0x4b,0x03,0x04];
type Source={kind:'paragraph';node:Snapshot['nodes'][number]}|{kind:'cell';table:string;row:number;column:number;text:string};
const parse=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const plain=(text:string)=>!/[\p{Cc}\p{Cs}]/u.test(text);

function openTemplate(HwpDocument:any,bytes:Uint8Array,name:string){
 const format=/\.hwpx$/iu.test(name)?'hwpx':/\.hwp$/iu.test(name)?'hwp':undefined;
 if(!format||bytes.length>50_000_000||!(format==='hwpx'?zip:plainHwp).every((byte,index)=>bytes[index]===byte)){
  throw new Error('50MB 이하의 HWP 또는 HWPX 기관 양식을 선택하세요.');
 }
 return {doc:new HwpDocument(new Uint8Array(bytes)),format} as const;
}

function plan(doc:any,name:string){
 const fullText=readHwpReferenceText(doc);
 if(fullText.length>120000)throw new Error('기관 양식은 12만 자까지 확인할 수 있습니다.');
 const all=[...fullText.matchAll(markers)];
 const fields=new Map<string,InstitutionTemplateField>();
 const sources:Source[]=[];
 if(!all.length)return {fields:[],sources};
 const counts=new Map<string,number>();
 const remember=(items:RegExpMatchArray[])=>{
  for(const [token,draft,name] of items){
   const key=name.trim();
   if(!key||name!==key||fields.has(key)&&fields.get(key)!.draft!==Boolean(draft))throw Error('같은 입력 항목은 같은 표기법으로 작성하세요.');
   fields.set(key,{name:key,draft:Boolean(draft)});
   counts.set(token,(counts.get(token)??0)+1);
  }
 };
 const structure=readStructure(doc),nodes:Snapshot['nodes']=[];
 const base:Snapshot={revision:'institution-template',name,nodes,limitations:[],structure};
 for(const {id,controls} of structure.paragraphs){
  const match=/^s(\d+)p(\d+)$/u.exec(id)!;
  const section=Number(match[1]),paragraph=Number(match[2]);
  const length=doc.getParagraphLength(section,paragraph),text=doc.getTextRange(section,paragraph,0,length);
  const fields=[...text.matchAll(markers)];
  if(!fields.length)continue;
  if(!plain(text)||length>4000||Array.from(text).length!==length||controls?.some(id=>id!=='secd'&&id!=='cold')||
     parse(doc.getCharShapeRuns(section,paragraph,0,length)).length!==1){
   throw new Error('입력 항목은 같은 글자 모양의 일반 본문이나 단순 표 셀에 표시하세요.');
  }
  const node={id,section,paragraph,text,editable:true};
  remember(fields);nodes.push(node);sources.push({kind:'paragraph',node});
 }
 for(const table of structure.tables)for(const cell of table.cells){
  const fields=[...cell.text.matchAll(markers)];
  if(!fields.length)continue;
  if(!table.editable||!cell.editable||cell.properties.fieldName!==''||cell.rowSpan!==1||cell.columnSpan!==1||!plain(cell.text)||cell.text.length>4000){
   throw new Error('잠금·병합·복합 문단이 있는 표 셀은 양식 입력 항목으로 사용할 수 없습니다.');
  }
  remember(fields);sources.push({kind:'cell',table:table.id,row:cell.row,column:cell.column,text:cell.text});
 }
 for(const [token] of all)counts.set(token,(counts.get(token)??0)-1);
 if(sources.length>30||fields.size>30||[...counts.values()].some(count=>count!==0)){
  throw new Error('일반 본문과 단순 셀에서 확인한 입력 항목을 30개까지 사용하세요.');
 }
 return {base,sources,fields:[...fields.values()]};
}

export function inspectInstitutionTemplate(HwpDocument:any,bytes:Uint8Array,name:string):InstitutionTemplateField[]{
 const {doc}=openTemplate(HwpDocument,bytes,name);
 try{return plan(doc,name).fields;}
 finally{doc.free();}
}

export function createInstitutionTemplateCopy(HwpDocument:any,bytes:Uint8Array,name:string,values:WorkTemplateValues):Uint8Array{
 const {doc,format}=openTemplate(HwpDocument,bytes,name);
 try {
  const {base,sources,fields}=plan(doc,name);
  const valid=new Set(fields.map(field=>field.name));
  const entries=Object.entries(values);
  if(entries.some(([name,value])=>!valid.has(name)||typeof value!=='string'||!plain(value)||value.length>180||/\{\{|\}\}/u.test(value))){
   throw new Error('확인한 양식 항목에 한 줄 180자 이하의 값을 입력하세요.');
  }
  const value=(key:string)=>Object.hasOwn(values,key)?values[key].trim():'';
  if(fields.some(field=>!value(field.name)))throw new Error('기관 양식의 필수 입력을 모두 채우세요.');
  if(!base)return new Uint8Array(bytes);
  const fill=(text:string)=>{
   const result=text.replace(markers,(_,draft:string,name:string)=>value(name));
   if(result.length>4000)throw Error('완성된 문단 또는 셀은 4,000자까지 지원합니다.');
   return result;
  };
  const operations:EditOp[]=sources.map(source=>source.kind==='paragraph'
   ?{kind:'replace_body_text',target:source.node.id,start:0,count:Array.from(source.node.text).length,text:fill(source.node.text)}
   :{kind:'set_table_cell',target:source.table,row:source.row,column:source.column,originalText:source.text,text:fill(source.text)});
  executeDocumentOperations(doc,base,operations);
  const actual=readStructure(doc);
  if(!same(base.structure?.sections,actual.sections)||!same(base.structure?.styles,actual.styles))throw Error('사본에서 원본 양식의 구역과 스타일을 확인하지 못했습니다.');
  const expectedTables=structuredClone(base.structure!.tables);
  for(const op of operations)if(op.kind==='set_table_cell'){
   const cell=expectedTables.find(table=>table.id===op.target)?.cells.find(cell=>cell.row===op.row&&cell.column===op.column);
   if(!cell)throw Error('입력할 표 셀의 주소를 다시 확인해 주세요.');
   cell.text=op.text;
  }
  if(!same(expectedTables,actual.tables))throw Error('사본에서 표의 셀과 저장 서식을 확인하지 못했습니다.');
  const artifact=format==='hwpx'?doc.exportHwpxWithReport():doc.exportHwpWithReport();
  try {
   const output=artifact.takeBytes();
   verifyPreservedExport(doc,output,format,artifact.contentLoss(),input=>new HwpDocument(input));
   return output;
  }finally{artifact.free();}
 }finally{doc.free();}
}
