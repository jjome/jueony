import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureBodyCaret,restoreBodyCaret} from '../src/adapters/rhwp/body-caret.ts';
import {validateBodyCaret,validateDocumentView} from '../src/modules/preferences/public/index.ts';
function fixture() {
 let text='가😀나\t문서', position={sectionIndex:0,paragraphIndex:0,charOffset:2}, blocked=false, calls=0;
 const input={getCursorPosition:()=>position,restoreSessionCaret:(p:typeof position)=>{position=p;calls++;},
 cursor:{hasSelection:()=>blocked,isInHeaderFooter:()=>false,isInFootnote:()=>false,isInTextBox:()=>false,isInCellSelectionMode:()=>false,isInTableObjectSelection:()=>false,isInPictureObjectSelection:()=>false,moveTo:()=>{}},
 wasm:{getSectionCount:()=>1,getParagraphCount:()=>1,getParagraphLength:()=>[...text].length,getTextRange:(_s:number,_p:number,o:number,n:number)=>[...text].slice(o,o+n).join('')}};
 return {input,position:()=>position,calls:()=>calls,text:(v:string)=>{text=v;},blocked:(v:boolean)=>{blocked=v;}};
}
test('body caret uses scalar offsets and restores emoji/tab context without editing',()=>{
 const f=fixture(),caret=captureBodyCaret(f.input)!;assert.equal(caret.offset,2);assert.equal(caret.before,'가😀');assert.equal(caret.after,'나\t문서');
 assert.equal(restoreBodyCaret(f.input,caret),true);assert.equal(f.calls(),1);assert.deepEqual(captureBodyCaret(f.input),caret);
});
test('changed length, changed same-length text and out-of-range target never move a caret',()=>{
 const f=fixture(),caret=captureBodyCaret(f.input)!;
 f.text('짧음');assert.equal(restoreBodyCaret(f.input,caret),false);
 f.text('가😀다\t문서');assert.equal(restoreBodyCaret(f.input,caret),false);
 f.text('가😀나\t문서');assert.equal(restoreBodyCaret(f.input,{...caret,section:1}),false);assert.equal(restoreBodyCaret(f.input,{...caret,paragraph:1}),false);assert.equal(f.calls(),0);
});
test('selection or unsupported nested mode cannot be captured or overwritten',()=>{
 const f=fixture(),caret=captureBodyCaret(f.input)!;f.blocked(true);assert.equal(captureBodyCaret(f.input),undefined);assert.equal(restoreBodyCaret(f.input,caret),false);
 f.blocked(false);f.input.cursor.isInHeaderFooter=()=>true;assert.equal(captureBodyCaret(f.input),undefined);assert.equal(restoreBodyCaret(f.input,caret),false);assert.equal(f.calls(),0);
});
test('malformed optional caret is discarded without losing old view settings',()=>{
 const f=fixture(),caret=captureBodyCaret(f.input)!;
 for(const c of [{...caret,offset:999},{...caret,before:''},{...caret,after:5},{...caret,paragraph:-1},{...caret,section:1.5}])assert.equal(validateBodyCaret(c),undefined);
 const view={version:1,zoom:1,fitMode:'none',scrollX:0,scrollY:0};assert.deepEqual(validateDocumentView({...view,caret:{version:8}}),view);
});

test('transient cursor from the previous document cannot read outside newly loaded bytes',()=>{
 const f=fixture();let reads=0;
 f.input.wasm.getParagraphLength=()=>{reads++;return 1;};
 f.input.wasm.getTextRange=()=>{throw new Error('out-of-range read');};
 assert.equal(captureBodyCaret(f.input),undefined);assert.equal(reads,1);
 for(const position of [{sectionIndex:1,paragraphIndex:0,charOffset:0},{sectionIndex:0,paragraphIndex:1,charOffset:0},{sectionIndex:-1,paragraphIndex:0,charOffset:0}]){
   f.input.getCursorPosition=()=>position;assert.equal(captureBodyCaret(f.input),undefined);
 }
 assert.equal(reads,1);assert.equal(f.calls(),0);
});
