import test from 'node:test';import assert from 'node:assert/strict';
import {cellParagraphPlan} from '../src/modules/document/domain/cell-paragraph.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
import {generationSchema} from '../src/modules/document/public/wire-schema.mjs';
import {captureTemplate} from '../src/modules/automation/public/index.ts';
import {nativeSchema,parseGeneration} from '../../launcher/providers/native-common.mjs';
const op:any={kind:'replace_cell_paragraph',target:'s0p0t0',row:0,column:0,paragraph:1,originalText:'두 번째 문단',text:'수정 문단 😀'};
const base=():any=>({name:'merged.hwpx',revision:'one',nodes:[],structure:{sections:[],paragraphs:[],tables:[{id:op.target,editable:true,rows:2,columns:2,cells:[{index:0,row:0,column:0,rowSpan:1,columnSpan:2,editable:false,text:'첫 문단\n두 번째 문단',properties:{cellProtect:false}},{index:1,row:1,column:0,rowSpan:1,columnSpan:1,editable:true,text:'아래',properties:{cellProtect:false}}]}]},cellParagraphSources:{[op.target]:{editable:true,fingerprint:'a'.repeat(64),cells:[{index:0,row:0,column:0,rowSpan:1,columnSpan:2,paragraphs:[{index:0,text:'첫 문단'},{index:1,text:'두 번째 문단'}]}]}}});
test('strict provider nulls preserve existing ordinary-cell edits and optional character spans',()=>{
 const schema=nativeSchema([],true).properties.operations.items.anyOf.find((v:any)=>v.properties.kind.enum[0]==='set_table_cell');
 assert.ok(schema.required.includes('paragraph')&&schema.required.includes('spanTexts'));
 const ordinary={kind:'set_table_cell',target:op.target,row:1,column:0,originalText:'아래',text:'수정'};
 const styled={...op,spanFormats:[{start:0,end:1,bold:true}]};
 for(const [wire,expected] of [[{...ordinary,paragraph:null,spanTexts:null},ordinary],[{...op,spanTexts:null,spanFormats:null},op],
  [{...styled,spanTexts:null,spanFormats:[{...styled.spanFormats[0],italic:null,color:null,fontSizePt:null}]},styled]]){
  const {operations}=parseGeneration(JSON.stringify({message:'편집',sourceIds:[],operations:[wire]}),true);
  assert.deepEqual(validateEditOperations(operations,base()),[expected]);
 }
});
test('new character styles can change formatting alone and reject overlapping, unsafe or field-bound ranges',()=>{
 const s=base(),style={...op,text:op.originalText,spanFormats:[{start:1,end:3,italic:true}]};
 assert.deepEqual(cellParagraphPlan(style,s).edits,[]);
 for(const ranges of [[],[{start:1,end:2}], [{start:0,end:2,bold:'yes'}], [{start:0,end:2,styleId:0}],
  [{start:0,end:2,color:'red'}],[{start:0,end:2,fontSizePt:0}],[{start:1,end:3,bold:true},{start:2,end:4,bold:false}],
  [{start:0,end:99,bold:true}]]){
  assert.throws(()=>cellParagraphPlan({...style,spanFormats:ranges} as any,s));
 }
 s.cellParagraphSources[op.target].cells[0].paragraphs[1].editableFrom=2;
 assert.throws(()=>cellParagraphPlan(style,s));assert.doesNotThrow(()=>cellParagraphPlan({...style,spanFormats:[{start:2,end:3,bold:true}]},s));
});
test('repeated picture deletion requires all equivalent positions to share one style and picture region',()=>{
 const s=base(),originalText='가😀가😀P',change={...op,originalText,text:'가😀P'};
 const p=s.cellParagraphSources[op.target].cells[0].paragraphs[1];
 Object.assign(p,{text:originalText,editableFrom:5,pictureTextRanges:[{start:0,end:4}],
   formatSpans:[{start:0,end:4},{start:4,end:5}]});
 const before=structuredClone(s),edit={run:0,start:0,remove:2,insert:''};
 assert.deepEqual(cellParagraphPlan(change,s).pictureEdit,edit);
 assert.deepEqual(cellParagraphPlan(change,s).edits,[edit]);assert.deepEqual(s,before);
 for(const patch of [
   {formatSpans:[{start:0,end:2},{start:2,end:4},{start:4,end:5}]},
   {pictureTextRanges:[{start:0,end:2},{start:3,end:4}]},
   {pictureTextRanges:undefined},
   {editableFrom:3},
 ]){
  const invalid=structuredClone(s);Object.assign(invalid.cellParagraphSources[op.target].cells[0].paragraphs[1],patch);
  assert.throws(()=>cellParagraphPlan(change,invalid));
 }
 assert.throws(()=>cellParagraphPlan({...change,spanFormats:[{start:0,end:1,bold:true}]},s));
});
test('cell paragraph is an explicit neutral single-paragraph contract',()=>{const shapes=generationSchema().properties.operations.items.anyOf,shape=shapes.find(s=>s.properties.kind.enum[0]===op.kind);assert.ok(shape);assert.deepEqual(shape.required,['kind','target','row','column','paragraph','originalText','text']);});
test('exact merged anchor and paragraph content returns a pure plan',()=>{const s=base(),before=structuredClone(s),plan=cellParagraphPlan(op,s);assert.equal(plan.cell.index,0);assert.equal(plan.paragraph.index,1);assert.deepEqual(s,before);assert.deepEqual(validateEditOperations([op],s),[op]);});
test('existing set_table_cell does not gain merged or multiparagraph support',()=>{const {paragraph,...whole}=op;assert.throws(()=>validateEditOperations([{...whole,kind:'set_table_cell',originalText:'첫 문단\n두 번째 문단'}],base()));});
test('empty replacement is an empty paragraph, while a no-op refuses',()=>{assert.equal(cellParagraphPlan({...op,text:''},base()).paragraph.text,op.originalText);assert.throws(()=>cellParagraphPlan({...op,text:op.originalText},base()));});
test('unknown paragraph fields and malformed numeric/text args refuse',()=>{for(const change of [{force:true},{properties:{}},{paragraph:-1},{paragraph:0.5},{paragraph:'1'},{text:'x\nnext'},{text:'x\tbad'},{text:'x'.repeat(4001)},{text:null},{row:NaN},{column:Infinity}])assert.throws(()=>cellParagraphPlan({...op,...change},base()));});
test('unmerged and absorbed coordinates, aliases and incorrect original text refuse',()=>{for(const change of [{row:1,column:0},{column:1},{paragraph:999},{originalText:'incorrect'},{target:'@new'},{kind:'set_cell_paragraph'}])assert.throws(()=>cellParagraphPlan({...op,...change},base()));});
test('unknown formats, unread/forged caps and protection refuse',()=>{for(const change of [(s:any)=>s.name='merged.docx',(s:any)=>delete s.cellParagraphSources,(s:any)=>s.cellParagraphSources[op.target].editable=false,(s:any)=>s.cellParagraphSources[op.target].fingerprint='wrong',(s:any)=>s.structure.tables[0].editable=false,(s:any)=>s.structure.tables[0].cells[0].properties.cellProtect=true,(s:any)=>s.cellParagraphSources[op.target].cells[0].index=1]){const s=base();change(s);assert.throws(()=>cellParagraphPlan(op,s));}});
test('single-operation and macro restrictions remain explicit',()=>{assert.throws(()=>validateEditOperations([op,op],base()),/단독/);assert.throws(()=>captureTemplate('병합 셀',[op]));});

test('explicit run replacements keep Unicode boundaries and can remove exactly the requested style',()=>{
 const s=base(),p=s.cellParagraphSources[op.target].cells[0].paragraphs[1];
 p.formatSpans=[{start:0,end:2},{start:2,end:Array.from(op.originalText).length}];
 const change={...op,spanTexts:['계획😀 ','수정'],text:'계획😀 수정'};
 assert.equal(cellParagraphPlan(change,s).edits.length,2);
 assert.deepEqual(cellParagraphPlan({...change,spanTexts:['','계획😀 수정']},s).edits[0],{run:0,start:0,remove:2,insert:''});
 for(const spanTexts of [['계획😀 수정'],['계획😀 ','수정','extra'],['계획','수정']])
  assert.throws(()=>cellParagraphPlan({...change,spanTexts},s));
});
