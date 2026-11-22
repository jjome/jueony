import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {createInstitutionTemplateCopy,inspectInstitutionTemplate} from '../src/adapters/rhwp/institution-template-copy.ts';
import {readHwpReferenceText} from '../src/adapters/rhwp/reference-locations.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';

test('a user-supplied template copies both formats, fills only marked body and table fields and preserves source styles',{
 skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
 const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
 const wasm=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
 await wasm.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
 const {HwpDocument}=wasm,doc=HwpDocument.createEmpty();
 try{
  doc.createBlankDocument();
  doc.insertText(0,0,0,'기관명 {{기관}}');
  doc.applyCharFormat(0,0,0,doc.getParagraphLength(0,0),JSON.stringify({fontSize:1400,bold:true}));
  doc.splitParagraph(0,0,doc.getParagraphLength(0,0));
  doc.insertText(0,1,0,'제출 요청 {{본문:요청 내용}}');
  doc.splitParagraph(0,1,doc.getParagraphLength(0,1));
  const table=JSON.parse(doc.createTable(0,2,0,1,2));
  doc.insertTextInCell(0,table.paraIdx,table.controlIdx,0,0,0,'담당');
  doc.insertTextInCell(0,table.paraIdx,table.controlIdx,1,0,0,'{{기관}}');
  for(const format of ['hwp','hwpx']){
   const source=format==='hwp'?doc.exportHwp():doc.exportHwpx();
   const path='official.'+format,original=new HwpDocument(source);
   const bytes=Uint8Array.from(source);
   try{
    assert.deepEqual(inspectInstitutionTemplate(HwpDocument,source,path),[{name:'기관',draft:false},{name:'요청 내용',draft:true}]);
    assert.throws(()=>createInstitutionTemplateCopy(HwpDocument,source,path,{기관:'시설과'}),/필수 입력/u);
    assert.throws(()=>createInstitutionTemplateCopy(HwpDocument,source,path,{기관:'{{중첩}}','요청 내용':'오늘 제출'}),/한 줄/u);
    const output=createInstitutionTemplateCopy(HwpDocument,source,path,{기관:'시설과','요청 내용':'오늘 자료를 제출합니다.'});
    assert.deepEqual(source,bytes);
    const reopened=new HwpDocument(output);
    try{
     assert.match(readHwpReferenceText(reopened),/기관명 시설과.*제출 요청 오늘 자료를 제출합니다/su);
     assert.match(readHwpReferenceText(original),/\{\{기관\}\}/u);
     assert.deepEqual(readStructure(reopened).tables[0].cells.map(cell=>cell.text),['담당','시설과']);
     assert.equal(JSON.parse(reopened.getCharPropertiesAt(0,0,0)).fontSize,1400);
     assert.deepEqual(JSON.parse(reopened.getPageDef(0)),JSON.parse(original.getPageDef(0)));
    }finally{reopened.free();}
   }finally{original.free();}
  }
 }finally{doc.free();}
});
