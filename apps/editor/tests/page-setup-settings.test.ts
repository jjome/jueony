import test from 'node:test';
import assert from 'node:assert/strict';
import {pageDimensionFromInput,validatePageSetup,samePageSetup} from '../src/modules/document/public/index.ts';
import {collectPageSetup,planPageSetupEdits,executePageSetupEdits} from '../src/adapters/rhwp/page-setup-settings.ts';
const settings=()=>({width:59529,height:84189,marginLeft:8505,marginRight:8506,marginTop:5670,marginBottom:4253,marginHeader:2836,marginFooter:2835,marginGutter:1,landscape:false,binding:0});
test('unchanged one-decimal mm retains exact original dimensions; blank/invalid inputs fail',()=>{
 assert.equal(pageDimensionFromInput(59529,'210.0'),59529);assert.equal(pageDimensionFromInput(1,'0.0'),1);assert.equal(pageDimensionFromInput(8505,'31'),Math.round(31*7200/25.4));for(const text of ['', 'NaN','-1','2001'])assert.throws(()=>pageDimensionFromInput(1,text));
});
test('page setup collection preserves unmodified raw fields and applies exact preset dimensions',()=>{
 const base=settings(),dialog:any={pageDef:base,landscapeRadios:[{checked:true},{checked:false}],bindingRadios:[{checked:true,value:'0'}],paperSelect:{value:'A4'},widthInput:{value:'210.0'},heightInput:{value:'297.0'},marginInputs:Object.fromEntries(Object.entries(base).filter(([key])=>key.startsWith('margin')).map(([key,value])=>[key,{value:(Math.round(Number(value)*25.4/7200*10)/10).toFixed(1)}]))};assert.equal(samePageSetup(collectPageSetup(dialog),base),true);
 dialog.jueonyPaperChanged=true;assert.equal(collectPageSetup(dialog).width,59528);dialog.landscapeRadios[1].checked=true;dialog.widthInput.value='297.0';dialog.heightInput.value='210.0';assert.equal(collectPageSetup(dialog).width,59528);assert.equal(collectPageSetup(dialog).landscape,true);
});
test('whole-document setup plans only changed sections and checks all baselines before writing',()=>{
 const rows=[settings(),{...settings(),marginLeft:5000}],calls:number[]=[],wasm={getSectionCount:()=>2,getPageDef:(s:number)=>JSON.stringify(rows[s]),setPageDef:(s:number,json:string)=>{calls.push(s);rows[s]=JSON.parse(json);return '{"ok":true}';}};
 const next=settings(),edits=planPageSetupEdits(wasm,0,next,'all');assert.equal(edits.length,1);executePageSetupEdits(wasm,edits);assert.deepEqual(calls,[1]);assert.deepEqual(planPageSetupEdits(wasm,0,next,'all'),[]);
 const pending=planPageSetupEdits(wasm,0,{...next,marginTop:8000},'all');rows[1].marginLeft=100;assert.throws(()=>executePageSetupEdits(wasm,pending),/바뀌었습니다/);assert.deepEqual(calls,[1]);for(const scope of ['bad','new-section'])assert.throws(()=>planPageSetupEdits(wasm,0,next,scope));
});
test('page setup rejects invalid orientation, dimensions and binding before planning',()=>{
 for(const patch of [{width:0},{height:1.5},{marginLeft:-1},{landscape:'yes'},{binding:3}])assert.throws(()=>validatePageSetup({...settings(),...patch} as any));
});
