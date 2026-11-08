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
import {captionedSubdivisionNestedTable} from '../scripts/lib/subdivision-caption-fixture.mjs';
import {readOwnedZip,writeOwnedZip} from '../scripts/lib/owned-zip.mjs';

const pkg=process.env.JUEONY_ENGINE_PACKAGE ?? fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const out=resolve(process.env.JUEONY_TEST_OUTPUT??'build/subdivision-caption-native');
await mkdir(out,{recursive:true});
const operation={kind:'split_table_cell_into',target:'s0p1t0',row:0,column:0,rows:1,columns:2} as const;
const bytes=(d:any,ext:string):Uint8Array=>ext==='hwp'?d.exportHwp():d.exportHwpx();
const snapshot=(d:any,ext:string):Snapshot=>{
  const structure=readStructure(d),name='캡션 양식.'+ext;
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

for(const ext of ['hwp','hwpx'])test(ext+' preserves independent top/side captions, rejects overflow and restores a changed saved caption',async()=>{
  const source=captionedSubdivisionNestedTable(HwpDocument),d=new HwpDocument(bytes(source,ext));source.free();
  try{
    const before=snapshot(d,ext),table=before.structure!.tables[0],original=inspect(d),old=bytes(d,ext),xml=ownerXml(d),undo=d.saveSnapshot();
    assert.equal(before.tableSubdivisionSources![table.id].editable,true);
    assert.deepEqual(original.captions.map(c=>c.evidence.stored.find(v=>v.id.endsWith('p'+c.path[0].cellParaIndex+'t0'))!.value.direction),['Top','Right']);
    assert.deepEqual(original.captions.map(c=>c.lines.map((r:any)=>[r.text,r.bold])),[
      [['접수',true],[' 설명',false]],[['결재',true],[' 설명',false]],
    ]);
    await writeFile(resolve(out,'before.'+ext),old);
    try{
      executeDocumentOperations(d,before,validateEditOperations([operation],before));
      const saved=bytes(d,ext),copy=new HwpDocument(saved);
      try{for(const result of [d,copy]){
        assert.deepEqual(inspect(result),original);
        assert.equal(ownerXml(result),xml);
        assert.deepEqual(readStructure(result).nestedTables,before.structure!.nestedTables);
        assert.deepEqual(readStructure(result).tables[0].cells.map(c=>c.text),[table.cells[0].text,'',...table.cells.slice(1).map(c=>c.text)]);
      }}finally{copy.free();}
      await writeFile(resolve(out,'split.'+ext),saved);
      await writeFile(resolve(out,'caption-evidence-'+ext+'.json'),JSON.stringify(original.captions,null,2));
      d.restoreSnapshot(undo);assert.deepEqual(bytes(d,ext),old);
      // Both tables fit three pieces, but the side-caption ink crosses the first piece.
      assert.throws(()=>executeDocumentOperations(d,before,validateEditOperations([{...operation,columns:3}],before)),/캡션/);
      assert.deepEqual(bytes(d,ext),old);assert.deepEqual(inspect(d),original);

      const method=ext==='hwp'?'exportHwpWithReport':'exportHwpxWithReport',exporter=d[method].bind(d);let changed=false;
      d[method]=()=>{
        const report=exporter(),take=report.takeBytes.bind(report);
        report.takeBytes=()=>{
          const saved=take();
          if(JSON.parse(d.getTableDimensions(0,1,0)).cellCount===table.cells.length)return saved;
          const decoded=new HwpDocument(saved),parts=readOwnedZip(decoded.exportHwpx());decoded.free();
          const section=parts.find(([name]:[string,Buffer])=>name==='Contents/section0.xml')!;
          const xml=section[1].toString('utf8');
          assert.match(xml,/<hp:caption[^>]*gap="283"/);
          section[1]=Buffer.from(xml.replace(/(<hp:caption[^>]*gap=")283"/,(_,prefix)=>prefix+'900"'));
          const altered=new HwpDocument(writeOwnedZip(parts));
          try{changed=true;return bytes(altered,ext);}finally{altered.free();}
        };
        return report;
      };
      assert.throws(()=>executeDocumentOperations(d,before,validateEditOperations([operation],before)),/보존|배치|캡션|위치/);
      assert.equal(changed,true);d[method]=exporter;
      assert.deepEqual(bytes(d,ext),old);assert.deepEqual(inspect(d),original);assert.equal(ownerXml(d),xml);
    }finally{d.discardSnapshot(undo);}
  }finally{d.free();}
});

for(const ext of ['hwp','hwpx'])test(ext+' refuses a bookmark inside an original nested caption without changing the file',()=>{
  const source=captionedSubdivisionNestedTable(HwpDocument,{complex:true}),d=new HwpDocument(bytes(source,ext));source.free();
  try{
    const old=bytes(d,ext),before=snapshot(d,ext);
    const path=JSON.stringify([{controlIndex:0,cellIndex:0,cellParaIndex:1},{controlIndex:0,cellIndex:0,cellParaIndex:0}]);
    assert.equal(JSON.parse(d.getTableAxisCaptionEvidenceByPath(0,1,path)).kind,'complex');
    assert.equal(before.tableSubdivisionSources![operation.target].editable,false);
    assert.throws(()=>executeDocumentOperations(d,before,[operation]));
    assert.deepEqual(bytes(d,ext),old);
  }finally{d.free();}
});
