import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import init,{HwpDocument} from '@rhwp/core';
import {readStructure} from '../src/document-control/structure.ts';
import {executeDocumentOperations} from '../src/document-control/execute.ts';
import {validateGeneration} from '../src/mvp/edit-schema.ts';
import type {Snapshot} from '../src/mvp/model.ts';
await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
const snapshot=(doc:HwpDocument):Snapshot=>({revision:'fixture',name:'fixture.hwpx',limitations:[],structure:readStructure(doc),nodes:Array.from({length:doc.getParagraphCount(0)},(_,p)=>({id:'s0p'+p,section:0,paragraph:p,text:doc.getTextRange(0,p,0,doc.getParagraphLength(0,p)),editable:true}))});
for(const format of ['hwp','hwpx'] as const)test(`${format}: 단색 셀 배경은 무늬 없음 -1로 저장하여 재열기 전후 전체 구조가 일치한다`,()=>{
 const fresh=HwpDocument.createEmpty();fresh.createBlankDocument();fresh.insertText(0,0,0,'추진 일정');
 const bytes=format==='hwp'?fresh.exportHwp():fresh.exportHwpx();fresh.free();const doc=new HwpDocument(bytes);
 try{
  const base=snapshot(doc),generation=validateGeneration({message:'합성 표',sourceIds:[],operations:[{kind:'create_table',after:'s0p0',resultId:'t',rows:[['항목','일정'],['준비','1월']]},{kind:'format_table_cells',target:'@t',startRow:0,rowCount:1,startColumn:0,columnCount:2,properties:{bold:true,background:'#eeeeee'}}]},base,[]);
  executeDocumentOperations(doc,base,generation.operations);const expected=readStructure(doc);
  assert.ok(expected.tables[0].cells.slice(0,2).every(c=>c.properties.fillType==='solid'&&c.properties.fillColor==='#eeeeee'&&c.properties.patternType===-1));
  const artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();try{assert.equal(JSON.parse(artifact.contentLoss()).count,0);const reopened=new HwpDocument(artifact.takeBytes());try{assert.equal(reopened.getTextFileUnicode(),doc.getTextFileUnicode());assert.deepEqual(readStructure(reopened),expected);}finally{reopened.free();}}finally{artifact.free();}
 }finally{doc.free();}
});
