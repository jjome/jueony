import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleBodyBlockSelectionB170} from '../src/shortcuts/body-block-selection-b170.ts';

type Pos = {sectionIndex:number;paragraphIndex:number;charOffset:number};
const clone = <T>(value:T):T => structuredClone(value);

function harness() {
  let phase:number|null=null;
  let position:Pos={sectionIndex:0,paragraphIndex:1,charOffset:3};
  let anchor:Pos|null=null;
  let updates=0, focuses=0, prevented=0, expands=0;
  const lengths=[[5,10],[4,7]];
  const cursor:any={
    blockSelectionPhase:()=>phase,
    getPosition:()=>clone(position),
    getSelection:()=>anchor?{anchor:clone(anchor),focus:clone(position)}:null,
    enterBlockSelectionMode(){phase=0;anchor=clone(position);},
    exitBlockSelectionMode(){phase=null;anchor=null;},
    expandSelection(){
      expands++;
      phase=(phase??0)+1;
      if(phase===1){anchor={sectionIndex:0,paragraphIndex:1,charOffset:1};position={sectionIndex:0,paragraphIndex:1,charOffset:6};}
      else if(phase===2){anchor={sectionIndex:0,paragraphIndex:1,charOffset:0};position={sectionIndex:0,paragraphIndex:1,charOffset:8};}
      else if(phase===3){anchor={sectionIndex:0,paragraphIndex:1,charOffset:0};position={sectionIndex:0,paragraphIndex:1,charOffset:10};}
      else if(phase===4){anchor={sectionIndex:0,paragraphIndex:0,charOffset:0};position={sectionIndex:0,paragraphIndex:1,charOffset:10};}
      else {phase=5;anchor={sectionIndex:0,paragraphIndex:0,charOffset:0};position={sectionIndex:1,paragraphIndex:1,charOffset:7};}
    },
    selectRange(start:Pos,end:Pos,nextPhase:number){anchor=clone(start);position=clone(end);phase=nextPhase;return true;},
    moveTo(next:Pos){position=clone(next);},
    isInHeaderFooter:()=>false,isInFootnote:()=>false,isInTextBox:()=>false,
  };
  const input:any={
    cursor,isComposing:false,isFormMode:()=>false,
    getPosition:()=>clone(position),getCursorPosition:()=>clone(position),
    wasm:{
      getSectionCount:()=>2,
      getParagraphCount:(section:number)=>lengths[section].length,
      getParagraphLength:(section:number,paragraph:number)=>lengths[section][paragraph],
    },
    updateSelection:()=>updates++,focus:()=>focuses++,
  };
  const event=(extra:Record<string,unknown>={})=>({key:'F3',ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,repeat:false,isComposing:false,preventDefault:()=>prevented++,...extra});
  return {input,cursor,event,get phase(){return phase;},get position(){return position;},get anchor(){return anchor;},get updates(){return updates;},get focuses(){return focuses;},get prevented(){return prevented;},get expands(){return expands;},setPhase(value:number|null){phase=value;},setSelection(a:Pos|null,p:Pos){anchor=a?clone(a):null;position=clone(p);}};
}

test('four F3 presses map to mode, word, paragraph and document without publishing internal phases',()=>{
  const h=harness();
  for(const expected of [0,1,3,5]){assert.equal(handleBodyBlockSelectionB170(h.input,h.event()),true);assert.equal(h.phase,expected);}
  assert.equal(h.expands,5);
  assert.deepEqual(h.anchor,{sectionIndex:0,paragraphIndex:0,charOffset:0});
  assert.deepEqual(h.position,{sectionIndex:1,paragraphIndex:1,charOffset:7});
  assert.equal(h.updates,4);assert.equal(h.focuses,4);assert.equal(h.prevented,4);
});

test('document stage is idempotent and repeat/composition do not skip a stage',()=>{
  const h=harness();
  assert.equal(handleBodyBlockSelectionB170(h.input,h.event({repeat:true})),true);
  assert.equal(handleBodyBlockSelectionB170(h.input,h.event({isComposing:true})),true);
  assert.equal(h.phase,null);assert.equal(h.expands,0);
  for(let i=0;i<4;i++)handleBodyBlockSelectionB170(h.input,h.event());
  assert.equal(handleBodyBlockSelectionB170(h.input,h.event()),true);
  assert.equal(h.phase,5);assert.equal(h.expands,5);
});

test('modifier and non-F3 events are not stolen',()=>{
  for(const extra of [{key:'F4'},{ctrlKey:true},{altKey:true},{shiftKey:true},{metaKey:true}]){
    const h=harness();assert.equal(handleBodyBlockSelectionB170(h.input,h.event(extra)),false);assert.equal(h.prevented,0);
  }
});

test('table, text box and inexact story contexts are left to their owners',()=>{
  const h=harness();
  h.input.getCursorPosition=()=>({...h.position,parentParaIndex:0,cellPath:[0]});
  assert.equal(handleBodyBlockSelectionB170(h.input,h.event()),false);
  h.input.getCursorPosition=()=>clone(h.position);h.cursor.isInTextBox=()=>true;
  assert.equal(handleBodyBlockSelectionB170(h.input,h.event()),false);
});

test('an internal expansion failure restores the exact prior selection and phase',()=>{
  const h=harness();
  h.setPhase(1);h.setSelection({sectionIndex:0,paragraphIndex:1,charOffset:1},{sectionIndex:0,paragraphIndex:1,charOffset:6});
  let calls=0;h.cursor.expandSelection=()=>{calls++;if(calls===2)throw new Error('fault');h.setPhase(2);};
  assert.throws(()=>handleBodyBlockSelectionB170(h.input,h.event()),/fault/);
  assert.equal(h.phase,1);assert.deepEqual(h.anchor,{sectionIndex:0,paragraphIndex:1,charOffset:1});
  assert.deepEqual(h.position,{sectionIndex:0,paragraphIndex:1,charOffset:6});assert.equal(h.updates,0);
});

test('a malformed post-state is rolled back instead of reported as success',()=>{
  const h=harness();
  h.cursor.expandSelection=()=>{h.setPhase(1);h.setSelection({sectionIndex:0,paragraphIndex:0,charOffset:0},{sectionIndex:1,paragraphIndex:1,charOffset:7});};
  handleBodyBlockSelectionB170(h.input,h.event());
  assert.throws(()=>handleBodyBlockSelectionB170(h.input,h.event()),/단어 선택/);
  assert.equal(h.phase,0);assert.deepEqual(h.anchor,h.position);
});

test('unexpected legacy internal phases are consumed without mutation',()=>{
  for(const stale of [2,4]){const h=harness();h.setPhase(stale);h.setSelection({sectionIndex:0,paragraphIndex:1,charOffset:0},{sectionIndex:0,paragraphIndex:1,charOffset:8});assert.equal(handleBodyBlockSelectionB170(h.input,h.event()),true);assert.equal(h.phase,stale);assert.equal(h.expands,0);}
});

test('pinned upstream exposes the exact cursor methods and five internal phases guarded by this seam',()=>{
  const source=readFileSync(new URL('../../../upstream/rhwp-source/rhwp-studio/src/engine/cursor.ts',import.meta.url),'utf8');
  for(const method of ['blockSelectionPhase','getPosition','getSelection','enterBlockSelectionMode','exitBlockSelectionMode','expandSelection','selectRange','moveTo'])assert.match(source,new RegExp(`\\b${method}\\(`),method);
  assert.match(source,/_expandPhase === 1/);assert.match(source,/_expandPhase === 2/);assert.match(source,/_expandPhase === 3/);assert.match(source,/_expandPhase === 4/);assert.match(source,/_expandPhase = 5/);
});
