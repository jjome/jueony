import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {createPictureFieldParagraph,mixedPictureFieldArgs as args,inspectMixedPictureFields,inspectPictureFieldLines} from './lib/cell-paragraph-picture-fields.mjs';
import {readPictureFieldFlow,assertPictureFieldFlow,assertCenteredPictureFlow} from './lib/picture-field-flow.mjs';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readCellParagraphSources} from '../src/adapters/rhwp/cell-paragraph.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/picture-fields-wrap');
await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(pkg+'/rhwp.js'));
await init({module_or_path:await readFile(pkg+'/rhwp_bg.wasm')});
const json=v=>typeof v==='string'?JSON.parse(v):v,results=[];
const snap=(d,name)=>{const structure=readStructure(d);return {revision:'r1',name,nodes:[],limitations:[],structure,cellParagraphSources:readCellParagraphSources(d,structure.tables,name)};};
const paragraph=s=>s.cellParagraphSources.s0p1t0.cells?.find(c=>c.index===4)?.paragraphs.find(p=>p.index===0);
const command=(s,text)=>({kind:'replace_cell_paragraph',target:'s0p1t0',row:1,column:1,paragraph:0,originalText:paragraph(s)?.text,text});
function candidate(d,s,op){const token=d.saveSnapshot();try{validateEditOperations([op],s);return executeDocumentOperations(d,s,[op]);}catch(error){d.restoreSnapshot(token);throw error;}finally{d.discardSnapshot(token);}}
function resources(bytes){
 const b=Buffer.from(bytes),map={};let at=0;
 while(at+30<b.length&&b.readUInt32LE(at)===0x04034b50){
  const method=b.readUInt16LE(at+8),size=b.readUInt32LE(at+18),nameLength=b.readUInt16LE(at+26),extra=b.readUInt16LE(at+28);
  const name=b.subarray(at+30,at+30+nameLength).toString(),start=at+30+nameLength+extra;
  assert.equal(b.readUInt16LE(at+6)&8,0);
  if(name==='Contents/header.xml'||name.startsWith('BinData/'))map[name]=(method===0?b.subarray(start,start+size):inflateRawSync(b.subarray(start,start+size))).toString('base64');
  at=start+size;
 }
 assert.ok(map['Contents/header.xml']);return map;
}
for(const format of ['hwp','hwpx']){
 const template=await createPictureFieldParagraph(HwpDocument,resolve(out,'fixture-'+format),'multiple-wrap');
 const save=d=>format==='hwp'?d.exportHwp():d.exportHwpx(),d=new HwpDocument(save(template));template.free();
 const name='10pt 두 줄 필드.'+format;
 try{
  const fields=json(d.getFieldList()),assets=resources(d.exportHwpx()),source=assertPictureFieldFlow(readPictureFieldFlow(d,args)),before=save(d);
  assert.equal(source.rows.length,1);
  const original=resolve(out,'original.'+format);await writeFile(original,before);
  const raw=inspectMixedPictureFields(original),originalLines=inspectPictureFieldLines(original),slots=raw.find(c=>c.row===1&&c.col===1).slots;
  const phases=[
   {label:'prefix-emoji-wrap',text:'😀추가'+source.text,scalars:[9,12,18,21,27,33,34],units:[10,22,36,47,61,75,84],shift:[3,3]},
   {label:'inter-field-delete',text:('😀추가'+source.text).replace('사이문구','사이'),scalars:[9,12,16,19,25,31,32],units:[10,22,34,45,59,73,82],shift:[3,1]},
  ];
  // Corruption of layout evidence or actual immutable properties must still
  // reject the successful native insertion and restore exact original bytes.
  for(const fault of ['paint-y','line-x','line-spacing','vertical-align']){
   const bad=new HwpDocument(before),base=snap(bad,name),unchanged=save(bad),insert=bad.insertTextInCell.bind(bad),layout=bad.getPageTextLayout.bind(bad),lineCaret=bad.getCursorRectOnLine.bind(bad);let changed=false,faultApplied=false;
   try{
    bad.getPageTextLayout=(...a)=>{const v=json(layout(...a));if(changed&&fault==='paint-y'){v.runs=v.runs.map(r=>r.cellIdx===4?{...r,y:r.y+3}:r);faultApplied=true;}return JSON.stringify(v);};
    bad.getCursorRectOnLine=(...a)=>{const v=json(lineCaret(...a));if(changed&&fault==='line-x'&&a[2]===1){v.x+=3;faultApplied=true;}return JSON.stringify(v);};
    bad.insertTextInCell=(...a)=>{const result=insert(...a);changed=true;
     if(fault==='line-spacing'){bad.applyParaFormatInCell(...args,'{"lineSpacing":180}');faultApplied=json(bad.getCellParaPropertiesAt(...args)).lineSpacing===180;}
     if(fault==='vertical-align'){bad.setCellProperties(0,1,0,4,'{"verticalAlign":0}');faultApplied=json(bad.getCellProperties(0,1,0,4)).verticalAlign===0;}
     return result;};
    assert.throws(()=>candidate(bad,base,command(base,phases[0].text)),undefined,fault+' must reject');
    assert.equal(changed,true,fault+' reached native insertion');assert.equal(faultApplied,true,fault+' was really injected');assert.deepEqual(save(bad),unchanged,fault+' exact rollback');
   }finally{bad.free();}
  }
  const undo=d.saveSnapshot(),evidence=[];
  for(const phase of phases){
   const base=snap(d,name);candidate(d,base,command(base,phase.text));
   const flow=assertPictureFieldFlow(readPictureFieldFlow(d,args)),dy=assertCenteredPictureFlow(source,flow);
   if(phase.label==='prefix-emoji-wrap')assert.equal(flow.rows.length,2,'Original 10pt source actually wraps');
   const file=resolve(out,phase.label+'.'+format);await writeFile(file,save(d));
   assert.deepEqual(inspectMixedPictureFields(file),raw.map(c=>c.row===1&&c.col===1?{...c,text:phase.text,
    slots:slots.map((s,i)=>({...s,offset:phase.scalars[i],utf16Offset:phase.units[i]}))}:c));
   const lines=inspectPictureFieldLines(file),owner=lines.find(c=>c.row===1&&c.col===1);
   assert.equal(owner.lines.length,flow.rows.length,'Stored and painted row counts agree');
   assert.deepEqual(lines.filter(c=>c.row!==1||c.col!==1),originalLines.filter(c=>c.row!==1||c.col!==1));
   const chars=Array.from(phase.text);
   for(const [i,line] of owner.lines.entries()){
    const start=Math.min(...flow.runs.filter(r=>Math.abs(r.y-flow.rows[i].start.y)<=.2).map(r=>r.charStart));
    const utf16=chars.slice(0,start).join('').length+phase.scalars.filter(x=>x<=start).length*8;
    assert.equal(line[0],utf16,'Raw UTF16/control-slot line start');
    assert.equal(line[1],i*1600,'Original stored line spacing');
    assert.deepEqual(line.slice(2),originalLines.find(c=>c.row===1&&c.col===1).lines[0].slice(2),'Stored height, baseline, spacing and horizontal profile');
   }
   const expectedFields=fields.map((f,i)=>({...f,...Object.fromEntries(['startCharIdx','endCharIdx','startPos','endPos'].map(k=>[k,f[k]+phase.shift[i]]))}));
   const reopened=new HwpDocument(await readFile(file));
   try{
    assert.deepEqual(json(d.getFieldList()),expectedFields);assert.deepEqual(json(reopened.getFieldList()),expectedFields);
    assert.deepEqual(Array.from(reopened.getCellPictureTextAnchors(...args)),phase.scalars.slice(4));
    for(const [i,field] of expectedFields.entries()){
     assert.equal(json(reopened.getFieldValue(field.fieldId)).value,field.value);
     assert.equal(json(reopened.getCellCharPropertiesAt(...args,field.startCharIdx)).textColor,['#246789','#975324'][i]);
    }
    assert.deepEqual(resources(reopened.exportHwpx()),assets);
    const reopenedFlow=assertPictureFieldFlow(readPictureFieldFlow(reopened,args));assert.deepEqual(reopenedFlow,flow);
   }finally{reopened.free();}
   evidence.push({label:phase.label,rows:flow.rows,dy,rawLines:owner.lines,runSlices:flow.runs.map(r=>({text:r.text,charStart:r.charStart,y:r.y})),cursorCount:flow.cursors.length});
  }
  const after=save(d),redo=d.saveSnapshot();d.restoreSnapshot(undo);assert.deepEqual(save(d),before);
  d.restoreSnapshot(redo);assert.deepEqual(save(d),after);assertPictureFieldFlow(readPictureFieldFlow(d,args));
  d.discardSnapshot(undo);d.discardSnapshot(redo);
  results.push({format,edits:2,faultRollbacks:4,undoRedo:true,evidence});
  console.log('PASS',format,'10pt prefix wrap and field-gap deletion: source/run/cursor rows, raw lines, center displacement, fields/resources, reopen, undo/redo and four fault rollbacks');
 }finally{d.free();}
}
await writeFile(resolve(out,'results.json'),JSON.stringify({engine:pkg,results},null,2));
console.log('PASS',results.length,'formats');
