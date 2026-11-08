import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readTableSubdivisionSources} from '../src/adapters/rhwp/table-subdivision.ts';
import {nestedSubdivisionEvidence,subdivisionNestedOwner} from '../src/adapters/rhwp/subdivision-nested-owner.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations,type Snapshot} from '../src/modules/document/public/index.ts';
import {emphasizedSubdivisionNestedTable,labeledSubdivisionNestedTable,subdivisionNestedTable} from '../scripts/lib/subdivision-nested-table.mjs';
import {readOwnedZip,writeOwnedZip} from '../scripts/lib/owned-zip.mjs';
const pkg=process.env.JUEONY_ENGINE_PACKAGE ?? fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const op={kind:'split_table_cell_into',target:'s0p1t0',row:0,column:0,rows:1,columns:3} as const;
const bytes=(d:any,ext:string):Uint8Array=>ext==='hwp'?d.exportHwp():d.exportHwpx();
const snapshot=(d:any,ext:string):Snapshot=>{
  const structure=readStructure(d),name='중첩 양식.'+ext;
  return {name,structure,nodes:[],limitations:[],revision:'test',tableSubdivisionSources:readTableSubdivisionSources(d,structure.tables,name)};
};
const nestedInk=(d:any)=>({
  boxes:JSON.parse(d.getPageControlLayout(0)).controls.filter((c:any)=>c.type==='table'&&c.stableIndex?.length>3),
  runs:JSON.parse(d.getPageTextLayout(0)).runs.filter((r:any)=>r.cellPath?.length===2),
});
function storedOwnerParagraphs(doc:any){
  const xml=readOwnedZip(doc.exportHwpx()).find(([n]:[string,Buffer])=>n==='Contents/section0.xml')![1].toString('utf8');
  let depth=0,start=0;
  for(const tag of xml.matchAll(/<hp:subList\b[^>]*>|<\/hp:subList>/g)){
    if(tag[0].startsWith('</')){
      if(--depth===0)return xml.slice(start,tag.index+tag[0].length);
    }else if(depth++===0)start=tag.index;
  }
  assert.fail('Missing owner paragraph XML');
}
function storedInnerTables(doc:any){
  const xml=readOwnedZip(doc.exportHwpx()).find(([n]:[string,Buffer])=>n==='Contents/section0.xml')![1].toString('utf8');
  const tables:string[]=[];let depth=0,start=0;
  for(const tag of xml.matchAll(/<hp:tbl\b[^>]*>|<\/hp:tbl>/g)){
    if(tag[0].startsWith('</')){
      if(depth===2)tables.push(xml.slice(start,tag.index+tag[0].length));
      depth--;
    }else if(++depth===2)start=tag.index;
  }
  return tables;
}
for(const ext of ['hwp','hwpx'])test(ext+' retains the nested table in the original first piece and reopens every inner cell and line',()=>{
  const src=subdivisionNestedTable(HwpDocument),d=new HwpDocument(bytes(src,ext));src.free();
  try{
    const s=snapshot(d,ext),old=bytes(d,ext),ink=nestedInk(d),undo=d.saveSnapshot();
    try{
      assert.deepEqual(s.tableSubdivisionSources![op.target].cells!.map(c=>[c.row,c.column]),[[0,0]]);
      assert.throws(()=>validateEditOperations([{...op,distributeParagraphs:true}],s),/중첩/);
      executeDocumentOperations(d,s,validateEditOperations([op],s));
      const copy=new HwpDocument(bytes(d,ext));
      try{for(const result of [d,copy]){
        const st=readStructure(result);
        assert.equal(st.tables[0].cells.length,s.structure!.tables[0].cells.length+2);
        assert.equal(st.nestedTables?.length,1);
        assert.deepEqual(st.nestedTables![0].ancestors,s.structure!.nestedTables![0].ancestors);
        assert.deepEqual(st.nestedTables![0].cells.map(c=>c.text),['X','Y']);
        assert.deepEqual(nestedInk(result),ink);
      }}finally{copy.free();}
      d.restoreSnapshot(undo);assert.deepEqual(bytes(d,ext),old);assert.deepEqual(nestedInk(d),ink);
    }finally{d.discardSnapshot(undo);}
  }finally{d.free();}
});
for(const fault of ['too wide','displaced'])test('a '+fault+' nested table leaves the original bytes and path intact',()=>{
  const src=subdivisionNestedTable(HwpDocument,fault==='too wide'?9000:5200),d=new HwpDocument(src.exportHwpx());src.free();
  try{
    const s=snapshot(d,'hwpx'),old=d.exportHwpx(),ink=nestedInk(d),count=s.structure!.tables[0].cells.length;
    let changed=false;
    if(fault==='displaced'){
      const read=d.getTableCellBboxesByPath.bind(d);
      d.getTableCellBboxesByPath=(...args:any[])=>{
        const boxes=JSON.parse(read(...args));
        if(JSON.parse(d.getTableDimensions(0,1,0)).cellCount>count){boxes[0].y+=1;changed=true;}
        return JSON.stringify(boxes);
      };
    }
    assert.equal(s.tableSubdivisionSources![op.target].editable,true);
    assert.throws(()=>executeDocumentOperations(d,s,[op]));
    if(fault==='displaced')assert.equal(changed,true);
    assert.deepEqual(d.exportHwpx(),old);assert.deepEqual(nestedInk(d),ink);
  }finally{d.free();}
});
test('an inner cell painted over its neighbor rejects even when both layout APIs report the same box',()=>{
  const d=subdivisionNestedTable(HwpDocument);
  try{
    const table=readStructure(d).tables[0],owner=subdivisionNestedOwner(d,table)!;
    const readPage=d.getPageControlLayout.bind(d),readPath=d.getTableCellBboxesByPath.bind(d);
    d.getPageControlLayout=(page:number)=>{
      const layout=JSON.parse(readPage(page));
      layout.controls.find((c:any)=>c.stableIndex?.length>3).cells[0].w+=2;
      return JSON.stringify(layout);
    };
    d.getTableCellBboxesByPath=(...args:any[])=>{
      const boxes=JSON.parse(readPath(...args));boxes[0].w+=2;return JSON.stringify(boxes);
    };
    assert.throws(()=>nestedSubdivisionEvidence(d,table,owner),/중첩 표/);
  }finally{d.free();}
});
for(const ext of ['hwp','hwpx'])test(ext+' subdivides an intact nested table on the second page of a report',()=>{
  const src=subdivisionNestedTable(HwpDocument);
  src.insertPageBreak(0,0,2);
  const d=new HwpDocument(bytes(src,ext));src.free();
  try{
    const s=snapshot(d,ext),table=s.structure!.tables[0],operation={...op,target:table.id};
    const saved=bytes(d,ext),previousPage=d.getPageTextLayout(0);
    const evidence=(doc:any)=>{
      const parent=readStructure(doc).tables[0];
      return nestedSubdivisionEvidence(doc,parent,subdivisionNestedOwner(doc,parent)!);
    };
    const original=evidence(d),undo=d.saveSnapshot();
    try{
      assert.deepEqual([original.page,original.pageCount],[1,2]);
      executeDocumentOperations(d,s,validateEditOperations([operation],s));
      const reopened=new HwpDocument(bytes(d,ext));
      try{
        for(const result of [d,reopened]){
          assert.equal(readStructure(result).tables[0].cells.length,table.cells.length+2);
          assert.deepEqual(evidence(result),original);
          assert.equal(result.getPageTextLayout(0),previousPage);
        }
      }finally{reopened.free();}
      d.restoreSnapshot(undo);assert.deepEqual(bytes(d,ext),saved);
    }finally{d.discardSnapshot(undo);}
  }finally{d.free();}
});
test('a duplicate inner table frame on an earlier page refuses subdivision',()=>{
  const d=subdivisionNestedTable(HwpDocument);
  try{
    d.insertPageBreak(0,0,2);
    const table=readStructure(d).tables[0],owner=subdivisionNestedOwner(d,table)!;
    const read=d.getPageControlLayout.bind(d),inner=JSON.parse(read(1)).controls.find((c:any)=>c.stableIndex?.length>3);
    d.getPageControlLayout=(page:number)=>{
      const layout=JSON.parse(read(page));
      if(page===0)layout.controls.push(inner);
      return JSON.stringify(layout);
    };
    assert.throws(()=>nestedSubdivisionEvidence(d,table,owner),/중첩 표/);
  }finally{d.free();}
});

for(const paired of [false,true])for(const ext of ['hwp','hwpx'])test(ext+' retains '+(paired?'two separate nested forms':'the titled nested form')+' and its formatted explanation on page two',()=>{
  const src=labeledSubdivisionNestedTable(HwpDocument,undefined,paired?4400:undefined);src.insertPageBreak(0,0,2);
  const d=new HwpDocument(bytes(src,ext));src.free();
  try{
    const s=snapshot(d,ext),table=s.structure!.tables[0],operation={...op,target:table.id};
    const inspect=(doc:any)=>{
      const t=readStructure(doc).tables[0],owner=subdivisionNestedOwner(doc,t)!;
      assert.deepEqual(owner.paragraphs,paired?[1,3]:[1]);
      return nestedSubdivisionEvidence(doc,t,owner);
    };
    const original=inspect(d),old=bytes(d,ext),stored=storedInnerTables(d),firstPage=d.getPageTextLayout(0),undo=d.saveSnapshot();
    try{
      assert.deepEqual([original.page,original.pageCount],[1,2]);
      assert.equal(stored.length,paired?2:1);
      assert.deepEqual(original.ownerLines.filter(r=>r.text).map(r=>[r.text,r.bold,r.italic]),[
        ['접수 제목',true,false],...(paired?[['결재',false,false]]:[]),['설명',false,true]]);
      assert.deepEqual(original.nested.map(c=>c.lines.map((r:any)=>[r.text,r.bold])),
        [[['X',false],['Y',false]],...(paired?[[['A',true],['B',false]]]:[])]);
      assert.throws(()=>validateEditOperations([{...operation,distributeParagraphs:true}],s),/중첩/);
      executeDocumentOperations(d,s,validateEditOperations([operation],s));
      const copy=new HwpDocument(bytes(d,ext));
      try{for(const result of [d,copy]){
        assert.equal(result.getPageTextLayout(0),firstPage);
        assert.deepEqual(inspect(result),original);
        assert.deepEqual(storedInnerTables(result),stored);
        const t=readStructure(result).tables[0];
        assert.deepEqual(t.cells.map(c=>c.text),[paired?'접수 제목\n\n결재\n\n설명':'접수 제목\n\n설명','','',...table.cells.slice(1).map(c=>c.text)]);
      }}finally{copy.free();}
      d.restoreSnapshot(undo);assert.deepEqual(bytes(d,ext),old);
    }finally{d.discardSnapshot(undo);}
  }finally{d.free();}
});

test('two nested forms reject protection on the second physical cell of the second table',()=>{
  const src=labeledSubdivisionNestedTable(HwpDocument,undefined,4400);
  const parts=readOwnedZip(src.exportHwpx());src.free();
  const section=parts.find(([name]:[string,Buffer])=>name==='Contents/section0.xml')!,xml=section[1].toString('utf8');
  const start=xml.lastIndexOf('<hp:tc ',xml.indexOf('>B<')),end=xml.indexOf('>',start);
  assert.ok(start>=0);assert.match(xml.slice(start,end),/ protect="0"/);
  section[1]=Buffer.from(xml.slice(0,start)+xml.slice(start,end).replace(' protect="0"',' protect="1"')+xml.slice(end));
  const d=new HwpDocument(writeOwnedZip(parts));
  try{
    const s=snapshot(d,'hwpx'),old=d.exportHwpx();
    assert.equal(s.tableSubdivisionSources![op.target].editable,false);
    assert.throws(()=>d.splitCellOnGrid(0,1,0,0,0,1,3,false));
    assert.deepEqual(d.exportHwpx(),old);
  }finally{d.free();}
});

for(const fault of ['oversized second frame','substituted text','swapped box path'])test('two nested forms restore the file after '+fault,()=>{
  const src=labeledSubdivisionNestedTable(HwpDocument,undefined,fault==='oversized second frame'?7600:5200);
  const d=new HwpDocument(src.exportHwpx());src.free();
  try{
    const s=snapshot(d,'hwpx'),old=d.exportHwpx(),controls=d.getControls(),lines=d.getPageTextLayout(0);
    assert.equal(s.tableSubdivisionSources![op.target].editable,true);
    const split=d.splitCellOnGrid.bind(d);
    let divided=false;
    d.splitCellOnGrid=(...args:any[])=>{
      const result=split(...args);divided=true;
      if(fault==='substituted text'){
        for(const [i,v] of ['X','Y'].entries()){
          const path=JSON.stringify([{controlIndex:0,cellIndex:0,cellParaIndex:3},{controlIndex:0,cellIndex:i,cellParaIndex:0}]);
          d.deleteTextInCellByPath(0,1,path,0,1);
          d.insertTextInCellByPath(0,1,path,0,v);
        }
      }
      return result;
    };
    if(fault==='swapped box path'){
      const read=d.getTableCellBboxesByPath.bind(d);
      d.getTableCellBboxesByPath=(section:number,root:number,encoded:string)=>{
        const path=JSON.parse(encoded);
        if(divided && path[0].cellParaIndex===3)path[0].cellParaIndex=1;
        return read(section,root,JSON.stringify(path));
      };
    }
    assert.throws(()=>executeDocumentOperations(d,s,validateEditOperations([op],s)));
    assert.equal(divided,true);
    assert.deepEqual(d.exportHwpx(),old);
    assert.equal(d.getControls(),controls);assert.equal(d.getPageTextLayout(0),lines);
  }finally{d.free();}
});

test('a title extending beyond the first piece refuses the split and restores the original file',()=>{
  const src=labeledSubdivisionNestedTable(HwpDocument,'접수 제목과 추가 신청자 정보'),d=new HwpDocument(src.exportHwpx());src.free();
  try{
    const s=snapshot(d,'hwpx'),table=s.structure!.tables[0],old=d.exportHwpx(),layout=d.getPageTextLayout(0);
    assert.equal(s.tableSubdivisionSources![table.id].editable,true);
    assert.throws(()=>executeDocumentOperations(d,s,validateEditOperations([op],s)),/중첩 표|안쪽 표/);
    assert.deepEqual(d.exportHwpx(),old);assert.equal(d.getPageTextLayout(0),layout);
  }finally{d.free();}
});

test('a stray title run on the first page makes a second-page nested owner ineligible',()=>{
  const d=labeledSubdivisionNestedTable(HwpDocument);
  try{
    d.insertPageBreak(0,0,2);
    const table=readStructure(d).tables[0],owner=subdivisionNestedOwner(d,table)!,read=d.getPageTextLayout.bind(d);
    const title=JSON.parse(read(1)).runs.find((r:any)=>r.text==='접수 제목');
    assert.ok(title);
    d.getPageTextLayout=(page:number)=>{
      const result=JSON.parse(read(page));
      if(page===0)result.runs.push(title);
      return JSON.stringify(result);
    };
    assert.throws(()=>nestedSubdivisionEvidence(d,table,owner),/중첩 표/);
  }finally{d.free();}
});

test('a field inside the explanation blocks both native and chat subdivision without changing the file',()=>{
  const src=labeledSubdivisionNestedTable(HwpDocument);
  src.insertClickHereFieldInCell(0,1,0,0,2,2,false,'이름 입력','','신청자',true);
  const d=new HwpDocument(src.exportHwpx());src.free();
  try{
    const s=snapshot(d,'hwpx'),old=d.exportHwpx(),fields=JSON.parse(d.getFieldList());
    assert.equal(fields.some((f:any)=>f.name==='신청자'),true);
    assert.equal(s.tableSubdivisionSources![op.target].editable,false);
    assert.throws(()=>validateEditOperations([op],s));
    assert.throws(()=>d.splitCellOnGrid(0,1,0,0,0,1,3,false));
    assert.deepEqual(d.exportHwpx(),old);assert.deepEqual(JSON.parse(d.getFieldList()),fields);
  }finally{d.free();}
});

for(const ext of ['hwp','hwpx'])test(ext+' retains emphasized title and explanation runs in the first nested-owner piece',()=>{
  const src=emphasizedSubdivisionNestedTable(HwpDocument);src.insertPageBreak(0,0,2);
  const d=new HwpDocument(bytes(src,ext));src.free();
  try{
    const s=snapshot(d,ext),table=s.structure!.tables[0],operation={...op,target:table.id},undo=d.saveSnapshot(),old=bytes(d,ext);
    const inspect=(doc:any)=>{
      const t=readStructure(doc).tables[0];
      return nestedSubdivisionEvidence(doc,t,subdivisionNestedOwner(doc,t)!);
    };
    try{
      const original=inspect(d),paragraphs=storedOwnerParagraphs(d),previousPage=d.getPageTextLayout(0);
      assert.deepEqual(original.ownerLines.filter(r=>r.text).map(r=>[r.text,r.bold,r.italic,r.textColor]),[
        ['접수 ',true,false,'#000000'],['제목',false,false,'#dc2626'],['설',false,false,'#000000'],['명',false,true,'#000000'],
      ]);
      assert.deepEqual(original.ownerParagraphs.map(p=>p.shapes.length),[2,0,2]);
      assert.throws(()=>validateEditOperations([{...operation,distributeParagraphs:true}],s),/중첩/);
      executeDocumentOperations(d,s,validateEditOperations([operation],s));
      const reopened=new HwpDocument(bytes(d,ext));
      try{for(const result of [d,reopened]){
        assert.deepEqual(inspect(result),original);
        assert.equal(storedOwnerParagraphs(result),paragraphs);
        assert.equal(result.getPageTextLayout(0),previousPage);
        const cells=readStructure(result).tables[0].cells;
        assert.deepEqual(cells.map(c=>c.text),[table.cells[0].text,'','',...table.cells.slice(1).map(c=>c.text)]);
      }}finally{reopened.free();}
      d.restoreSnapshot(undo);assert.deepEqual(bytes(d,ext),old);
      const split=d.splitCellOnGrid.bind(d);
      let changed=false;
      d.splitCellOnGrid=(...args:any[])=>{
        const result=split(...args);
        d.applyCharFormatInCell(0,table.paragraph,0,0,0,3,5,'{"textColor":"#000000"}');
        changed=true;return result;
      };
      assert.throws(()=>executeDocumentOperations(d,s,validateEditOperations([operation],s)));
      assert.equal(changed,true);
      assert.deepEqual(bytes(d,ext),old);assert.deepEqual(inspect(d),original);
    }finally{d.discardSnapshot(undo);}
  }finally{d.free();}
});
