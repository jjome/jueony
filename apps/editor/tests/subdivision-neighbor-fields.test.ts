import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableSubdivisionSources} from '../src/adapters/rhwp/table-subdivision.ts';
import {readTableSplitSources} from '../src/adapters/rhwp/table-split.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations,type Snapshot} from '../src/modules/document/public/index.ts';
import {subdivisionNeighborFieldTable,subdivisionNamedParagraphTable,subdivisionInlineFieldTable} from '../scripts/lib/subdivision-neighbor-fields.mjs';

const pkg=process.env.JUEONY_ENGINE_PACKAGE ?? fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const at=[0,1,0] as const, target='s0p1t0';
const op={kind:'split_table_cell_into',target,row:0,column:0,rows:1,columns:3} as const;
const bytes=(d:any,format:string):Uint8Array=>format==='hwp'?d.exportHwp():d.exportHwpx();
function fixture(format:string,namedTarget=false) {
  const src=subdivisionNeighborFieldTable(HwpDocument,namedTarget);
  try {
    return new HwpDocument(bytes(src,format));
  } finally {src.free();}
}
function snapshot(d:any,format:string):Snapshot {
  const name='이웃 필드.'+format,structure=readStructure(d);
  return {name,structure,nodes:[],limitations:[],revision:'test',tableSubdivisionSources:readTableSubdivisionSources(d,structure.tables,name)};
}

for(const format of ['hwp','hwpx'])for(const columns of [2,3])test(format+' preserves both moved field owners when splitting a merged cell into '+columns,()=>{
  const doc=fixture(format);
  try {
    const s=snapshot(doc,format),fields=JSON.parse(doc.getFieldList()),table=s.structure!.tables[0];
    assert.equal(s.tableSubdivisionSources![target].editable,true);
    assert.deepEqual(s.tableSubdivisionSources![target].cells!.map(c=>[c.row,c.column]),[[0,0]]);
    assert.equal(readTableSplitSources(doc,[table],s.name)![target].editable,false);
    const old=bytes(doc,format),undo=doc.saveSnapshot();
    try {
      executeDocumentOperations(doc,s,validateEditOperations([{...op,columns}],s));
      const copy=new HwpDocument(bytes(doc,format));
      try {for(const d of [doc,copy]){
        const t=readStructure(d).tables[0],after=JSON.parse(d.getFieldList());
        assert.equal(after.length,2);
        for(const f of fields){
          const g=after.find((v:any)=>v.name===f.name),a=f.location.path[0].cellIndex,b=g.location.path[0].cellIndex;
          assert.ok(b>a);
          assert.equal(t.cells[b].axisFieldSignature,table.cells[a].axisFieldSignature);
          assert.equal(t.cells[b].text,table.cells[a].text);
          assert.equal(g.fieldId,f.cellField?b:f.fieldId);
          assert.equal(g.value,f.value);assert.equal(g.guide,f.guide);
        }
      }} finally {copy.free();}
      doc.restoreSnapshot(undo);assert.deepEqual(bytes(doc,format),old);
    } finally {doc.discardSnapshot(undo);}
  } finally {doc.free();}
});

for(const fault of ['target mixed field','body field','protected neighbor'])test('subdivision rejects a '+fault+' before editing',()=>{
  const d=fixture('hwpx');
  try {
    if(fault.startsWith('target'))d.insertClickHereFieldInCell(...at,0,0,0,false,'안내','설명','분할 대상',true);
    if(fault==='target mixed field')d.setCellProperties(...at,0,'{"fieldName":"분할대상"}');
    if(fault==='body field')d.insertClickHereField(0,0,0,'안내','','본문 필드',true);
    if(fault==='protected neighbor')d.setCellProperties(...at,1,'{"cellProtect":true}');
    const old=d.exportHwpx(),s=snapshot(d,'hwpx');
    assert.equal(s.tableSubdivisionSources![target].editable,false);
    assert.throws(()=>executeDocumentOperations(d,s,[op]));assert.deepEqual(d.exportHwpx(),old);
  } finally {d.free();}
});

for(const format of ['hwp','hwpx'])for(const distribute of [false,true])for(const filled of [false,true])
test(format+' preserves an inline '+(filled?'value':'guide')+' in the first piece '+(distribute?'with':'without')+' paragraph distribution',()=>{
  const src=subdivisionInlineFieldTable(HwpDocument,filled),d=new HwpDocument(bytes(src,format));src.free();
  try{
    const s=snapshot(d,format),original=bytes(d,format),fields=JSON.parse(d.getFieldList()),first=s.structure!.tables[0].cells[0];
    const targetField=fields.find((f:any)=>f.name==='주누름틀');
    const detail=(doc:any)=>JSON.parse(doc.getFieldInfoAtInCell(...at,0,0,targetField.startCharIdx,false));
    const information=detail(d);
    assert.equal(information.isGuide,!filled);assert.equal(targetField.value,filled?'값😀':'');
    const undo=d.saveSnapshot();
    try{
      const cursor=executeDocumentOperations(d,s,validateEditOperations([{...op,distributeParagraphs:distribute}],s));
      assert.equal(cursor?.cellIndex,1);
      const copy=new HwpDocument(bytes(d,format));
      try{for(const doc of [d,copy]){
        const t=readStructure(doc).tables[0],after=JSON.parse(doc.getFieldList());
        assert.equal(after.length,fields.length);assert.deepEqual(detail(doc),information);
        assert.deepEqual(after.find((f:any)=>f.name===targetField.name),targetField);
        assert.equal(t.cells[0].axisFieldSignature,first.axisFieldSignature);
        assert.deepEqual(t.cells.slice(0,3).map(c=>c.text),distribute?[...first.text.split('\n'),'']:[first.text,'','']);
        assert.ok(!t.cells[1].axisFieldSignature && !t.cells[2].axisFieldSignature);
        if(distribute)assert.equal(JSON.parse(doc.getCellCharPropertiesAt(...at,1,0,0)).bold,true);
        const named=after.find((f:any)=>f.name==='이름셀');assert.equal(named.value,fields.find((f:any)=>f.name==='이름셀').value);
      }}finally{copy.free();}
      d.restoreSnapshot(undo);assert.deepEqual(bytes(d,format),original);
    }finally{d.discardSnapshot(undo);}
  }finally{d.free();}
});

test('an inline field in a later paragraph can be retained but cannot be moved to a new cell',()=>{
  const src=subdivisionInlineFieldTable(HwpDocument,false,1),d=new HwpDocument(src.exportHwpx());src.free();
  try{
    const s=snapshot(d,'hwpx'),old=d.exportHwpx();
    assert.equal(s.tableSubdivisionSources![target].editable,true);
    assert.throws(()=>validateEditOperations([{...op,distributeParagraphs:true}],s),/수용/);
    assert.deepEqual(d.exportHwpx(),old);
    executeDocumentOperations(d,s,validateEditOperations([op],s));
    const retained=JSON.parse(d.getFieldList()).find((f:any)=>f.name==='주누름틀');
    assert.equal(retained.location.path[0].cellIndex,0);assert.equal(retained.paraInList,1);
  }finally{d.free();}
});

test('subdivision restores bytes when the synthetic guide paint moves away from its field marker',()=>{
  const src=subdivisionInlineFieldTable(HwpDocument),d=new HwpDocument(src.exportHwpx());src.free();
  try{
    const s=snapshot(d,'hwpx'),old=d.exportHwpx(),layout=d.getPageTextLayout.bind(d),count=s.structure!.tables[0].cells.length;
    let corrupt=false;
    d.getPageTextLayout=(p:number)=>{
      const page=JSON.parse(layout(p));
      if(JSON.parse(d.getTableDimensions(...at)).cellCount>count){
        const run=page.runs.find((r:any)=>r.text==='안내' && r.cellIdx===0 && r.charStart===undefined);
        if(run){run.x+=1;corrupt=true;}
      }
      return JSON.stringify(page);
    };
    assert.throws(()=>executeDocumentOperations(d,s,[op]),/누름틀|안내/);
    assert.equal(corrupt,true);assert.deepEqual(d.exportHwpx(),old);
  }finally{d.free();}
});

for(const format of ['hwp','hwpx'])for(const columns of [2,3])test(format+' retains a merged named owner only in the first of '+columns+' pieces',()=>{
  const d=fixture(format,true);
  try{
    const s=snapshot(d,format),source=s.structure!.tables[0].cells[0],name=source.properties.fieldName;
    const old=bytes(d,format),fields=JSON.parse(d.getFieldList()),original=fields.find((f:any)=>f.name===name);
    assert.ok(original.cellField && original.value && source.axisFieldSignature);
    const undo=d.saveSnapshot();
    try{
      executeDocumentOperations(d,s,validateEditOperations([{...op,columns}],s));
      const saved=bytes(d,format),copy=new HwpDocument(saved);
      try{for(const output of [d,copy]){
        const items=JSON.parse(output.getFieldList()),sameName=items.filter((f:any)=>f.name===name);
        assert.deepEqual(sameName,[original]);
        const {cells}=readStructure(output).tables[0],parts=cells.slice(0,columns);
        assert.deepEqual(parts.map(c=>c.properties.fieldName),[name,...Array(columns-1).fill('')]);
        assert.deepEqual(parts.map(c=>c.text),[source.text,...Array(columns-1).fill('')]);
        assert.equal(parts[0].axisFieldSignature,source.axisFieldSignature);
        assert.equal(items.length,fields.length);assert.equal(cells.filter(c=>c.properties.fieldName===name).length,1);
      }}finally{copy.free();}
      d.restoreSnapshot(undo);assert.deepEqual(bytes(d,format),old);assert.deepEqual(JSON.parse(d.getFieldList()),fields);
    }finally{d.discardSnapshot(undo);}
  }finally{d.free();}
});

test('a duplicated target name cannot advertise a unique retained field',()=>{
  const d=fixture('hwpx',true);
  try{
    d.setCellProperties(...at,5,'{"fieldName":"계약번호"}');
    const s=snapshot(d,'hwpx'),before=d.exportHwpx();
    assert.equal(s.tableSubdivisionSources![target].editable,false);
    assert.throws(()=>executeDocumentOperations(d,s,[op]));assert.deepEqual(d.exportHwpx(),before);
  }finally{d.free();}
});

test('a name accidentally cloned onto a second piece restores the original fields and bytes',()=>{
  const d=fixture('hwp',true);
  try{
    const s=snapshot(d,'hwp'),old=d.exportHwp(),fields=d.getFieldList(),split=d.splitTableCell.bind(d);
    let mutated=false;
    d.splitTableCell=(...args:any[])=>{
      const result=split(...args);
      d.setCellProperties(...at,1,'{"fieldName":"계약번호"}');mutated=true;
      return result;
    };
    assert.throws(()=>executeDocumentOperations(d,s,[{...op,columns:2}]));
    assert.equal(mutated,true);assert.equal(d.getFieldList(),fields);assert.deepEqual(d.exportHwp(),old);
  }finally{d.free();}
});

for(const format of ['hwp','hwpx'])for(const columns of [2,3])test(format+' distributes two styled paragraphs from a named cell to '+columns+' pieces',()=>{
  const src=subdivisionNamedParagraphTable(HwpDocument),d=new HwpDocument(bytes(src,format));src.free();
  try{
    const s=snapshot(d,format),old=bytes(d,format),before=s.structure!.tables[0],first=before.cells[0];
    const fields=JSON.parse(d.getFieldList()),targetField=fields.find((f:any)=>f.name===first.properties.fieldName);
    const paraProps=d.getCellParaPropertiesAt(...at,0,1),charProps=d.getCellCharPropertiesAt(...at,0,1,0);
    assert.ok(JSON.parse(charProps).bold);assert.equal(targetField.value,'칸0');
    const undo=d.saveSnapshot();
    try{
      executeDocumentOperations(d,s,validateEditOperations([{...op,columns,distributeParagraphs:true}],s));
      const reopened=new HwpDocument(bytes(d,format));
      try{for(const doc of [d,reopened]){
        const parts=readStructure(doc).tables[0].cells.slice(0,columns),after=JSON.parse(doc.getFieldList());
        assert.deepEqual(parts.map(c=>c.text),columns===2?['칸0','칸1']:['칸0','칸1','']);
        assert.equal(parts[0].properties.fieldName,first.properties.fieldName);
        for(const part of parts.slice(1))assert.equal(part.properties.fieldName,'');
        assert.deepEqual(after.filter((f:any)=>f.name===targetField.name),[targetField]);
        assert.equal(doc.getCellParaPropertiesAt(...at,1,0),paraProps);
        assert.equal(doc.getCellCharPropertiesAt(...at,1,0,0),charProps);
        assert.equal(after.length,fields.length);
        for(const f of fields.filter((v:any)=>v.name!==targetField.name)){
          const to=after.find((v:any)=>v.name===f.name);
          assert.equal(to.value,f.value);assert.equal(to.guide,f.guide);
          assert.equal(to.location.path[0].cellIndex,f.location.path[0].cellIndex+columns-1);
        }
      }}finally{reopened.free();}
      d.restoreSnapshot(undo);assert.deepEqual(bytes(d,format),old);
    }finally{d.discardSnapshot(undo);}
  }finally{d.free();}
});

test('distributing a named cell refuses an omitted original paragraph before mutation',()=>{
  const src=subdivisionNamedParagraphTable(HwpDocument);
  src.splitParagraphInCell(...at,0,1,2);src.insertTextInCell(...at,0,2,0,'세 번째');
  for(const i of [0,1])src.setCellProperties(...at,i,'{"height":8500}');
  const d=new HwpDocument(src.exportHwpx());src.free();
  try{
    const s=snapshot(d,'hwpx'),old=d.exportHwpx();
    assert.throws(()=>validateEditOperations([{...op,columns:2,distributeParagraphs:true}],s),/수용/);
    assert.deepEqual(d.exportHwpx(),old);
  }finally{d.free();}
});

test('distributed text painted into the neighboring piece restores the named source',()=>{
  const src=subdivisionNamedParagraphTable(HwpDocument),d=new HwpDocument(src.exportHwpx());src.free();
  try{
    const s=snapshot(d,'hwpx'),old=d.exportHwpx(),count=s.structure!.tables[0].cells.length;
    const layout=d.getPageTextLayout.bind(d);
    let moved=false;
    d.getPageTextLayout=(page:number)=>{
      const result=JSON.parse(layout(page));
      if(JSON.parse(d.getTableDimensions(...at)).cellCount>count){
        const run=result.runs.find((r:any)=>r.parentParaIdx===1 && r.controlIdx===0 && r.cellIdx===1 && r.text);
        if(run){run.x+=200;moved=true;}
      }
      return JSON.stringify(result);
    };
    assert.throws(()=>executeDocumentOperations(d,s,[{...op,distributeParagraphs:true}]),/글줄|범위/);
    assert.equal(moved,true);assert.deepEqual(d.exportHwpx(),old);
  }finally{d.free();}
});

for(const fault of ['guide','synthetic named ID','line position'])test('subdivision rolls back a changed neighbor '+fault,()=>{
  const d=fixture('hwp');
  try{
    const s=snapshot(d,'hwp'),old=d.exportHwp(),count=s.structure!.tables[0].cells.length;
    const changed=()=>JSON.parse(d.getTableDimensions(...at)).cellCount>count;
    let faults=0;
    const fields=d.getFieldList.bind(d),layout=d.getPageTextLayout.bind(d);
    d.getFieldList=()=>{
      const list=JSON.parse(fields());
      if(changed() && fault!=='line position'){
        if(fault==='guide')list.find((f:any)=>!f.cellField).guide+='오류';
        else list.find((f:any)=>f.cellField).fieldId++;
        faults++;
      }
      return JSON.stringify(list);
    };
    d.getPageTextLayout=(page:number)=>{
      const result=JSON.parse(layout(page));
      if(changed() && fault==='line position'){
        const run=result.runs.find((r:any)=>r.parentParaIdx===1&&r.cellIdx===2&&r.text);
        if(run){run.x+=1;faults++;}
      }
      return JSON.stringify(result);
    };
    assert.throws(()=>executeDocumentOperations(d,s,[{...op,columns:2}]));
    assert.ok(faults>0);assert.deepEqual(d.exportHwp(),old);
  } finally{d.free();}
});
