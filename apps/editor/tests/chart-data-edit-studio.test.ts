import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import init,{HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {createChartDataEditStudioController} from '../src/adapters/rhwp/chart-data-edit-studio.ts';
import {readChartDataSource} from '../src/adapters/rhwp/chart-data-edit.ts';
import {patchChartDataEditUiSource} from '../scripts/integration/chart-data-edit-ui-patches.mjs';

await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
const samples={hwp:new URL('../../../upstream/rhwp-source/samples/chart/가로막대형/묶은가로막대형.hwp',import.meta.url),hwpx:new URL('../../../upstream/rhwp-source/samples/chart/가로막대형/묶은가로막대형.hwpx',import.meta.url)};
function fixture(document:any,format:'hwp'|'hwpx'){
 let sequence=0,busy=false,locked=false,renders=0,identity=`7:chart.${format}`;const wasm:any={documentGeneration:7,fileName:`chart.${format}`,requiresPasswordForSave:false,document,borrowDocumentHandle(){return this.document;}};
 const api=()=>({revision:()=>`7:${sequence}`,documentIdentity:()=>identity,busy:()=>busy,hostMutationLocked:()=>locked});
 const controller=createChartDataEditStudioController({wasm,api,input:()=>({wasm,active:true,isFormMode:()=>false}),eventBus:{emit(type){if(type==='document-mutated')sequence++;}},render:async()=>{renders++;}});
 return{wasm,api,controller,sequence:()=>sequence,renders:()=>renders,setBusy:(value:boolean)=>busy=value,setLocked:(value:boolean)=>locked=value,setIdentity:(value:string)=>identity=value};
}

for(const format of ['hwp','hwpx'] as const)test(`Studio command path applies value, series name and category label then reopens ${format.toUpperCase()}`,async()=>{
 const doc:any=new HwpDocument(await readFile(samples[format]));try{const f=fixture(doc,format);
  let target=f.controller.capture(0);let receipt=await f.controller.apply(target,{kind:'value',series:0,point:0,original:'4.3',value:'9.9'});assert.equal(receipt.beforeRevision,'7:0');assert.equal(receipt.afterRevision,'7:1');
  target=f.controller.capture(0);receipt=await f.controller.apply(target,{kind:'series-name',series:0,original:'계열 1',value:'첫 계열'});assert.equal(receipt.afterRevision,'7:2');
  target=f.controller.capture(0);receipt=await f.controller.apply(target,{kind:'category-label',point:0,original:'항목 1',value:'첫 항목'});assert.equal(receipt.afterRevision,'7:3');assert.equal(f.renders(),3);
  const saved=doc[format==='hwp'?'exportHwp':'exportHwpx'](),reopened:any=new HwpDocument(saved);try{const state=readChartDataSource(reopened,0,'reopened:1');assert.equal(state.series[0].values[0],'9.9');assert.equal(state.series[0].name,'첫 계열');assert.equal(state.labels[0],'첫 항목');assert.equal(state.plot,'bar');assert.equal(state.axis,'category');}finally{reopened.free();}
 }finally{doc.free();}
});

test('Studio target seals revision, owner document and source before mutation',async()=>{
 const doc:any=new HwpDocument(await readFile(samples.hwpx)),replacement:any=new HwpDocument(await readFile(samples.hwpx));try{const f=fixture(doc,'hwpx'),target=f.controller.capture(0),before=doc.exportHwpx();
  f.setIdentity('replacement');await assert.rejects(f.controller.apply(target,{kind:'value',series:0,point:0,original:'4.3',value:'9.9'}),/소유권|버전/);assert.deepEqual(doc.exportHwpx(),before);f.setIdentity('7:chart.hwpx');
  f.wasm.document=replacement;await assert.rejects(f.controller.apply(target,{kind:'value',series:0,point:0,original:'4.3',value:'9.9'}),/소유권|버전/);assert.deepEqual(doc.exportHwpx(),before);assert.deepEqual(replacement.exportHwpx(),before);
 }finally{doc.free();replacement.free();}
});

test('Studio command keeps engine rollback when post-mutation result is malformed',async()=>{
 const doc:any=new HwpDocument(await readFile(samples.hwp));try{const before=doc.exportHwp(),proxy=new Proxy(doc,{get(target,key){if(key==='setChartDataByIndex')return(index:number,payload:string)=>{const result=JSON.parse(target.setChartDataByIndex(index,payload));if(JSON.parse(payload).dryRun)return JSON.stringify(result);return JSON.stringify({...result,ok:false});};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}}),f=fixture(proxy,'hwp'),target=f.controller.capture(0);
  await assert.rejects(f.controller.apply(target,{kind:'category-label',point:0,original:'항목 1',value:'첫 항목'}),/실패/);assert.deepEqual(doc.exportHwp(),before);assert.equal(f.sequence(),0);assert.equal(f.renders(),0);
 }finally{doc.free();}
});

test('Studio chart UI patch installs one real command surface and fails closed on drift or a second application',async()=>{
 const seam=`void initPromise.then(() => { installHangulKeys({ automation, registry, input: () => inputHandler, eventBus }); installPageControls(registry, () => inputHandler); installDocumentInformation({registry, input: () => inputHandler}); installHangulChrome({ wasm, eventBus, documentState, automation }); });`,source=`import './base.ts';\n${seam}\n`,patched=patchChartDataEditUiSource(source);
 assert.match(patched,/installChartDataEditStudio/);assert.match(patched,/refreshDocumentAgentMutation/);assert.throws(()=>patchChartDataEditUiSource(patched),/already applied/);assert.throws(()=>patchChartDataEditUiSource(source.replace('installPageControls','changedPageControls')),/drift/);
 const integration=await readFile(new URL('../scripts/integration/studio-patches.mjs',import.meta.url),'utf8');assert.match(integration,/applyChartDataEditUiPatches/);
});
