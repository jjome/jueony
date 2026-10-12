import test from 'node:test';
import assert from 'node:assert/strict';
import {captureSessionCursor,restoreSessionCursor} from '../src/adapters/rhwp/session-cursor.ts';
import type {SessionCursorInput} from '../src/adapters/rhwp/session-cursor.ts';
import {validateSessionCursor,validateDocumentView} from '../src/modules/preferences/public/index.ts';

function fixture(){
 const body=[['가😀나','표','중간 문단'],['둘째 구역']];
 const cells=[['첫😀셀','같은 셀'],['다른 칸'],['마지막']];
 let position:any={sectionIndex:0,paragraphIndex:0,charOffset:2},range:any=null,block:any=null,phase:number|null=null,blocked=false,removed=false,calls=0;
 const input:SessionCursorInput={getCursorPosition:()=>position,restoreSessionSelection:(focus,anchor,p,b)=>{calls++;position=focus;range=anchor?{anchor,focus}:null;phase=p;block=b;return true;},
 cursor:{hasSelection:()=>Boolean(range),getSelection:()=>range,blockSelectionPhase:()=>phase,captureCellSelection:()=>block,
 isInHeaderFooter:()=>blocked,isInFootnote:()=>false,isInTextBox:()=>false,isInTableObjectSelection:()=>false,isInPictureObjectSelection:()=>false},
 wasm:{getSectionCount:()=>body.length,getParagraphCount:s=>body[s].length,getParagraphLength:(s,p)=>[...body[s][p]].length,getTextRange:(s,p,o,n)=>[...body[s][p]].slice(o,o+n).join(''),
 getTableDimensions:()=>{if(removed)throw new Error('table absent');return {rowCount:2,colCount:2,cellCount:3};},
 getCellInfo:(_s,_p,_c,i)=>i===0?{row:0,col:0,rowSpan:1,colSpan:2}:{row:1,col:i-1,rowSpan:1,colSpan:1},
 getCellParagraphCount:(_s,_p,_c,i)=>cells[i].length,getCellParagraphLength:(_s,_p,_c,i,p)=>[...cells[i][p]].length,getTextInCell:(_s,_p,_c,i,p,o,n)=>[...cells[i][p]].slice(o,o+n).join('')}};
 const cell=(i=0,p=0,o=2)=>({sectionIndex:0,parentParaIndex:1,paragraphIndex:p,charOffset:o,controlIndex:0,cellIndex:i,cellParaIndex:p});
 return {input,body,cells,cell,position:()=>position,calls:()=>calls,set:(p:any,a?:any,f3:number|null=null)=>{position=p;range=a?{anchor:a,focus:p}:null;phase=f3;block=null;},block:(b:any)=>{block=b;},blocked:(v:boolean)=>{blocked=v;},removed:()=>{removed=true;}};
}

test('backward body selection across sections retains anchor, focus, F3 phase and text guard',()=>{
 const f=fixture();f.set({sectionIndex:0,paragraphIndex:0,charOffset:1},{sectionIndex:1,paragraphIndex:0,charOffset:2},3);
 const saved=captureSessionCursor(f.input)!;assert.equal(saved.kind,'text');assert.equal(saved.kind==='text'&&saved.blockPhase,3);
 assert.equal(restoreSessionCursor(f.input,saved),true);assert.equal(f.calls(),1);
 f.body[0][2]='변경 문단';assert.equal(restoreSessionCursor(f.input,saved),false);assert.equal(f.calls(),1);
});
test('cell caret and same-cell multi-paragraph text selection restore Unicode offsets',()=>{
 const f=fixture();f.set(f.cell());const caret=captureSessionCursor(f.input)!;
 assert.equal(caret.focus.kind,'cell');assert.equal(restoreSessionCursor(f.input,caret),true);
 f.set(f.cell(0,1,3),f.cell(0,0,1));const selection=captureSessionCursor(f.input)!;
 assert.equal(restoreSessionCursor(f.input,selection),true);assert.equal(f.position().cellParaIndex,1);
 f.cells[2][0]='바뀐칸';assert.equal(restoreSessionCursor(f.input,selection),false);
 f.set(f.cell(1,0,2),f.cell(0,0,1));assert.equal(captureSessionCursor(f.input),undefined);
});
test('merged-cell F5 rectangle, phase and excluded cells require current table evidence',()=>{
 const f=fixture();f.set(f.cell());f.block({sec:0,ppi:1,ci:0,anchor:{row:0,col:0},focus:{row:1,col:1},phase:2,reason:'manual',excluded:['1,0']});
 const saved=captureSessionCursor(f.input)!;assert.equal(saved.kind,'cells');assert.equal(restoreSessionCursor(f.input,saved),true);
 if(saved.kind==='cells'){
  saved.block.excluded.push('99,0');assert.equal(restoreSessionCursor(f.input,saved),false);saved.block.excluded.pop();
  saved.block.focus.col=99;assert.equal(restoreSessionCursor(f.input,saved),false);
 }
 f.removed();assert.equal(restoreSessionCursor(f.input,saved),false);assert.equal(f.calls(),1);
});
test('unsupported or transient state is skipped without reading outside engine bounds',()=>{
 const f=fixture(),saved=captureSessionCursor(f.input)!;
 f.blocked(true);assert.equal(captureSessionCursor(f.input),undefined);assert.equal(restoreSessionCursor(f.input,saved),false);
 f.blocked(false);f.set({...f.cell(),cellPath:[{controlIndex:0,cellIndex:0,cellParaIndex:0},{controlIndex:0,cellIndex:0,cellParaIndex:0}]});assert.equal(captureSessionCursor(f.input),undefined);
 f.set({sectionIndex:50,paragraphIndex:99,charOffset:9});assert.equal(captureSessionCursor(f.input),undefined);
 f.set(f.cell(99));assert.equal(captureSessionCursor(f.input),undefined);assert.equal(f.calls(),0);
});
test('malformed optional cursor does not discard legacy view; validators make defensive copies',()=>{
 const f=fixture(),saved=captureSessionCursor(f.input)!;
 const copied=validateSessionCursor(saved)!;copied.focus.caret.offset=99;assert.equal(saved.focus.caret.offset,2);
 assert.equal(validateSessionCursor({...saved,blockPhase:99}),undefined);
 const view={version:1,zoom:1.1,fitMode:'none',scrollX:0,scrollY:8};assert.deepEqual(validateDocumentView({...view,cursor:{kind:'future'}}),view);
});
test('oversized table or body selection refuses persistence instead of truncating its integrity guard',()=>{
 const f=fixture();f.set(f.cell());f.input.wasm.getTableDimensions=()=>({rowCount:513,colCount:1,cellCount:513});assert.equal(captureSessionCursor(f.input),undefined);
 const g=fixture();g.body[0][1]='x'.repeat(100001);g.set({sectionIndex:0,paragraphIndex:2,charOffset:1},{sectionIndex:0,paragraphIndex:0,charOffset:1});assert.equal(captureSessionCursor(g.input),undefined);
});
