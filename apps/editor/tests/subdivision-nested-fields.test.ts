import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableSubdivisionSources} from '../src/adapters/rhwp/table-subdivision.ts';
import {nestedSubdivisionEvidence,subdivisionNestedOwner} from '../src/adapters/rhwp/subdivision-nested-owner.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations,type Snapshot} from '../src/modules/document/public/index.ts';
import {fieldSubdivisionNestedTable} from '../scripts/lib/subdivision-field-fixture.mjs';
import {readOwnedZip,writeOwnedZip} from '../scripts/lib/owned-zip.mjs';
import {subdivisionFieldOwnerRecords} from '../scripts/lib/subdivision-field-records.mjs';

const pkg=process.env.JUEONY_ENGINE_PACKAGE ?? fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/subdivision-fields-native');await mkdir(out,{recursive:true});
const operation={kind:'split_table_cell_into',target:'s0p1t0',row:0,column:0,rows:1,columns:3} as const;
const bytes=(d:any,ext:string):Uint8Array=>ext==='hwp'?d.exportHwp():d.exportHwpx();
const snapshot=(d:any,ext:string):Snapshot=>{
  const structure=readStructure(d),name='채운 중첩 양식.'+ext;
  return {name,structure,nodes:[],limitations:[],revision:'test',tableSubdivisionSources:readTableSubdivisionSources(d,structure.tables,name)};
};
function inspect(d:any){const t=readStructure(d).tables[0];return nestedSubdivisionEvidence(d,t,subdivisionNestedOwner(d,t)!);}
function ownerXml(d:any){
  const xml=readOwnedZip(d.exportHwpx()).find(([name]:[string,Buffer])=>name==='Contents/section0.xml')![1].toString('utf8');
  let depth=0,start=0;
  for(const tag of xml.matchAll(/<hp:subList\b[^>]*>|<\/hp:subList>/g)){
    if(tag[0].startsWith('</')){if(--depth===0)return xml.slice(start,tag.index+tag[0].length);}
    else if(depth++===0)start=tag.index;
  }
  assert.fail('Missing original owner XML');
}

for(const ext of ['hwp','hwpx'])test(ext+' retains two filled leaf fields, exact formats and ranges; overflow or changed value restores the original',async()=>{
  const source=fieldSubdivisionNestedTable(HwpDocument),d=new HwpDocument(bytes(source,ext));source.free();
  try{
    const rawOwner=(doc:any)=>ext==='hwp'?subdivisionFieldOwnerRecords(doc.exportHwp()):ownerXml(doc);
    const before=snapshot(d,ext),table=before.structure!.tables[0],original=inspect(d),old=bytes(d,ext),records=rawOwner(d),undo=d.saveSnapshot();
    assert.equal(before.tableSubdivisionSources![table.id].editable,true);
    assert.deepEqual(original.fields.flatMap(c=>c.fields.map((f:any)=>[f.fieldId,f.name,f.value,f.startPos,f.endPos,f.startCharIdx,f.endCharIdx])),
      [[1,'성명','😀',9,10,1,2],[2,'성명','을',9,10,1,2]]);
    // The supplementary-plane value occupies one scalar/control-slot unit;
    // rawOwner below independently checks original-format field begin/end records.
    assert.equal(original.fields[0].fields[0].value.length,2);
    assert.deepEqual(original.nested[0].lines.filter((r:any)=>['😀','을'].includes(r.text)).map((r:any)=>[r.text,r.bold,r.italic]),
      [['😀',true,false],['을',false,true]]);
    await writeFile(resolve(out,'before.'+ext),old);
    try{
      executeDocumentOperations(d,before,validateEditOperations([operation],before));
      const saved=bytes(d,ext),copy=new HwpDocument(saved);
      try{for(const result of [d,copy]){
        assert.deepEqual(inspect(result),original);assert.deepEqual(rawOwner(result),records);
        assert.deepEqual(readStructure(result).nestedTables,before.structure!.nestedTables);
        assert.deepEqual(readStructure(result).tables[0].cells.map(c=>c.text),[table.cells[0].text,'','',...table.cells.slice(1).map(c=>c.text)]);
      }}finally{copy.free();}
      await writeFile(resolve(out,'split.'+ext),saved);
      await writeFile(resolve(out,'field-evidence-'+ext+'.json'),JSON.stringify(original.fields,null,2));
      await writeFile(resolve(out,'owner-records-'+ext+'.json'),JSON.stringify(records,null,2));
      d.restoreSnapshot(undo);assert.deepEqual(bytes(d,ext),old);
      assert.throws(()=>executeDocumentOperations(d,before,validateEditOperations([{...operation,columns:4}],before)),/중첩 표/);
      assert.deepEqual(bytes(d,ext),old);assert.deepEqual(inspect(d),original);
      const split=d.splitCellOnGrid.bind(d);let changed=false;
      d.splitCellOnGrid=(...args:any[])=>{
        const result=split(...args);
        assert.equal(JSON.parse(d.setFieldValue(2,'병')).ok,true);changed=true;return result;
      };
      assert.throws(()=>executeDocumentOperations(d,before,validateEditOperations([operation],before)),/보존|누름틀|달라졌/);
      assert.equal(changed,true);assert.deepEqual(bytes(d,ext),old);assert.deepEqual(inspect(d),original);assert.deepEqual(rawOwner(d),records);
    }finally{d.discardSnapshot(undo);}
  }finally{d.free();}
});

for(const ext of ['hwp','hwpx'])test(ext+' refuses missing/duplicate/raw-range/path contamination and named or protected leaves',()=>{
  const source=fieldSubdivisionNestedTable(HwpDocument),raw=bytes(source,ext);source.free();
  for(const fault of ['missing','duplicate','raw range','owner path','overlap','unfilled','named','protected']){
    let d=new HwpDocument(raw);
    try{
      if(fault==='named'||fault==='protected'){
        const parts=readOwnedZip(d.exportHwpx()),section=parts.find(([name]:[string,Buffer])=>name==='Contents/section0.xml')!;
        const xml=section[1].toString('utf8'),at=xml.indexOf('<hp:t>X</hp:t>'),start=xml.lastIndexOf('<hp:tc ',at),end=xml.indexOf('>',start);
        assert.ok(at>end&&end>start&&start>=0);
        const tag=xml.slice(start,end),attribute=fault==='named'?'name=""':'protect="0"';assert.ok(tag.includes(attribute));
        section[1]=Buffer.from(xml.slice(0,start)+tag.replace(attribute,fault==='named'?'name="이름"':'protect="1"')+xml.slice(end));
        d.free();const changed=new HwpDocument(writeOwnedZip(parts));d=new HwpDocument(bytes(changed,ext));changed.free();
      }else{
        const get=d.getFieldList.bind(d);
        d.getFieldList=()=>{
          const fields=JSON.parse(get());
          if(fault==='missing')fields.pop();
          if(fault==='duplicate')fields[1].fieldId=fields[0].fieldId;
          if(fault==='raw range')fields[0].startPos++;
          if(fault==='owner path')fields[0].location.path[0].cellIndex=1;
          if(fault==='overlap'){fields[1].listId=fields[0].listId;fields[1].location=structuredClone(fields[0].location);}
          if(fault==='unfilled'){fields[0].value='';fields[0].endCharIdx=fields[0].startCharIdx;}
          return JSON.stringify(fields);
        };
      }
      const old=bytes(d,ext),s=snapshot(d,ext);
      assert.equal(s.tableSubdivisionSources![operation.target].editable,false,fault);
      assert.throws(()=>executeDocumentOperations(d,s,[operation]),undefined,fault);
      assert.deepEqual(bytes(d,ext),old,fault);
    }finally{d.free();}
  }
});
