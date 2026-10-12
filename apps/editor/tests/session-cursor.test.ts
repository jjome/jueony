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

test('table object bookmarks restore only the same bounded table and host paragraph',()=>{
 const f=fixture();let restored:any;
 f.input.cursor.isInTableObjectSelection=()=>true;
 f.input.cursor.getSelectedTableRef=()=>({sec:0,ppi:1,ci:0});
 f.input.restoreSessionTableObject=ref=>{restored=ref;return true;};
 const saved=captureSessionCursor(f.input)!;assert.equal(saved.kind,'table-object');
 assert.equal(restoreSessionCursor(f.input,saved),true);assert.deepEqual(restored,{sec:0,ppi:1,ci:0});
 f.cells[0][0]='変更';assert.equal(restoreSessionCursor(f.input,saved),false);
 assert.equal(validateSessionCursor({...saved,control:-1}),undefined);
 assert.equal(validateSessionCursor({...saved,tableFingerprint:'bad'}),undefined);
 f.input.cursor.getSelectedTableRef=()=>({sec:0,ppi:1,ci:0,cellPath:[{}]});assert.equal(captureSessionCursor(f.input),undefined);
});

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
test('password-protected document context never enters cursor persistence',()=>{
 const f=fixture(),saved=captureSessionCursor(f.input)!;f.input.wasm.requiresPasswordForSave=true;
 assert.equal(captureSessionCursor(f.input),undefined);assert.equal(restoreSessionCursor(f.input,saved),false);assert.equal(f.calls(),0);
});

function nestedFixture(){
 const f=fixture(),nested=[['안😀쪽','둘째 문단'],['옆 셀']];let removed=false;
 const path=(paragraph=0,cell=0)=>[{controlIndex:0,cellIndex:0,cellParaIndex:1},{controlIndex:1,cellIndex:cell,cellParaIndex:paragraph}];
 const entry=(json:string)=>{
  const p=JSON.parse(json);if(removed||p.length!==2||p[0].controlIndex!==0||p[0].cellIndex!==0||p[0].cellParaIndex!==1||p[1].controlIndex!==1||!nested[p[1].cellIndex])throw new Error('nested target absent');
  return p[1];
 };
 Object.assign(f.input.wasm,{
  getTableDimensionsByPath:(_s:number,_p:number,json:string)=>{entry(json);return {rowCount:1,colCount:2,cellCount:2};},
  getCellInfoByPath:(_s:number,_p:number,json:string)=>({row:0,col:entry(json).cellIndex,rowSpan:1,colSpan:1}),
  getCellParagraphCountByPath:(_s:number,_p:number,json:string)=>nested[entry(json).cellIndex].length,
  getCellParagraphLengthByPath:(_s:number,_p:number,json:string)=>{const e=entry(json);return [...nested[e.cellIndex][e.cellParaIndex]].length;},
  getTextInCellByPath:(_s:number,_p:number,json:string,o:number,n:number)=>{const e=entry(json);return [...nested[e.cellIndex][e.cellParaIndex]].slice(o,o+n).join('');},
 });
 const at=(paragraph=0,cell=0,offset=2)=>({...f.cell(),paragraphIndex:paragraph,cellParaIndex:paragraph,charOffset:offset,cellPath:path(paragraph,cell)});
 return {...f,nested,path,at,removeNested:()=>{removed=true;}};
}

test('nested cell caret and backward text range preserve the complete path and Unicode offsets',()=>{
 const f=nestedFixture();f.set(f.at());const saved=captureSessionCursor(f.input)!;
 assert.equal(saved?.focus.kind,'cell');assert.equal(restoreSessionCursor(f.input,saved),true);assert.deepEqual(f.position().cellPath,f.path());
 f.set(f.at(0,0,1),f.at(1,0,3));const range=captureSessionCursor(f.input)!;
 assert.equal(restoreSessionCursor(f.input,range),true);assert.deepEqual(f.position().cellPath,f.path(0));
 assert.deepEqual(range.kind==='text'&&range.anchor?.kind==='cell'&&range.anchor.cellPath,f.path(1));
 // Sibling nested cells are not a text range even though the flat outer-cell address matches.
 f.set(f.at(0,1,1),f.at(0,0,1));assert.equal(captureSessionCursor(f.input),undefined);
 f.nested[1][0]='수정된 옆 셀';assert.equal(restoreSessionCursor(f.input,saved),false);assert.equal(f.calls(),2);
});

test('nested bookmarks reject changed ancestors, removed controls and malformed path contracts',()=>{
 const f=nestedFixture();f.set(f.at());const saved=captureSessionCursor(f.input)!;
 assert.ok(saved);f.cells[0][0]='바뀐 상위 표';assert.equal(restoreSessionCursor(f.input,saved),false);assert.equal(f.calls(),0);
 const g=nestedFixture();g.set(g.at());const unchanged=captureSessionCursor(g.input)!;g.removeNested();assert.equal(restoreSessionCursor(g.input,unchanged),false);
 if(saved.focus.kind==='cell'){
  const copy=validateSessionCursor(saved)!;
  if(copy.focus.kind==='cell'){copy.focus.cellPath![0].cellParaIndex=99;assert.equal(saved.focus.cellPath![0].cellParaIndex,1);}
  for(const path of [[],[f.path()[0]],Array(9).fill(f.path()[0]),[{...f.path()[0],cellIndex:-1},f.path()[1]],[f.path()[0],{...f.path()[1],cellParaIndex:99}]]){
   assert.equal(validateSessionCursor({...saved,focus:{...saved.focus,cellPath:path}}),undefined);
  }
 }
});

test('nested F5 block restores the owning table path and rejects out-of-bounds rectangles',()=>{
 const f=nestedFixture();f.set(f.at());f.block({sec:0,ppi:1,ci:0,cellPath:f.path(),anchor:{row:0,col:0},focus:{row:0,col:1},phase:2,reason:'manual',excluded:[]});
 const saved=captureSessionCursor(f.input)!;assert.equal(saved?.kind,'cells');assert.equal(restoreSessionCursor(f.input,saved),true);
 let restored:any;f.input.restoreSessionSelection=(_focus,_anchor,_phase,block)=>{restored=block;return true;};
 assert.equal(restoreSessionCursor(f.input,saved),true);assert.deepEqual(restored.cellPath,f.path());
 if(saved.kind==='cells'){saved.block.focus.row=1;assert.equal(restoreSessionCursor(f.input,saved),false);}
 f.block({sec:0,ppi:1,ci:0,cellPath:[f.path()[0],{...f.path()[1],controlIndex:2}],anchor:{row:0,col:0},focus:{row:0,col:1},phase:2,reason:'manual',excluded:[]});
 assert.equal(captureSessionCursor(f.input),undefined);
});

function pictureFixture(){
 const f=fixture();let restored:any,multi=false,ref:any={sec:0,ppi:1,ci:2,type:'image'};
 const props={width:100,height:200,description:'그림'},bytes=new Uint8Array([1,2,3,4]);
 f.input.cursor.isInPictureObjectSelection=()=>true;
 f.input.cursor.getSelectedPictureRef=()=>ref;f.input.cursor.isMultiPictureSelection=()=>multi;
 f.input.restoreSessionPictureObject=value=>{restored=value;return true;};
 f.input.wasm.getPictureProperties=()=>props;f.input.wasm.getControlImageData=()=>bytes;f.input.wasm.getControlImageMime=()=> 'image/png';
 return {...f,props,bytes,restored:()=>restored,multi:(v:boolean)=>{multi=v;},ref:(v:any)=>{ref=v;}};
}

test('top-level embedded image selection persists a hash only and guards bytes, properties and host text',()=>{
 const f=pictureFixture(),saved=captureSessionCursor(f.input)!;assert.equal(saved?.kind,'picture-object');
 assert.equal(restoreSessionCursor(f.input,saved),true);assert.deepEqual(f.restored(),{sec:0,ppi:1,ci:2,type:'image'});
 assert.equal(JSON.stringify(saved).includes('description'),false);assert.equal(JSON.stringify(saved).includes('1,2,3,4'),false);
 f.bytes[0]=99;assert.equal(restoreSessionCursor(f.input,saved),false);f.bytes[0]=1;
 f.props.width++;assert.equal(restoreSessionCursor(f.input,saved),false);f.props.width--;
 f.body[0][1]='違う';assert.equal(restoreSessionCursor(f.input,saved),false);assert.equal(f.calls(),0);
 assert.equal(validateSessionCursor({...saved,pictureFingerprint:'bad'}),undefined);assert.equal(validateSessionCursor({...saved,control:-1}),undefined);
});

test('multi, nested, linked/missing and non-picture objects refuse persistence without a fake successful restore',()=>{
 const f=pictureFixture(),saved=captureSessionCursor(f.input)!;
 f.multi(true);assert.equal(captureSessionCursor(f.input),undefined);f.multi(false);
 for(const ref of [{type:'group'},{cellIdx:0},{cellPath:[{}]},{headerFooter:{}},{noteRef:{}},{missing:true}]){
  f.ref({sec:0,ppi:1,ci:2,type:'image',...ref});assert.equal(captureSessionCursor(f.input),undefined);
 }
 f.ref({sec:0,ppi:1,ci:2,type:'image'});f.input.wasm.getControlImageData=()=>new Uint8Array();assert.equal(captureSessionCursor(f.input),undefined);
 f.input.wasm.getControlImageData=()=>new Uint8Array(8*1024*1024+1);assert.equal(captureSessionCursor(f.input),undefined);
 f.input.restoreSessionPictureObject=undefined;assert.equal(restoreSessionCursor(f.input,saved),false);
});

test('pinned WASM embedded-image bookmark survives HWP and HWPX reopen without modifying bytes',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {default:init,HwpDocument}=await import('../node_modules/@rhwp/core/rhwp.js');
 await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
 const doc=HwpDocument.createEmpty();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWPgmnbnPwAEpgJ8+MzEcgAAAABJRU5ErkJggg==','base64');
 try{
  doc.createBlankDocument();const ref=JSON.parse(doc.insertPicture(0,0,0,'',png,7200,7200,1,1,'png','fixture'));
  assert.equal(ref.ok,true);
  const inputFor=(document:any)=>{
   const f=pictureFixture();
   f.ref({sec:0,ppi:ref.paraIdx,ci:ref.controlIdx,type:'image'});
   f.input.wasm=new Proxy(document,{get:(target,key)=>{
    if(key==='getControlImageData'||key==='getControlImageMime')return(s:number,p:number,c:number)=>target[key](s,p,'',c);
    if(key==='getPictureProperties')return(...args:any[])=>JSON.parse(target[key](...args));
    return typeof target[key]==='function'?target[key].bind(target):target[key];
   }});
   return f;
  };
  const input=inputFor(doc),before=doc.exportHwpx(),saved=captureSessionCursor(input.input)!;
  assert.equal(saved?.kind,'picture-object');assert.equal(restoreSessionCursor(input.input,saved),true);assert.deepEqual(doc.exportHwpx(),before);
  for(const bytes of [doc.exportHwp(),before]){
   const reopened=new HwpDocument(bytes);
   try{const restored=inputFor(reopened),snapshot=reopened.exportHwpx();assert.equal(restoreSessionCursor(restored.input,saved),true);assert.deepEqual(reopened.exportHwpx(),snapshot);}finally{reopened.free();}
  }
 }finally{doc.free();}
});

function headerFixture(){
 const f=fixture(),texts=['머😀리말','둘째 문단'];let restored:any,range:any=null;
 Object.assign(f.input.cursor,{headerFooterMode:'header',hfSectionIdx:0,hfApplyTo:2,hfParaIdx:0,hfCharOffset:2,
  isInHeaderFooter:()=>true,hasSelection:()=>Boolean(range),getHeaderFooterSelectionOrdered:()=>range});
 f.input.wasm.getHeaderFooter=()=>JSON.stringify({ok:true,exists:true,kind:'header',applyTo:2,paraIndex:0,controlIndex:3,paraCount:texts.length,text:texts.join('\n')});
 f.input.wasm.getHeaderFooterParaInfo=(_s,_h,_a,p)=>JSON.stringify({ok:true,paraCount:texts.length,charCount:[...texts[p]].length,text:texts[p]});
 f.input.restoreSessionHeaderFooter=saved=>{restored=saved;return true;};
 return {...f,texts,range:(value:any)=>{range=value;},restored:()=>restored};
}

test('header/footer caret and backwards text selection retain target and body return point',()=>{
 const f=headerFixture(),caret=captureSessionCursor(f.input)!;assert.equal(caret?.kind,'header-footer');assert.equal(restoreSessionCursor(f.input,caret),true);
 assert.deepEqual(f.restored().focus.caret,caret.focus.caret);
 f.range({start:{sectionIdx:0,isHeader:true,applyTo:2,paraIdx:0,charOffset:2},end:{sectionIdx:0,isHeader:true,applyTo:2,paraIdx:1,charOffset:3}});
 const saved=captureSessionCursor(f.input)!;assert.equal(saved?.kind,'header-footer');
 if(saved.kind==='header-footer'){assert.equal(saved.anchor?.paragraph,1);assert.equal(saved.caret.paragraph,0);assert.equal(saved.caret.before,'머😀');}
 assert.equal(restoreSessionCursor(f.input,saved),true);f.texts[1]='다른 문단';assert.equal(restoreSessionCursor(f.input,saved),false);assert.equal(f.calls(),0);
 assert.equal(validateSessionCursor({...saved,applyTo:3}),undefined);assert.equal(validateSessionCursor({...saved,storyFingerprint:'bad'}),undefined);
 const g=headerFixture();g.input.restoreSessionHeaderFooter=undefined;assert.equal(captureSessionCursor(g.input),undefined);
});

function noteFixture(){
 const f=fixture(),texts=['  각😀주','다음 문단'];let restored:any,range:any=null,location:any={ok:true,sectionIdx:0,paraIdx:1,controlIdx:1,sourceType:'footnote'};
 Object.assign(f.input.cursor,{fnSectionIdx:0,fnParaIdx:1,fnControlIdx:1,fnInnerParaIdx:0,fnCharOffset:4,fnPageNum:0,fnFootnoteIndex:0,
  isInFootnote:()=>true,hasSelection:()=>Boolean(range),getFootnoteSelection:()=>range});
 f.input.wasm.getFootnoteInfo=()=>({ok:true,paraCount:texts.length,totalTextLen:texts.reduce((s,t)=>s+[...t].length,0),number:1,texts:[...texts]});
 f.input.wasm.getPageFootnoteInfo=()=>location;
 f.input.restoreSessionFootnote=saved=>{restored=saved;return true;};
 return {...f,texts,range:(value:any)=>{range=value;},location:(value:any)=>{location=value;},restored:()=>restored};
}

test('note range restores exact source only and refuses changed page ownership, note text or source type',()=>{
 const f=noteFixture(),caret=captureSessionCursor(f.input)!;assert.equal(caret?.kind,'footnote');assert.equal(restoreSessionCursor(f.input,caret),true);
 f.range({anchor:{fnParaIdx:1,charOffset:3},focus:{fnParaIdx:0,charOffset:4},pageNum:0,footnoteIndex:0});
 const saved=captureSessionCursor(f.input)!;assert.equal(saved?.kind,'footnote');assert.equal(restoreSessionCursor(f.input,saved),true);
 if(saved.kind==='footnote')assert.equal(f.restored().anchor.paragraph,1);
 f.location({ok:true,sectionIdx:0,paraIdx:1,controlIdx:2,sourceType:'footnote'});assert.equal(restoreSessionCursor(f.input,saved),false);
 f.location({ok:true,sectionIdx:0,paraIdx:1,controlIdx:1,sourceType:'endnote'});assert.equal(restoreSessionCursor(f.input,saved),false);
 f.location({ok:true,sectionIdx:0,paraIdx:1,controlIdx:1,sourceType:'footnote'});f.texts[1]='변경됨';assert.equal(restoreSessionCursor(f.input,saved),false);
 for(const override of [{page:-1},{index:-1},{sourceType:'<bad>'},{control:-1}])assert.equal(validateSessionCursor({...saved,...override}),undefined);
 assert.equal(f.calls(),0);
});

test('special story bounds, malformed selections and protected files refuse persistence',()=>{
 const h=headerFixture();h.texts[0]='x'.repeat(100001);assert.equal(captureSessionCursor(h.input),undefined);
 const f=noteFixture();f.range({anchor:{fnParaIdx:1,charOffset:99},focus:{fnParaIdx:0,charOffset:4},pageNum:0,footnoteIndex:0});assert.equal(captureSessionCursor(f.input),undefined);
 f.range(null);const saved=captureSessionCursor(f.input)!;f.input.wasm.requiresPasswordForSave=true;assert.equal(captureSessionCursor(f.input),undefined);assert.equal(restoreSessionCursor(f.input,saved),false);
});

test('pinned WASM header and footer targets survive both save formats and remain unchanged by restoration',async()=>{
 const {readFile}=await import('node:fs/promises'),{default:init,HwpDocument}=await import('../node_modules/@rhwp/core/rhwp.js');
 await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
 for(const isHeader of [true,false]){
  const doc=HwpDocument.createEmpty();
  try{
   doc.createBlankDocument();doc.insertText(0,0,0,'본문');doc.createHeaderFooter(0,isHeader,2);doc.insertTextInHeaderFooter(0,isHeader,2,0,0,'머😀리말');
   const inputFor=(document:any)=>{const f=headerFixture();Object.assign(f.input.cursor,{headerFooterMode:isHeader?'header':'footer'});
    f.input.wasm=new Proxy(document,{get:(target,key)=>typeof target[key]==='function'?target[key].bind(target):target[key]});return f;};
   const f=inputFor(doc),before=doc.exportHwpx(),saved=captureSessionCursor(f.input)!;assert.equal(saved?.kind,'header-footer');
   assert.equal(restoreSessionCursor(f.input,saved),true);assert.deepEqual(doc.exportHwpx(),before);
   for(const bytes of [doc.exportHwp(),before]){const reopened=new HwpDocument(bytes);try{assert.equal(restoreSessionCursor(inputFor(reopened).input,saved),true);}finally{reopened.free();}}
  }finally{doc.free();}
 }
});

test('pinned WASM body footnote keeps its control binding and Unicode caret after HWP/HWPX reopen',async()=>{
 const {readFile}=await import('node:fs/promises'),{default:init,HwpDocument}=await import('../node_modules/@rhwp/core/rhwp.js');
 await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
 const doc=HwpDocument.createEmpty();
 try{
  doc.createBlankDocument();doc.insertText(0,0,0,'본문');const ref=JSON.parse(doc.insertFootnote(0,0,1));assert.equal(ref.ok,true);
  doc.insertTextInFootnote(0,ref.paraIdx,ref.controlIdx,0,2,'각😀주');
  const inputFor=(document:any)=>{const f=noteFixture();Object.assign(f.input.cursor,{fnParaIdx:ref.paraIdx,fnControlIdx:ref.controlIdx});
   f.input.wasm=new Proxy(document,{get:(target,key)=>{
    if(key==='getFootnoteInfo'||key==='getPageFootnoteInfo')return(...args:any[])=>JSON.parse(target[key](...args));
    return typeof target[key]==='function'?target[key].bind(target):target[key];
   }});return f;};
  const f=inputFor(doc),before=doc.exportHwpx(),saved=captureSessionCursor(f.input)!;assert.equal(saved?.kind,'footnote');
  assert.equal(restoreSessionCursor(f.input,saved),true);assert.deepEqual(doc.exportHwpx(),before);
  for(const bytes of [doc.exportHwp(),before]){const reopened=new HwpDocument(bytes);try{assert.equal(restoreSessionCursor(inputFor(reopened).input,saved),true);}finally{reopened.free();}}
 }finally{doc.free();}
});
