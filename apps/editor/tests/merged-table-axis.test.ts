import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations} from '../src/modules/document/public/index.ts';
import {tableAxisPlan} from '../src/modules/document/public/engine-integration.ts';

const pkg = process.env.JUEONY_ENGINE_PACKAGE ?? fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument} = await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const rowHeights = [5000,6000,7000,8000], colWidths = [6000,8000,10000,12000];
const base=[0,1,0], id='s0p1t0';
const bytes=(doc:any, ext:string) => ext==='hwp'?doc.exportHwp():doc.exportHwpx();
function fixture(format:string) {
  const d=HwpDocument.createEmpty();
  try {
    d.createBlankDocument(); d.insertText(0,0,0,'앞 문단'); d.splitParagraph(0,0,4); d.createTable(0,1,0,4,4);
    for(let i=0;i<16;i++) {
      d.insertTextInCell(...base,i,0,0,'Cell'+i);
      d.setCellProperties(...base,i,JSON.stringify({height:rowHeights[Math.floor(i/4)],width:colWidths[i%4]}));
    }
    d.applyCharFormatInCell(...base,5,0,1,2,'{"bold":true}');
    d.mergeTableCells(...base,1,1,2,2);
    return new HwpDocument(bytes(d,format));
  } finally { d.free(); }
}
const snapshot=(d:any,format:string):any=>({name:'병합표.'+format,revision:'1',nodes:[],limitations:[],structure:readStructure(d)});
for (const format of ['hwpx','hwp']) for (const row of [true,false]) for (const [insert,at] of [[true,2],[false,1],[false,2],[true,4]] as const) {
  const kind=(insert?'insert':'delete')+'_table_'+(row?'row':'column');
  test(format+' '+kind+' '+at+' preserves merged content, coordinates and undo/redo through reopen',()=>{
    const d=fixture(format);
    try {
      const s=snapshot(d,format), previous=bytes(d,format), old=s.structure.tables[0].cells.find((c:any)=>c.row===1&&c.column===1);
      const values=at===4?['가','나','다','라']:['가','','','라'];
      const operation:any={kind,target:id,index:at,...(insert?{values}:{})};
      const ops=validateEditOperations([operation],s), undo=d.saveSnapshot();
      executeDocumentOperations(d,s,ops);
      const after=readStructure(d).tables[0], anchor=after.cells.find(c=>c.row===1&&c.column===1)!;
      const delta=at===4?0:insert?1:-1;
      assert.equal(anchor.text,old.text);assert.ok(anchor.text.includes('Cell10'));
      assert.equal(anchor.rowSpan,2+(row?delta:0)); assert.equal(anchor.columnSpan,2+(row?0:delta));
      assert.equal(anchor.properties.height,old.properties.height+(row?delta*rowHeights[Math.min(at,3)]:0));
      assert.equal(anchor.properties.width,old.properties.width+(row?0:delta*colWidths[Math.min(at,3)]));
      if(insert) assert.equal(after.cells.find(c=>c.row===(row?at:0)&&c.column===(row?0:at))?.text,'가');
      const saved=bytes(d,format), reopened=new HwpDocument(saved);
      try { assert.deepEqual(readStructure(reopened).tables[0],after); } finally { reopened.free(); }
      const redo=d.saveSnapshot(); d.restoreSnapshot(undo); assert.deepEqual(bytes(d,format),previous);
      d.restoreSnapshot(redo); assert.deepEqual(bytes(d,format),saved); d.discardSnapshot(redo);d.discardSnapshot(undo);
    } finally { d.free(); }
  });
}
test('merged axis refuses protected, covered, stale and malformed targets without mutation',()=>{
  const d=fixture('hwpx');
  try {
    const s=snapshot(d,'hwpx'), op:any={kind:'insert_table_row',target:id,index:2,values:['','','','']};
    assert.throws(()=>validateEditOperations([{...op,values:['','덮어쓰기','','']}],s),/비워/);
    const bad=structuredClone(s.structure.tables[0]);bad.cells[0].rowSpan=4;
    assert.throws(()=>tableAxisPlan(bad,op),/겹칩/);
    const missing=structuredClone(s.structure.tables[0]);missing.cells.pop();
    assert.throws(()=>tableAxisPlan(missing,op),/위치/);
    d.insertTextInCell(...base,0,0,0,'다른 변경');
    const stale=bytes(d,'hwpx');
    assert.throws(()=>executeDocumentOperations(d,s,[op]),/바뀌었습니다/);assert.deepEqual(bytes(d,'hwpx'),stale);
    d.setCellProperties(...base,0,'{"cellProtect":true}');
    const locked=bytes(d,'hwpx');
    assert.throws(()=>executeDocumentOperations(d,s,[op]),/보호/);assert.deepEqual(bytes(d,'hwpx'),locked);
  } finally { d.free(); }
});
for (const failure of ['neighbour', 'save']) test('merged axis rolls back a post-edit '+failure+' failure',()=>{
  const d=fixture('hwpx');
  try {
    const s=snapshot(d,'hwpx'), before=bytes(d,'hwpx');
    const injected=new Proxy(d,{get(target,property){
      if(failure==='neighbour' && property==='deleteTableRow') return (...args:any[])=>{
        const result=target.deleteTableRow(...args);
        target.insertTextInCell(...base,0,0,0,'예기치 않은 변경');
        return result;
      };
      if(failure==='save' && property==='exportHwpxWithReport') return ()=>{throw new Error('시험 저장 실패');};
      const value=Reflect.get(target,property);
      return typeof value==='function'?value.bind(target):value;
    }});
    assert.throws(()=>executeDocumentOperations(injected,s,[{kind:'delete_table_row',target:id,index:1}]),
      failure==='neighbour'?/서식 또는 크기/:/시험 저장 실패/);
    assert.deepEqual(bytes(d,'hwpx'),before);
  } finally { d.free(); }
});
