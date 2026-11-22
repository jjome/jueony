import assert from 'node:assert/strict';
import test from 'node:test';
import {createManualAlignmentMacro} from '../src/adapters/rhwp/manual-alignment-macro.ts';
import {serializeScriptMacroB142} from '../src/modules/script-macros/public/index.ts';
import type {Snapshot} from '../src/modules/document/public/index.ts';

test('manual alignment records only confirmed edits and replays against the original paragraph without serializing body text',()=>{
 let revision=0,identity='document-a',alignment='left',text='본문을 외부로 내보내지 않습니다',invalid='',hasSelection=false;
 const state=()=>({documentIdentity:identity,revision:String(revision),active:true,editable:true,busy:false,composing:false,hasSelection});
 const target=()=>({section:0,paragraph:0,text,alignment,paragraphCount:1,sectionCount:1});
 const macro=createManualAlignmentMacro(state,target,message=>invalid=message);
 const change=(value:string)=>{revision++;alignment=value;return {ok:true};};
 const snapshot=():Snapshot=>({revision:String(revision),name:'test.hwp',limitations:[],
  nodes:[{id:'s0p0',section:0,paragraph:0,text,editable:true}],
  structure:{sections:[],tables:[],unsupportedControls:[],paragraphs:[{id:'s0p0',characters:{},paragraph:{alignment}}]}});
 macro.start();
 macro.dispatch('file:save',()=>({ok:true}));
 macro.dispatch('format:align-right',()=>({ok:false}));
 macro.dispatch('format:align-center',()=>change('center'));
 macro.dispatch('format:align-right',()=>change('right'));
 macro.dispatch('format:align-distribute',()=>change('distribute'));
 const saved=macro.stop('정렬');
 assert.deepEqual(saved.steps.map(step=>step.commandId),['format:align-center','format:align-right','format:align-distribute']);
 assert(!serializeScriptMacroB142(saved).includes(text));
 assert.deepEqual(macro.prepare(saved,snapshot()).operations.map(operation=>operation.kind==='format_paragraph'&&operation.properties.alignment),['center','right','distribute']);
 const changed=structuredClone(snapshot());changed.nodes[0].text+=' 수정';
 assert.throws(()=>macro.prepare(saved,changed),/문단 내용/);
 identity='document-b';
 assert.throws(()=>macro.prepare(saved,snapshot()),/기록한 문서/);
 identity='document-a';
 macro.start();
 revision++;
 macro.dispatch('format:align-left',()=>change('left'));
 assert.equal(macro.recording,false);
 assert.match(invalid,/예상과 달라졌습니다/);
 hasSelection=true;
 assert.throws(()=>macro.prepare(saved,snapshot()),/일반|편집 가능한/);
});

test('manual edits keep Unicode coordinates, collapse repeated edits and replay the recorded alignment', () => {
  let revision=0, text='비공개 😀 원문', alignment='left', composing=false, selected=false, invalid='';
  const original=text;
  const state=()=>({documentIdentity:'original',revision:String(revision),active:true,editable:true,busy:false,composing,hasSelection:selected});
  const target=(allowSelection?:boolean)=>selected&&!allowSelection?undefined:{section:0,paragraph:0,text,alignment,
    format:'style',adjacent:'same',paragraphCount:1,sectionCount:1};
  const macro=createManualAlignmentMacro(state,target,message=>invalid=message);
  const input=(value:string)=>{revision++;selected=false;text=value;};
  macro.start();
  selected=true;
  macro.text(()=>input('비공개 😀 새 원문'));
  composing=true;
  macro.startComposition();
  macro.text(()=>input('비공개 😀 새 ㄱ원문'));
  composing=false;
  input('비공개 😀 새 검수원문');
  macro.endComposition();
  macro.dispatch('format:align-right',()=>{revision++;alignment='right';return {ok:true};});
  const record=macro.stop('본문 편집');
  assert.equal(invalid,'');
  assert.deepEqual(record.steps.map(step=>step.commandId),['edit:body-text','edit:body-text','format:align-right']);
  assert.equal(record.steps[0].arguments.start,6);
  assert.doesNotMatch(serializeScriptMacroB142(record),/비공개/);
  const base:Snapshot={revision:String(revision),name:'original.hwpx',limitations:[],nodes:[
    {id:'s0p0',section:0,paragraph:0,text:original,editable:true},
  ],structure:{sections:[],tables:[],unsupportedControls:[],paragraphs:[]}};
  assert.deepEqual(macro.prepare(record,base).operations,[
    {kind:'replace_body_text',target:'s0p0',start:6,count:0,text:'새 검수'},
    {kind:'format_paragraph',target:'s0p0',properties:{alignment:'right'}},
  ]);
  assert.throws(()=>macro.prepare(record,{...base,nodes:[{...base.nodes[0],text:'다른 문단'}]}),/문단 내용/);
  macro.start();
  macro.text(()=>{input(text+'\n다른 문단');});
  assert.equal(macro.recording,false);
  assert.match(invalid,/기록한 본문 편집/);
});
