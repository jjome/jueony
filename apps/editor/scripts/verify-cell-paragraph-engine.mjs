import assert from 'node:assert/strict';
import {continuedMergedTable,fragmentedMergedCell} from './lib/continued-merged-table.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {readCellParagraphSources,executeCellParagraph,assertCellParagraphResult} from '../src/adapters/rhwp/cell-paragraph.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';

import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/cell-paragraph-native');await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(pkg+'/rhwp.js'));await init({module_or_path:await readFile(pkg+'/rhwp_bg.wasm')});
const results=[],failures=[],json=v=>typeof v==='string'?JSON.parse(v):v;
const casePattern=process.env.JUEONY_CASE_PATTERN?new RegExp(process.env.JUEONY_CASE_PATTERN,'u'):undefined;
async function scenario(name,run){if(casePattern&&!casePattern.test(name))return;try{await run();results.push(name);console.log('PASS',name);}catch(e){failures.push({name,error:String(e),stack:e.stack});console.log('FAIL',name,e.message);}}
function fixture(){const d=HwpDocument.createEmpty();d.createBlankDocument();d.insertText(0,0,0,'Body preserved');d.splitParagraph(0,0,d.getParagraphLength(0,0));d.createTable(0,1,0,3,3);for(let i=0;i<9;i++){d.insertTextInCell(0,1,0,i,0,0,'Cell '+i);d.setCellProperties(0,1,0,i,'{"width":12000,"height":5000}');}d.applyCharFormatInCell(0,1,0,1,0,0,6,'{"bold":true}');d.applyParaFormatInCell(0,1,0,1,0,'{"alignment":"center"}');d.mergeTableCells(0,1,0,0,0,0,1);d.splitParagraph(0,1,d.getParagraphLength(0,1));d.createTable(0,2,0,2,2);d.insertTextInCell(0,2,0,0,0,0,'Other');const r=new HwpDocument(d.exportHwpx());d.free();return r;}
const snap=(d,name='candidate.hwpx')=>{const structure=readStructure(d);return {revision:'r1',name,nodes:[],limitations:[],structure,cellParagraphSources:readCellParagraphSources(d,structure.tables,name)};};
function transactionalCandidate(d,s,ops,revision){if(revision!==s.revision)throw Error('Stale revision');const token=d.saveSnapshot();try{validateEditOperations(ops,s);return executeDocumentOperations(d,s,ops);}catch(e){d.restoreSnapshot(token);throw e;}finally{d.discardSnapshot(token);}}
function resources(bytes){const b=Buffer.from(bytes),map={};let at=0;while(at+30<b.length&&b.readUInt32LE(at)===0x04034b50){const flags=b.readUInt16LE(at+6),method=b.readUInt16LE(at+8),size=b.readUInt32LE(at+18),nameLen=b.readUInt16LE(at+26),extra=b.readUInt16LE(at+28),name=b.subarray(at+30,at+30+nameLen).toString('utf8'),start=at+30+nameLen+extra;assert.equal(flags&8,0);if(name==='Contents/header.xml'||name.startsWith('BinData/'))map[name]=(method===0?b.subarray(start,start+size):inflateRawSync(b.subarray(start,start+size))).toString('base64');at=start+size;}assert.ok(map['Contents/header.xml']);return map;}
const command=(s,p=1,text='New merged paragraph 😀')=>({kind:'replace_cell_paragraph',target:s.structure.tables[0].id,row:0,column:0,paragraph:p,originalText:s.cellParagraphSources[s.structure.tables[0].id]?.cells?.[0].paragraphs[p].text,text});
for (const format of ['hwp','hwpx']) await scenario(format+' multi-run merged paragraph preserves every original style across edit, undo, redo and reopen',()=>{
 const template=fixture(),exportDoc=doc=>format==='hwp'?doc.exportHwp():doc.exportHwpx();
 template.applyCharFormatInCell(0,1,0,0,1,1,4,'{"italic":true}');
 const doc=new HwpDocument(exportDoc(template));template.free();
 const name='runs.'+format,args=[0,1,0,0,1],styles=(d,positions)=>positions.map(n=>json(d.getCellCharPropertiesAt(...args,n)));
 try {
  const base=snap(doc,name),original=exportDoc(doc),old=styles(doc,[0,1,4]),undo=doc.saveSnapshot();
  const parts=['앞😀','가운데','뒤'],text=parts.join('');
  transactionalCandidate(doc,base,[{...command(base,1,text),spanTexts:parts}],'r1');
  const bytes=exportDoc(doc),reopened=new HwpDocument(bytes);
  try {assert.equal(reopened.getTextInCell(...args,0,6),text);assert.deepEqual(styles(reopened,[0,2,5]),old);}
  finally {reopened.free();}
  const redo=doc.saveSnapshot();
  doc.restoreSnapshot(undo);assert.deepEqual(exportDoc(doc),original);
  doc.restoreSnapshot(redo);assert.deepEqual(exportDoc(doc),bytes);
  doc.discardSnapshot(undo);doc.discardSnapshot(redo);
 } finally {doc.free();}
});
for(const format of ['hwp','hwpx']){
 await scenario(format+' creates only the requested character definitions at Unicode result offsets',()=>{
  const template=fixture(),save=d=>format==='hwp'?d.exportHwp():d.exportHwpx(),args=[0,1,0,0,1];
  template.applyCharFormatInCell(...args,1,4,'{"italic":true}');
  const d=new HwpDocument(save(template));template.free();
  const header=doc=>Buffer.from(resources(doc.exportHwpx())['Contents/header.xml'],'base64').toString('utf8');
  const entries=xml=>xml.match(/<hh:charPr\s[^>]+>[\s\S]*?<\/hh:charPr>/gu);
  const outside=xml=>xml.replace(/<hh:charProperties\b[\s\S]*?<\/hh:charProperties>/u,'');
  try{
   const base=snap(d,'styles.'+format),before=save(d),old=header(d),undo=d.saveSnapshot();
   const op={...command(base,1,'A😀betaC'),spanTexts:['A😀','beta','C'],spanFormats:[
    {start:1,end:4,bold:false,color:'#13579B',fontSizePt:14.5},{start:6,end:7,italic:true,color:'#21904f'}]};
   transactionalCandidate(d,base,[op],'r1');
   const next=header(d),oldEntries=entries(old),newEntries=entries(next);
   assert.deepEqual(newEntries.slice(0,oldEntries.length),oldEntries);
   assert.equal(outside(next),outside(old));assert.equal(newEntries.length,oldEntries.length+3);
   const edited=save(d),reopened=new HwpDocument(edited);
   try{
    assert.equal(reopened.getTextInCell(...args,0,7),op.text);
    const shape=at=>json(reopened.getCellCharPropertiesAt(...args,at));
    assert.deepEqual([1,2,3].map(i=>shape(i).textColor),Array(3).fill('#13579b'));
    assert.equal(shape(1).italic,false);assert.equal(shape(2).italic,true);assert.equal(shape(3).fontSize,1450);
    assert.equal(shape(4).textColor,shape(0).textColor);assert.equal(shape(6).textColor,'#21904f');
   }finally{reopened.free();}
   const redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(save(d),before);
   d.restoreSnapshot(redo);assert.deepEqual(save(d),edited);d.discardSnapshot(undo);d.discardSnapshot(redo);
   const after=snap(d,'styles.'+format),styleOnly={...command(after,1,op.text),spanFormats:[{start:0,end:1,italic:true}]};
   transactionalCandidate(d,after,[styleOnly],'r1');
   assert.equal(json(d.getCellCharPropertiesAt(...args,0)).italic,true);
   assert.throws(()=>transactionalCandidate(d,snap(d,'styles.'+format),[styleOnly],'r1'),/이미/);
   const beforeFault=save(d),apply=d.applyCharFormatInCell.bind(d);
   d.applyCharFormatInCell=(...a)=>{const result=apply(...a);d.findOrCreateFontIdForLang(0,'Unexpected unused font');return result;};
   assert.throws(()=>transactionalCandidate(d,snap(d,'styles.'+format),[{...styleOnly,spanFormats:[{start:0,end:1,bold:false}]}],'r1'));
   assert.deepEqual(save(d),beforeFault);
  }finally{d.free();}
 });
 await scenario(format+' edits only the suffix following a stored click-here field in the merged paragraph',()=>{
  const template=fixture(),save=d=>format==='hwp'?d.exportHwp():d.exportHwpx(),args=[0,1,0,0,1];
  const created=json(template.insertClickHereFieldInCell(...args,1,false,'FIELD','memo','input',true));
  assert.equal(created.ok,true);
  const doc=new HwpDocument(save(template)),name='field.'+format;template.free();
  try{
   const base=snap(doc,name),cap=base.cellParagraphSources[base.structure.tables[0].id];
   assert.equal(cap.editable,true);assert.equal(cap.cells[0].paragraphs[1].editableFrom,2);
   const original=save(doc),fields=json(doc.getFieldList()),op=command(base,1,'Ce수정😀');
   assert.throws(()=>transactionalCandidate(doc,base,[{...op,text:'X변경'}],'r1'),/필드/);
   assert.deepEqual(save(doc),original);
   const undo=doc.saveSnapshot();transactionalCandidate(doc,base,[op],'r1');
   const saved=save(doc),reopened=new HwpDocument(saved);
   try{
    assert.deepEqual(json(reopened.getFieldList()),fields);
    assert.equal(reopened.getTextInCell(...args,0,5),op.text);
   }finally{reopened.free();}
   doc.restoreSnapshot(undo);assert.deepEqual(save(doc),original);doc.discardSnapshot(undo);
  }finally{doc.free();}
 });
 await scenario(format+' preserves two click-here fields during a suffix edit',()=>{
  const args=[0,1,0,0,1],template=fixture(),save=d=>format==='hwp'?d.exportHwp():d.exportHwpx();
  for(const pos of [3,1])assert.equal(json(template.insertClickHereFieldInCell(...args,pos,false,'FIELD','memo','field'+pos,true)).ok,true);
  const doc=new HwpDocument(save(template));template.free();
  try{
   const name='two-fields.'+format,base=snap(doc,name),cell=base.cellParagraphSources[base.structure.tables[0].id].cells[0];
   assert.equal(cell.paragraphs[1].editableFrom,4);
   const before=save(doc),fields=json(doc.getFieldList()),prefix=cell.paragraphs[1].text.slice(0,4);
   const op=command(base,1,prefix+'수정😀');
   assert.throws(()=>transactionalCandidate(doc,base,[{...op,text:prefix.slice(0,2)+'XX수정😀'}],'r1'),/필드/);
   assert.deepEqual(save(doc),before);
   transactionalCandidate(doc,base,[op],'r1');
   const reopened=new HwpDocument(save(doc));
   try{assert.deepEqual(json(reopened.getFieldList()),fields);assert.equal(reopened.getTextInCell(...args,0,7),op.text);}
   finally{reopened.free();}
  }finally{doc.free();}
 });
 await scenario(format+' preserves adjacent click-here fields when editing ordinary suffix text',()=>{
  const args=[0,1,0,0,1],template=fixture(),save=d=>format==='hwp'?d.exportHwp():d.exportHwpx();
  for(const pos of [1,0])assert.equal(json(template.insertClickHereFieldInCell(...args,pos,false,'FIELD','memo','field'+pos,true)).ok,true);
  const doc=new HwpDocument(save(template));template.free();
  try{
   const before=save(doc),fields=json(doc.getFieldList()),s=snap(doc,'adjacent.'+format);
   const paragraph=s.cellParagraphSources[s.structure.tables[0].id].cells[0].paragraphs[1];
   assert.equal(paragraph.editableFrom,2);
   const prefix=Array.from(paragraph.text).slice(0,2).join('');
   assert.throws(()=>transactionalCandidate(doc,s,[command(s,1,'금지')],'r1'),/필드/);
   assert.deepEqual(save(doc),before);
   const op=command(s,1,prefix+'수정😀');
   const cursor=transactionalCandidate(doc,s,[op],'r1');
   assert.equal(cursor.charOffset,paragraph.editableFrom);
   const reopened=new HwpDocument(save(doc));
   try{
    assert.deepEqual(json(reopened.getFieldList()),fields);
    assert.equal(reopened.getTextInCell(...args,0,reopened.getCellParagraphLength(...args)),op.text);
   }finally{reopened.free();}
  }finally{doc.free();}
 });
 await scenario(format+' updates only the value of the addressed named merged cell',()=>{
  const template=fixture(),save=d=>format==='hwp'?d.exportHwp():d.exportHwpx();
  template.setCellProperties(0,1,0,0,JSON.stringify({fieldName:'계획명'}));
  template.setCellProperties(0,1,0,2,JSON.stringify({fieldName:'담당부서'}));
  const d=new HwpDocument(save(template));template.free();
  try{
   const name='named.'+format,base=snap(d,name),original=json(d.getFieldList()),[owner,neighbor]=original;
   const op=command(base,0,'계획😀'),undo=d.saveSnapshot();
   transactionalCandidate(d,base,[op],'r1');
   const after=save(d),reopened=new HwpDocument(after);
   try{
    assert.deepEqual(json(reopened.getFieldList()),[{...owner,value:op.text,endCharIdx:3},neighbor]);
    assert.equal(json(reopened.getFieldValue(owner.fieldId)).value,op.text);
    assert.equal(reopened.getTextInCell(0,1,0,0,1,0,6),'Cell 1');
   }finally{reopened.free();}
   const redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(json(d.getFieldList()),original);
   d.restoreSnapshot(redo);assert.deepEqual(save(d),after);d.discardSnapshot(undo);d.discardSnapshot(redo);
   const latest=snap(d,name);
   // Identical field lists cannot prove that the reopened ID resolves to its own value.
   d.constructor=function(bytes){
    const copy=new HwpDocument(bytes),get=copy.getFieldValue.bind(copy);
    copy.getFieldValue=id=>id===owner.fieldId?get(neighbor.fieldId):get(id);
    return copy;
   };
   assert.throws(()=>transactionalCandidate(d,latest,[command(latest,0,'다른 계획')],'r1'),/이름 셀/);
   assert.deepEqual(save(d),after);
   const read=d.getFieldValue.bind(d);
   d.getFieldValue=id=>id===owner.fieldId?read(neighbor.fieldId):read(id);
   assert.equal(snap(d,name).cellParagraphSources[base.structure.tables[0].id].editable,false);
  }finally{d.free();}
 });
 await scenario(format+' edits a merged form cell with a verified body bookmark and filled field',()=>{
  const template=fixture(),save=d=>format==='hwp'?d.exportHwp():d.exportHwpx();
  const body=json(template.insertClickHereField(0,0,4,'담당자','','작성자',true));
  assert.equal(json(template.setFieldValue(body.fieldId,'김😀')).ok,true);
  assert.equal(json(template.insertClickHereField(0,0,9,'일자','','작성일',true)).ok,true);
  assert.equal(json(template.addBookmark(0,0,2,'기안 위치')).ok,true);
  template.insertClickHereFieldInCell(0,1,0,0,1,1,false,'제목','','업무명',true);
  const doc=new HwpDocument(save(template));template.free();
  const records=d=>[json(d.getBookmarks()),json(d.getFieldList()),d.getTextRange(0,0,0,d.getParagraphLength(0,0))];
  try{
   const before=records(doc),bytes=save(doc),state=snap(doc,'form.'+format);
   const paragraph=state.cellParagraphSources[state.structure.tables[0].id].cells[0].paragraphs[1];
   assert.equal(paragraph.editableFrom,2);
   const op=command(state,1,Array.from(paragraph.text).slice(0,2).join('')+'수정😀');
   const insert=doc.insertTextInCell.bind(doc);
   doc.insertTextInCell=(...args)=>{const result=insert(...args);doc.renameBookmark('기안 위치','변경');return result;};
   assert.throws(()=>transactionalCandidate(doc,state,[op],'r1'));
   assert.deepEqual(save(doc),bytes);
   doc.insertTextInCell=insert;
   transactionalCandidate(doc,state,[op],'r1');
   const reopened=new HwpDocument(save(doc));
   try{assert.deepEqual(records(reopened),before);assert.equal(reopened.getTextInCell(0,1,0,0,1,0,5),op.text);}
   finally{reopened.free();}
   const positions=doc.getControlTextPositions.bind(doc);
   doc.getControlTextPositions=()=>JSON.stringify(Array(10).fill(4));
   assert.equal(snap(doc,'form.'+format).cellParagraphSources[state.structure.tables[0].id].editable,false);
   doc.getControlTextPositions=positions;
   const detail=doc.getFieldInfoAt.bind(doc);
   doc.getFieldInfoAt=(...args)=>JSON.stringify({...json(detail(...args)),fieldId:0});
   assert.equal(snap(doc,'form.'+format).cellParagraphSources[state.structure.tables[0].id].editable,false);
  }finally{doc.free();}
 });
 await scenario(format+' scopes click-here boundaries to their own root table and cell',()=>{
  const template=fixture(),save=d=>format==='hwp'?d.exportHwp():d.exportHwpx(),name='foreign-fields.'+format;
  template.mergeTableCells(0,2,0,0,0,0,1);
  const add=(para,cell,label)=>json(template.insertClickHereFieldInCell(0,para,0,cell,0,1,false,'안내','도움말',label,true)).fieldId;
  add(1,0,'대상');add(1,2,'같은 표 이웃');const remote=add(2,0,'다른 표');
  assert.equal(json(template.setFieldValue(remote,'자😀료')).ok,true);
  template.splitParagraph(0,2,template.getParagraphLength(0,2));template.createTable(0,3,0,1,1);
  assert.equal(json(template.insertTableFormulaField(0,3,0,0,'','=4','%g')).value,'4');
  const doc=new HwpDocument(save(template));template.free();
  try{
   const base=snap(doc,name),[table,other]=base.structure.tables,fields=json(doc.getFieldList());
   const local=base.cellParagraphSources[table.id],foreign=base.cellParagraphSources[other.id];
   assert.equal(local.cells[0].paragraphs[0].editableFrom,2);
   assert.equal(local.cells.find(c=>c.index===2).paragraphs[0].editableFrom,2);
   assert.equal(local.cells[0].paragraphs[1].editableFrom,undefined);
   assert.equal(foreign.cells[0].paragraphs[0].editableFrom,5);
   assert.equal(fields.find(f=>f.fieldId===remote).value,'자😀료');
   const before=save(doc),op=command(base,0,'Ce수정😀');
   assert.throws(()=>transactionalCandidate(doc,base,[{...op,text:'C수정😀'}],'r1'),/필드/);
   assert.deepEqual(save(doc),before);
   transactionalCandidate(doc,base,[op],'r1');
   const reopened=new HwpDocument(save(doc));
   try{
    assert.equal(reopened.getTextInCell(0,1,0,0,0,0,5),op.text);
    assert.equal(reopened.getTextInCell(0,2,0,0,0,0,8),'O자😀료ther');
    assert.deepEqual(json(reopened.getFieldList()),fields);
   }finally{reopened.free();}
   // Losing the guide state on reopen need not change the field list or its text.
   const edited=snap(doc,name),beforeFault=save(doc);
   doc.constructor=function(bytes){
    const copy=new HwpDocument(bytes),read=copy.getFieldInfoAtInCell.bind(copy);
    copy.getFieldInfoAtInCell=(...args)=>{
     const info=json(read(...args));
     if(info.fieldId===remote)info.isGuide=!info.isGuide;
     return JSON.stringify(info);
    };
    return copy;
   };
   assert.throws(()=>transactionalCandidate(doc,edited,[command(edited,0,'Ce다시 수정')],'r1'),/저장 후 (책갈피|누름틀)/);
   assert.deepEqual(save(doc),beforeFault);
  }finally{doc.free();}
 });
 await scenario(format+' rejects overlapping, protected or misidentified click-here fields in another root table',()=>{
  const save=d=>format==='hwp'?d.exportHwp():d.exportHwpx(),args=[0,2,0,0,0];
  for(const mode of ['overlap','protected','wrong-field']){
   const template=fixture();
   template.insertClickHereFieldInCell(...args,1,false,'하나','','입력1',true);
   if(mode==='overlap')template.insertClickHereFieldInCell(...args,1,false,'둘','','입력2',true);
   if(mode==='protected')template.setCellProperties(0,2,0,0,'{"cellProtect":true}');
   const doc=new HwpDocument(save(template));template.free();
   try{
    if(mode==='wrong-field'){
     const read=doc.getFieldInfoAtInCell.bind(doc);
     doc.getFieldInfoAtInCell=(...a)=>{const info=json(read(...a));return JSON.stringify({...info,fieldId:info.fieldId+1});};
    }
    const before=save(doc),base=snap(doc,'foreign-invalid.'+format),t=base.structure.tables[0];
    assert.equal(base.cellParagraphSources[t.id].editable,false,mode);
    assert.throws(()=>transactionalCandidate(doc,base,[{kind:'replace_cell_paragraph',target:t.id,row:0,column:0,
     paragraph:0,originalText:'Cell 0',text:'시도'}],'r1'));
    assert.deepEqual(save(doc),before);
   }finally{doc.free();}
  }
 });
 await scenario(format+' preserves neighbor FORMULA fields in the same and another root table',()=>{
  const template=fixture(),save=d=>format==='hwp'?d.exportHwp():d.exportHwpx(),name='neighbor-formula.'+format;
  template.deleteTextInCell(0,1,0,1,0,0,6);template.insertTextInCell(0,1,0,1,0,0,'3');
  assert.equal(json(template.insertTableFormulaField(0,1,0,4,'Cell 5','=C1*2','%g')).value,'6');
  template.mergeTableCells(0,2,0,1,0,1,1);
  assert.equal(json(template.insertTableFormulaField(0,2,0,1,'','=2+3','%g')).value,'5');
  const doc=new HwpDocument(save(template));template.free();
  try{
   const base=snap(doc,name),table=base.structure.tables[0],allowed=base.cellParagraphSources[table.id];
   assert.equal(allowed.editable,true);
   assert.ok(!allowed.cells.some(c=>c.index===1||c.index===4));
   const op=command(base,1,'이웃 계산식 보존'),fields=json(doc.getFieldList());
   transactionalCandidate(doc,base,[op],'r1');
   const reopened=new HwpDocument(save(doc));
   try{
    assert.deepEqual(json(reopened.getFieldList()),fields);
    assert.equal(reopened.getTextInCell(0,1,0,0,1,0,9),op.text);
   }finally{reopened.free();}
   const changed=snap(doc,name),beforeFault=save(doc),insert=doc.insertTextInCell.bind(doc);
   const field=fields.find(f=>f.location.paraIndex===1);
   doc.insertTextInCell=(...args)=>{
    const result=insert(...args);
    // A collateral command change can keep the same displayed value.
    assert.equal(json(doc.updateTableFormulaField(0,1,0,4,field.fieldId,field.command,'=C1+3','%g')).value,'6');
    return result;
   };
   try{assert.throws(()=>transactionalCandidate(doc,changed,[command(changed,1,'변경 시도')],'r1'),/보존|변경/);}
   finally{doc.insertTextInCell=insert;}
   assert.deepEqual(save(doc),beforeFault);
   // Simulate a stale cached formula. Reading capabilities must neither expose
   // this document for paragraph edits nor repair its stored display value.
   doc.deleteTextInCell(0,1,0,1,0,0,1);doc.insertTextInCell(0,1,0,1,0,0,'7');
   const stale=save(doc);assert.equal(snap(doc,name).cellParagraphSources[table.id].editable,false);
   assert.deepEqual(save(doc),stale);
  }finally{doc.free();}
 });
 await scenario(format+' rejects a neighbor FORMULA referencing a covered merged coordinate',()=>{
  const template=fixture(),save=d=>format==='hwp'?d.exportHwp():d.exportHwpx();
  template.mergeTableCells(0,2,0,1,0,1,1);
  assert.equal(template.getCellParagraphCount(0,2,0,2),1);
  template.insertTextInCell(0,2,0,2,0,0,'2');
  assert.equal(json(template.insertTableFormulaField(0,2,0,1,'','=B2*2','%g')).value,'4');
  const doc=new HwpDocument(save(template));template.free();
  try{
   const base=snap(doc,'covered-formula.'+format),table=base.structure.tables[1],before=save(doc);
   assert.equal(base.cellParagraphSources[base.structure.tables[0].id].editable,true);
   assert.equal(base.cellParagraphSources[table.id].editable,false);
   assert.throws(()=>transactionalCandidate(doc,base,[{kind:'replace_cell_paragraph',target:table.id,row:1,column:0,
    paragraph:0,originalText:'2',text:'3'}],'r1'));
   assert.deepEqual(save(doc),before);
  }finally{doc.free();}
 });
 await scenario(format+' edits a paragraph spanning pages and rejects duplicated rendered text',()=>{
  const template=fragmentedMergedCell(HwpDocument),save=d=>format==='hwp'?d.exportHwp():d.exportHwpx();
  const doc=new HwpDocument(save(template)),name='fragment.'+format;template.free();
  try{
   const args=[0,1,0,0,0],base=snap(doc,name),table=base.structure.tables[0],original=save(doc);
   const parts=Array.from({length:doc.pageCount()},(_,p)=>json(doc.getPageControlLayout(p)).controls
    .some(t=>t.type==='table'&&t.cells.some(c=>c.row===0&&c.col===0&&c.colSpan===2)));
   assert.ok(parts.filter(Boolean).length>=2);
   const originalText=doc.getTextInCell(...args,0,doc.getCellParagraphLength(...args)),text=originalText.slice(0,-6)+'Tail 2';
   const op={kind:'replace_cell_paragraph',target:table.id,row:0,column:0,paragraph:0,originalText,text};
   const undo=doc.saveSnapshot();
   transactionalCandidate(doc,base,[op],'r1');
   const edited=save(doc),reopened=new HwpDocument(edited);
   try{
    assert.equal(reopened.getTextInCell(...args,0,Array.from(text).length),text);
    assert.equal(reopened.getTextInCell(0,1,0,0,1,0,6),'Cell 1');
   }finally{reopened.free();}
   const redo=doc.saveSnapshot();
   doc.restoreSnapshot(undo);assert.deepEqual(save(doc),original);
   doc.restoreSnapshot(redo);assert.deepEqual(save(doc),edited);doc.discardSnapshot(undo);doc.discardSnapshot(redo);
   const layout=doc.getPageTextLayout.bind(doc),last=parts.lastIndexOf(true);
   doc.getPageTextLayout=page=>{
    const view=json(layout(page));
    if(page===last)view.runs.find(r=>r.cellIdx===0&&r.cellParaIdx===0).charStart=0;
    return JSON.stringify(view);
   };
   assert.equal(snap(doc,name).cellParagraphSources[table.id].editable,false);
  }finally{doc.free();}
 });
 await scenario(format+' merged paragraph on a continuation page binds by document coordinates and restores cleanly',()=>{
  const source=continuedMergedTable(HwpDocument);
  const save=d=>format==='hwp'?d.exportHwp():d.exportHwpx(),d=new HwpDocument(save(source));source.free();
  try{
   const base=snap(d,'continued.'+format),table=base.structure.tables[0],cap=base.cellParagraphSources[table.id];
   assert.equal(cap.editable,true);assert.ok(d.pageCount()>1);
   const frame=JSON.parse(d.getPageControlLayout(1)).controls.find(c=>c.type==='table');
   const cell=cap.cells.find(c=>c.row===17&&c.column===0);
   assert.notEqual(frame.cells.find(c=>c.row===17&&c.col===0).cellIdx,cell.index);
   const old=save(d),undo=d.saveSnapshot(),text='다음 쪽 셀';
   transactionalCandidate(d,base,[{kind:'replace_cell_paragraph',target:table.id,row:17,column:0,paragraph:0,originalText:'cell 34',text}],'r1');
   const saved=save(d),reopened=new HwpDocument(saved);
   try{
    assert.equal(reopened.getTextInCell(0,1,0,cell.index,0,0,Array.from(text).length),text);
    assert.equal(reopened.getTextInCell(0,1,0,0,0,0,6),'cell 0');
    assert.equal(reopened.pageCount(),d.pageCount());
   }finally{reopened.free();}
   const redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(save(d),old);
   d.restoreSnapshot(redo);assert.deepEqual(save(d),saved);d.discardSnapshot(undo);d.discardSnapshot(redo);
   const layout=d.getPageControlLayout.bind(d);
   d.getPageControlLayout=page=>{
    const view=json(layout(page));if(page===1){const cells=view.controls.find(c=>c.type==='table').cells;cells[1]={...cells[0]};}
    return JSON.stringify(view);
   };
   assert.equal(snap(d,'continued.'+format).cellParagraphSources[table.id].editable,false);
  }finally{d.free();}
 });
 for(const [label,parts] of [
  ['first',['','ell',' 1']],['middle',['C','',' 1']],['last',['C','ell','']],
  ['middle alone',['','수정😀','']],['clear',['','','']],
 ])await scenario(format+' explicit style run deletion: '+label,()=>{
  const template=fixture(),save=d=>format==='hwp'?d.exportHwp():d.exportHwpx(),args=[0,1,0,0,1];
  template.applyCharFormatInCell(...args,1,4,'{"italic":true}');
  const d=new HwpDocument(save(template));template.free();
  try{
   const base=snap(d,'delete.'+format),text=parts.join(''),old=save(d),undo=d.saveSnapshot();
   const style=(doc,at)=>json(doc.getCellCharPropertiesAt(...args,at));
   const sourceStyles=[0,1,4].map(at=>style(d,at)),expected=parts.flatMap((part,index)=>Array.from(part,()=>sourceStyles[index]));
   transactionalCandidate(d,base,[{...command(base,1,text),spanTexts:parts}],'r1');
   const bytes=save(d),reopened=new HwpDocument(bytes);
   try{
    assert.equal(reopened.getTextInCell(...args,0,Array.from(text).length),text);
    for(const [offset,properties] of expected.entries())assert.deepEqual(style(reopened,offset),properties);
    if(!text)assert.deepEqual(style(reopened,0),sourceStyles[0]);
   }finally{reopened.free();}
   const redo=d.saveSnapshot();
   d.restoreSnapshot(undo);assert.deepEqual(save(d),old);
   d.restoreSnapshot(redo);assert.deepEqual(save(d),bytes);
   d.discardSnapshot(undo);d.discardSnapshot(redo);
  }finally{d.free();}
 });
}
await scenario('mixed merged paragraph preserves surrounding raw styles, Unicode offsets, definitions and persisted text',()=>{
 const initial=fixture();
 initial.applyCharFormatInCell(0,1,0,0,1,1,4,'{"italic":true}');
 const d=new HwpDocument(initial.exportHwpx());initial.free();
 try {
  const base=snap(d),original=d.exportHwpx(),table=base.structure.tables[0];
  const paragraph=base.cellParagraphSources[table.id].cells[0].paragraphs[1];
  assert.equal(paragraph.text,'Cell 1');assert.deepEqual(paragraph.formatSpans,[{start:0,end:1},{start:1,end:4},{start:4,end:6}]);
  for(const invalid of ['New text','C 1','C_ell 1','Cel 1']) {
   assert.throws(()=>transactionalCandidate(d,base,[command(base,1,invalid)],'r1'),/서식/);
   assert.deepEqual(d.exportHwpx(),original);
  }
  const args=[0,1,0,0,1],style=(doc,offset)=>json(doc.getCellCharPropertiesAt(...args,offset));
  const old=[0,1,4].map(i=>style(d,i)),undo=d.saveSnapshot();
  transactionalCandidate(d,base,[command(base,1,'C길어진😀 1')],'r1');
  const saved=d.exportHwpx(),r=new HwpDocument(saved);
  try {
   assert.equal(r.getTextInCell(...args,0,7),'C길어진😀 1');
   assert.deepEqual([0,1,5].map(i=>style(r,i)),old);
   assert.deepEqual(resources(saved),resources(original));
   assert.deepEqual(snap(r).cellParagraphSources[table.id].cells[0].paragraphs[1].formatSpans,[{start:0,end:1},{start:1,end:5},{start:5,end:7}]);
  } finally {r.free();}
  assert.equal(json(d.restoreSnapshot(undo)).ok,true);assert.deepEqual(d.exportHwpx(),original);d.discardSnapshot(undo);
 } finally {d.free();}
});
await scenario('public caps expose only paragraph indexes/texts and coordinates, no private Native IDs',()=>{const d=fixture();try{const s=snap(d),cap=s.cellParagraphSources[s.structure.tables[0].id];assert.equal(cap.editable,true);assert.deepEqual(Object.keys(cap).sort(),['cells','editable','fingerprint']);assert.deepEqual(Object.keys(cap.cells[0].paragraphs[0]).sort(),['index','text']);assert.ok(!/charShapeId|properties|resources|runs|fontIds/.test(JSON.stringify(cap)));}finally{d.free();}});
for(const [name,p,text] of [['second',1,'수정한 셀 문단 😀'],['first',0,'앞 문단 변경'],['clear',1,''],['wrapping',1,'보고서 내용 '.repeat(30)]])await scenario(name+': real merged paragraph edit, other state, strict save reopen and undo',async()=>{const d=fixture();try{const s=snap(d),before=d.exportHwpx(),saved=d.saveSnapshot();assert.equal(s.cellParagraphSources[s.structure.tables[0].id].editable,true);const cursor=transactionalCandidate(d,s,[command(s,p,text)],'r1');assert.equal(cursor.cellParaIndex,p);assert.equal(d.getTextInCell(0,1,0,0,p,0,d.getCellParagraphLength(0,1,0,0,p)),text);await writeFile(out+'/'+name+'.hwpx',d.exportHwpx());assert.deepEqual(resources(d.exportHwpx()),resources(before));const after=d.saveSnapshot();d.restoreSnapshot(saved);assert.deepEqual(d.exportHwpx(),before);d.restoreSnapshot(after);assert.equal(d.getTextInCell(0,1,0,0,p,0,d.getCellParagraphLength(0,1,0,0,p)),text);}finally{d.free();}});
for(const mode of ['hwp','mixed','protect','locked','field','bookmark','stale-neighbor','stale-format','absorbed-coordinate','batch','no-op','alias','invalid-paragraph','control-text','zone','unread-zone'])await scenario(mode+': unsupported or stale request leaves bytes unchanged',()=>{const d=fixture();try{let s=snap(d),op=command(s);assert.equal(s.cellParagraphSources[s.structure.tables[0].id].editable,true);if(mode==='hwp')s.name='candidate.hwp';if(mode==='zone')d.setCellZoneProperties(0,1,0,0,0,1,1,JSON.stringify({background:'#aabbcc'}));if(mode==='unread-zone'){const get=d.getTableProperties.bind(d);d.getTableProperties=(...args)=>{const props=json(get(...args));delete props.cellZoneCount;return JSON.stringify(props);};}if(mode==='mixed')d.applyCharFormatInCell(0,1,0,0,1,0,1,'{"italic":true}');if(mode==='protect')d.setCellProperties(0,1,0,1,'{"cellProtect":true}');if(mode==='locked')d.setControlLock(1,0,true);if(mode==='field')d.insertClickHereField(0,0,0,'field','','input',true);if(mode==='bookmark')d.addBookmark(0,0,0,'mark');if(mode==='stale-neighbor')d.insertTextInCell(0,2,0,0,0,0,'changed');if(mode==='stale-format')d.applyCharFormatInCell(0,1,0,0,0,0,6,'{"italic":true}');if(mode==='absorbed-coordinate')op.column=1;if(mode==='no-op')op.text=op.originalText;if(mode==='alias')op.kind='set_cell_paragraph';if(mode==='invalid-paragraph')op.paragraph=999;if(mode==='control-text')op.text='bad\nnew';const bytes=d.exportHwpx();assert.throws(()=>transactionalCandidate(d,s,mode==='batch'?[op,op]:[op],'r1'));assert.deepEqual(d.exportHwpx(),bytes);}finally{d.free();}});
for(const mode of ['delete-noop','insert-throw','shape-false','other-table-corruption','unused-font-resource'])await scenario(mode+': faulty native apply rolls back exact bytes',()=>{const d=fixture();try{const s=snap(d),op=command(s),before=d.exportHwpx();assert.equal(s.cellParagraphSources[s.structure.tables[0].id].editable,true);const insert=d.insertTextInCell.bind(d),del=d.deleteTextInCell.bind(d),shape=d.setCharShapeIdInCell.bind(d);if(mode==='delete-noop')d.deleteTextInCell=()=>'{"ok":true}';if(mode==='insert-throw')d.insertTextInCell=()=>{throw Error('injected');};if(mode==='shape-false')d.setCharShapeIdInCell=()=>'{"ok":false}';if(mode==='unused-font-resource')d.setCharShapeIdInCell=(...args)=>{const r=shape(...args);d.findOrCreateFontIdForLang(0,'Unexpected unused font');return r;};if(mode==='other-table-corruption')d.insertTextInCell=(...args)=>{const r=insert(...args);del(0,2,0,0,0,0,1);insert(0,2,0,0,0,0,'X');return r;};assert.throws(()=>transactionalCandidate(d,s,[op],'r1'));assert.deepEqual(d.exportHwpx(),before);d.insertTextInCell=insert;d.deleteTextInCell=del;d.setCharShapeIdInCell=shape;}finally{d.free();}});
await scenario('empty merged paragraph reinsertion preserves its stored character and paragraph style',()=>{const d=fixture();try{let s=snap(d);transactionalCandidate(d,s,[command(s,1,'')],'r1');s=snap(d);assert.equal(s.cellParagraphSources[s.structure.tables[0].id].cells[0].paragraphs[1].text,'');transactionalCandidate(d,s,[command(s,1,'다시 입력 😀')],'r1');assert.equal(d.getTextInCell(0,1,0,0,1,0,d.getCellParagraphLength(0,1,0,0,1)),'다시 입력 😀');}finally{d.free();}});
await scenario('application revision conflict rejects even when Native IR is unchanged',()=>{const d=fixture();try{const s=snap(d),before=d.exportHwpx();assert.throws(()=>transactionalCandidate(d,s,[command(s)],'r2'),/Stale revision/);assert.deepEqual(d.exportHwpx(),before);}finally{d.free();}});
await scenario('too-long text that fragments the table refuses after exact rollback',()=>{const d=fixture();try{const s=snap(d),before=d.exportHwpx();assert.throws(()=>transactionalCandidate(d,s,[command(s,1,'매우 긴 문단 '.repeat(400))],'r1'));assert.deepEqual(d.exportHwpx(),before);}finally{d.free();}});
await scenario('private proof requires this successful request and rejects restored or new failed request state',()=>{const d=fixture();try{const s=snap(d),op=command(s),before=d.saveSnapshot();assert.throws(()=>assertCellParagraphResult(d,s,op));transactionalCandidate(d,s,[op],'r1');assert.doesNotThrow(()=>assertCellParagraphResult(d,s,op));d.restoreSnapshot(before);d.discardSnapshot(before);assert.throws(()=>assertCellParagraphResult(d,s,op));assert.throws(()=>executeCellParagraph(d,s,{...op,paragraph:999}));assert.throws(()=>assertCellParagraphResult(d,s,op),/근거/);}finally{d.free();}});
await scenario('post-render observation cannot swap an existing raw character binding while resolved appearance matches',()=>{const d=fixture();try{const s=snap(d),op=command(s);transactionalCandidate(d,s,[op],'r1');const get=d.getCellCharPropertiesAt.bind(d);d.getCellCharPropertiesAt=(...args)=>{const value=json(get(...args));value.charShapeId+=1;return JSON.stringify(value);};assert.throws(()=>assertCellParagraphResult(d,s,op));d.getCellCharPropertiesAt=get;}finally{d.free();}});
if(casePattern&&!results.length&&!failures.length)throw Error('No matching cell paragraph scenario: '+casePattern);
await writeFile(out+'/result.json',JSON.stringify({results,failures,engine:JSON.parse(await readFile(pkg+'/jueony-engine-build.json')),scope:'Actual neutral contract and WASM execution. Same-engine preserved export, definitions/assets, rollback and layout; Hancom and paid models NOT_RUN.'},null,2));if(failures.length)process.exitCode=1;
