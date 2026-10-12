import test from 'node:test';
import assert from 'node:assert/strict';
import {parseToolbarSize,validateToolbarFont,validateToolbarLanguage} from '../src/modules/document/public/index.ts';
import {formattingToolbarCommands} from '../src/adapters/rhwp/formatting-toolbar.ts';
test('toolbar size uses pt and exact 1/100pt native units instead of prefix parsing/clamping',()=>{
 assert.equal(parseToolbarSize('12.5'),1250);assert.equal(parseToolbarSize('12.50 pt'),1250);assert.throws(()=>parseToolbarSize('.25'));
});
test('toolbar rejects invalid or out-of-range font size before any native mutation',()=>{
 for(const value of ['','0','4097','12evil','12,5','NaN','Infinity',null])assert.throws(()=>parseToolbarSize(value));
 assert.equal(parseToolbarSize('4096'),409600);assert.equal(parseToolbarSize('1'),100);
});
test('font names retain Korean/Latin names and reject control characters or reserved set markers',()=>{
 assert.equal(validateToolbarFont(' 맑은 고딕 '),'맑은 고딕');assert.equal(validateToolbarFont('Noto Sans CJK KR'),'Noto Sans CJK KR');
 for(const value of ['','\nArial','__fontset__test','a'.repeat(241),undefined])assert.throws(()=>validateToolbarFont(value));
});
test('language category is all or one of the seven explicit native slots',()=>{
 for(let i=0;i<7;i++)assert.equal(validateToolbarLanguage(String(i)),i);assert.equal(validateToolbarLanguage('all'),'all');
 for(const value of ['-1','7','0bad',null,false,undefined])assert.throws(()=>validateToolbarLanguage(value));
});
test('stale document version rejects font registration before any native resource or text mutation',()=>{
 const runtime=globalThis as any,previousWindow=runtime.window,previousDocument=runtime.document;
 runtime.document=new EventTarget();runtime.window={jueonyEditor:{busy:()=>false,formattingState:()=>({revision:'new',documentIdentity:'same',selectionToken:'same'})}};
 let resources=0,edits=0;const services={getContext:()=>({hasDocument:true,isEditable:true,isFormMode:false}),getInputHandler:()=>({active:true,cursor:{}}),wasm:{findOrCreateFontId:()=>resources++},eventBus:{emit:()=>edits++}};
 try{
  assert.throws(()=>formattingToolbarCommands[0]!.execute(services,{name:'맑은 고딕',expected:{revision:'old',documentIdentity:'same',selectionToken:'same'}}),/바뀌었습니다/);
  assert.throws(()=>formattingToolbarCommands[1]!.execute(services,{sizePt:12,expected:{revision:'old',documentIdentity:'same',selectionToken:'same'}}),/바뀌었습니다/);
  assert.equal(resources,0);assert.equal(edits,0);
 }finally{if(previousWindow===undefined)delete runtime.window;else runtime.window=previousWindow;if(previousDocument===undefined)delete runtime.document;else runtime.document=previousDocument;}
});
