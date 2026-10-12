import test from 'node:test';
import assert from 'node:assert/strict';
import {documentTabCycleTarget} from '../src/modules/session/public/index.ts';
import {documentTabKeyDirection,installDocumentTabCycle} from '../src/adapters/browser/document-tab-cycle.ts';

const tabs=[{id:'a',workspaceId:'one',closed:false},{id:'foreign',workspaceId:'two',closed:false},{id:'b',workspaceId:'one',closed:false},{id:'closed',workspaceId:'one',closed:true},{id:'c',workspaceId:'one',closed:false}];
test('document tab cycle respects displayed order, wraps both directions and excludes other workspaces/closed tabs',()=>{
 assert.equal(documentTabCycleTarget(tabs,'one','a',1),'b');assert.equal(documentTabCycleTarget(tabs,'one','a',-1),'c');
 assert.equal(documentTabCycleTarget(tabs,'one','c',1),'a');assert.equal(documentTabCycleTarget(tabs,'one','b',-1),'a');
 assert.equal(documentTabCycleTarget(tabs,'two','foreign',1),undefined);assert.equal(documentTabCycleTarget(tabs,'one','foreign',1),undefined);
 assert.equal(documentTabCycleTarget([...tabs,{...tabs[0]}],'one','a',1),undefined);
 assert.equal(documentTabCycleTarget([...tabs,{id:'b',workspaceId:'two',closed:false}],'one','a',1),undefined);
});
const key=(override:any={})=>({key:'Tab',code:'Tab',ctrlKey:true,shiftKey:false,altKey:false,metaKey:false,isComposing:false,keyCode:9,repeat:false,isTrusted:true,defaultPrevented:false,...override});
test('only trusted Ctrl+Tab/Shift+Ctrl+Tab without IME or extra modifiers are document cycle keys',()=>{
 assert.equal(documentTabKeyDirection(key()),1);assert.equal(documentTabKeyDirection(key({shiftKey:true})),-1);
 assert.equal(documentTabKeyDirection(key({repeat:true})),1);
 for(const override of [{isTrusted:false},{isComposing:true},{keyCode:229},{altKey:true},{metaKey:true},{ctrlKey:false},{defaultPrevented:true},{key:'x',code:'KeyX'}])assert.equal(documentTabKeyDirection(key(override)),undefined);
});
function fixture(){
 let listener:any,removed=false,active='a',workspace='one',blocked=false,modal=false,focused:string[]=[],activations:string[]=[],prevented=0,stopped=0;
 let cursor:any={kind:'text',focus:{kind:'body'}};
 const doc:any={querySelector:()=>modal?{}:null},target:any={ownerDocument:doc,getAttribute:()=> '문서 편집 입력'};
 const options:any={source:{addEventListener:(_n:any,value:any)=>{listener=value;},removeEventListener:(_n:any,value:any)=>{removed=value===listener;}},sourceDocument:doc,sourceId:'a',sourceWorkspaceId:'one',
  tabs:()=>tabs,activeId:()=>active,workspaceId:()=>workspace,captureView:()=>({cursor}),blocked:()=>blocked,activate:(id:string)=>{activations.push(id);active=id;},focus:(id:string)=>{focused.push(id);}};
 const dispose=installDocumentTabCycle(options);
 return {options,dispose,emit:(override:any={})=>listener({...key(),target,preventDefault:()=>{prevented++;},stopImmediatePropagation:()=>{stopped++;},...override}),
  cursor:(value:any)=>{cursor=value;},blocked:(value:boolean)=>{blocked=value;},modal:(value:boolean)=>{modal=value;},active:(value:string)=>{active=value;},workspace:(value:string)=>{workspace=value;},
  target,doc,focused,activations,removed:()=>removed,prevented:()=>prevented,stopped:()=>stopped};
}
test('trusted body shortcut activates/focuses only its chosen sameworkspace tab and disposes its listener',()=>{
 const f=fixture();f.emit();assert.deepEqual(f.activations,['b']);assert.deepEqual(f.focused,['b']);assert.equal(f.prevented(),1);assert.equal(f.stopped(),1);
 f.dispose();assert.equal(f.removed(),true);
 const backwards=fixture();backwards.emit({shiftKey:true});assert.deepEqual(backwards.focused,['c']);
});
test('table, object, special-area, missing bookmark, modal, host input, stale source and IME keys never navigate or steal focus',()=>{
 for(const cursor of [undefined,{kind:'text',focus:{kind:'cell'}},{kind:'cells'},{kind:'picture-object'},{kind:'table-object'},{kind:'header-footer'},{kind:'footnote'}]){
  const f=fixture();f.cursor(cursor);f.emit();assert.equal(f.prevented(),0);assert.deepEqual(f.activations,[]);assert.deepEqual(f.focused,[]);
 }
 for(const configure of [(f:any)=>f.blocked(true),(f:any)=>f.modal(true),(f:any)=>f.active('b'),(f:any)=>f.workspace('two'),(f:any)=>{f.target.getAttribute=()=> '검색';},(f:any)=>{f.target.ownerDocument={};}]){
  const f=fixture();configure(f);f.emit();assert.equal(f.prevented(),0);assert.deepEqual(f.focused,[]);
 }
 const ime=fixture();ime.emit({isComposing:true});ime.emit({isTrusted:false});assert.deepEqual(ime.activations,[]);
});
test('failed or superseded activation cannot focus a stale target',()=>{
 const f=fixture();f.options.activate=()=>{};f.emit();assert.deepEqual(f.focused,[]);
 const changed=fixture();changed.options.activate=()=>changed.workspace('two');changed.emit();assert.deepEqual(changed.focused,[]);
});

test('generated table Ctrl+Tab mapping keeps literal insertion separate from hanging indent and rejects double patching',async()=>{
 const {mkdtemp,mkdir,readFile,writeFile,rm}=await import('node:fs/promises'),{join,resolve,sep}=await import('node:path'),{pathToFileURL,fileURLToPath}=await import('node:url');
 const {applyDocumentTabCyclePatches}=await import('../scripts/integration/document-tab-cycle-patches.mjs');
 const base=resolve(fileURLToPath(new URL('../evidence/session-unit-temp/',import.meta.url)));await mkdir(base,{recursive:true});
 const tempBase=resolve(base),root=await mkdtemp(join(tempBase,'jueony-document-tabs-'));
 try{
  const folder=join(root,'src/jueony/shortcuts');await mkdir(folder,{recursive:true});await writeFile(join(root,'package.json'),' {"type":"module"}');
  for(const name of ['keymap.ts','install.ts','style-slots.ts'])await writeFile(join(folder,name),await readFile(new URL('../src/shortcuts/'+name,import.meta.url)));
  await applyDocumentTabCyclePatches({root});
  const {HangulKeyResolver}=await import(pathToFileURL(join(folder,'keymap.ts')).href),r=new HangulKeyResolver();
  assert.equal(r.resolve(key(),{table:true,cells:false,object:false}).binding?.command,'ext:jueony-literal-table-tab');
  assert.equal(r.resolve(key({repeat:true}),{table:true,cells:false,object:false}).binding?.command,'ext:jueony-literal-table-tab');
  assert.equal(r.resolve(key({shiftKey:true}),{table:true,cells:false,object:false}).binding?.command,'ext:jueony-hanging-indent');
  await assert.rejects(applyDocumentTabCyclePatches({root}),/already applied/);
 }finally{
  const absolute=resolve(root);if(!absolute.startsWith(tempBase+sep)||absolute===tempBase)throw new Error('Refusing cleanup outside isolated test directory');
  await rm(absolute,{recursive:true,force:true});
 }
});
