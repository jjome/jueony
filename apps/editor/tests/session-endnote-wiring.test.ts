import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {captureSessionCursor,restoreSessionCursor} from '../src/adapters/rhwp/session-cursor.ts';
import {validateDocumentView,validateSessionCursor} from '../src/modules/preferences/public/index.ts';

function fixture(kind='endnote'){
 let active=true,calls=0,ownerPresent=true,story=['  미😀주','둘째 문단'];
 const paragraph=(text:string,controls:any[]=[])=>({text,paragraph:{alignment:'left'},characters:[{start:0,end:[...text].length,properties:{bold:false}}],emptyCharacters:null,endCharacters:{bold:false},metadata:{},style:{english_name:'Endnote'},controls});
 const evidence=()=>ownerPresent?{version:1,complete:true,identityKnown:true,kind,section:0,parent:2,control:4,identity:{mode:'semantic',instance:null},owner:{Endnote:{number:1,number_shape:0}},context:[{paragraph:2,text:'본문',paragraphProperties:{alignment:'left'},host:paragraph('본문'),controlKinds:[{kind:'endnote',target:true}]}],paragraphs:story.map(text=>paragraph(text))}:{version:1,complete:false,reason:'missing logical owner'};
 const edit={ok:true,kind,pageNum:3,footnoteIndex:1,fnParaIndex:0,charOffset:2,virtualParaIndex:8};
 const document:any={getSessionStoryEvidence:()=>JSON.stringify(evidence()),getNoteEditInfo:()=>JSON.stringify(edit),getFootnoteInfo:()=>JSON.stringify({ok:true,paraCount:story.length,totalTextLen:story.join('').length,number:1,texts:story}),getCursorRectInNote:(_s:number,_p:number,_c:number,paragraphIndex:number,offset:number)=>JSON.stringify({pageIndex:3,x:paragraphIndex+1,y:offset+1,height:12})};
 let restored:any;
 const input:any={
  getCursorPosition:()=>({sectionIndex:0,paragraphIndex:2,charOffset:0}),restoreSessionSelection:()=>false,
  wasm:{borrowDocumentHandle:()=>document,requiresPasswordForSave:false},
  cursor:{hasSelection:()=>active,getSelection:()=>null,blockSelectionPhase:()=>null,captureCellSelection:()=>null,isInHeaderFooter:()=>false,isInFootnote:()=>active,isInTextBox:()=>false,isInTableObjectSelection:()=>false,isInPictureObjectSelection:()=>false,fnSectionIdx:0,fnParaIdx:2,fnControlIdx:4,fnInnerParaIdx:0,fnCharOffset:4,fnPageNum:3,fnFootnoteIndex:1,getFootnoteSelection:()=>({anchor:{fnParaIdx:1,charOffset:5},focus:{fnParaIdx:0,charOffset:4},pageNum:3,footnoteIndex:1})},
  restoreSessionEndnoteSelection:(target:any)=>{calls++;restored=structuredClone(target);return true;},
 };
 return {input,document,edit,evidence,setActive:(value:boolean)=>active=value,setOwner:(value:boolean)=>ownerPresent=value,setStory:(value:string[])=>story=value,calls:()=>calls,restored:()=>restored};
}

test('shared SessionCursor and document-view journal retain a reverse Unicode endnote selection',()=>{
 const f=fixture(),saved=captureSessionCursor(f.input)!;
 assert.equal(saved.kind,'endnote-selection');
 assert.deepEqual(saved.focus,{paragraph:0,offset:4,paragraphLength:5,before:'  미😀',after:'주'});
 assert.deepEqual(saved.anchor,{paragraph:1,offset:5,paragraphLength:5,before:'둘째 문단',after:''});
 assert.deepEqual(validateSessionCursor(saved),saved);
 const view=validateDocumentView({version:1,zoom:1,fitMode:'none',scrollX:0,scrollY:0,cursor:saved});
 assert.deepEqual(view?.cursor,saved);
 f.setActive(false);
 assert.equal(restoreSessionCursor(f.input,view!.cursor),true);
 assert.deepEqual(f.restored(),{section:0,parent:2,control:4,page:3,index:1,virtualParagraph:8,focus:{paragraph:0,offset:4},anchor:{paragraph:1,offset:5}});
 assert.equal(f.calls(),1);
});

test('shared restore rejects stale story and deleted owner before the Studio callback',()=>{
 for(const mode of ['story','owner']){const f=fixture(),saved=captureSessionCursor(f.input)!;f.setActive(false);if(mode==='story')f.setStory(['  미😀주','둘째 변경']);else f.setOwner(false);assert.equal(restoreSessionCursor(f.input,saved),false,mode);assert.equal(f.calls(),0,mode);}
});

test('footnotes and unsupported note contents do not enter the endnote bookmark path',()=>{
 const footnote=fixture('footnote');assert.notEqual(captureSessionCursor(footnote.input)?.kind,'endnote-selection');
 for(const control of ['Field','Table','Shape','EmbeddedObject']){const f=fixture(),base=f.evidence();base.paragraphs[0].controls=[{[control]:{}}];f.document.getSessionStoryEvidence=()=>JSON.stringify(base);assert.equal(captureSessionCursor(f.input),undefined,control);}
});

test('Studio callback validates the live endnote locator and preserves selection direction',async()=>{
 const source=await readFile(new URL('../scripts/integration/studio-patches.mjs',import.meta.url),'utf8');
 assert.match(source,/restoreSessionEndnoteSelection:/);
 assert.match(source,/edit\.kind!=='endnote'/);
 assert.match(source,/edit\.virtualParaIndex!==target\.virtualParagraph/);
 assert.match(source,/setFnCursorPosition\(target\.anchor\.paragraph,target\.anchor\.offset\);this\.cursor\.setFnAnchor\(\)/);
 assert.match(source,/setFnCursorPosition\(target\.focus\.paragraph,target\.focus\.offset\)/);
 assert.match(source,/selection\.anchor\.fnParaIdx!==target\.anchor\.paragraph/);
 assert.match(source,/catch\{return abort\(\);\}/);
});
