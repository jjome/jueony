import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEditOperations,describeStructure} from '../src/modules/document/public/index.ts';
import type {Snapshot,AgentPageBackgroundOp} from '../src/modules/document/public/index.ts';
import {generationSchema} from '../src/modules/document/public/wire-schema.mjs';
import {executeAgentPageBackground} from '../src/adapters/rhwp/agent-page-background.ts';
const op=():AgentPageBackgroundOp=>({kind:'set_page_background',section:0,pageKind:'both',fillType:'solid',color:'#fff2cc'});
const base=():Snapshot=>({revision:'r',name:'background.hwp',limitations:[],nodes:[],structure:{sections:[{index:0,page:{},pageBackgrounds:['both','even','odd'].map(kind=>({kind:kind as 'both'|'even'|'odd',fillType:'none',color:null,applyPage:'all',editable:true}))}],paragraphs:[],tables:[],unsupportedControls:[]}});
test('background wire has explicit scope, gradient fields and required color across provider schemas',()=>{
 const schema=generationSchema().properties.operations.items.anyOf.find(v=>v.properties.kind.enum[0]==='set_page_background')!;
 assert.deepEqual(schema.required,['kind','section','pageKind','fillType','color']);assert.deepEqual(schema.properties.pageKind.enum,['both','even','odd']);assert.deepEqual(schema.properties.fillType.enum,['none','solid','gradient']);
 assert.equal(schema.properties.angle.maximum,360);
});
test('valid HWP and HWPX background batches keep input snapshots detached and unchanged',()=>{for(const name of ['background.hwp','background.hwpx']){const snapshot=base();snapshot.name=name;const before=structuredClone(snapshot),operations=[op(),{...op(),pageKind:'odd',fillType:'none'}];assert.deepEqual(validateEditOperations(operations,snapshot),operations);assert.deepEqual(snapshot,before);}});
test('unknown native engine capability remains unavailable instead of silently succeeding',()=>{const s=base();delete s.structure!.sections[0].pageBackgrounds;assert.throws(()=>validateEditOperations([op()],s),/조회/);assert.throws(()=>executeAgentPageBackground({},op()),/엔진/);});
test('read-only source blocks clearing as well as color changes before executing any command',()=>{const s=base();s.structure!.sections[0].pageBackgrounds![0].editable=false;for(const fillType of ['none','solid'])assert.throws(()=>validateEditOperations([{...op(),fillType}],s),/읽기 전용/);});
test('background validates section, scope, type, mandatory hex color and unknown fields',()=>{for(const change of [{section:1},{section:-1},{section:0.5},{pageKind:'current'},{fillType:'image'},{color:'red'},{color:'#fff'},{color:'#ffffff00'},{color:undefined},{color:'url(secret)'},{color:123},{token:'from-model'}])assert.throws(()=>validateEditOperations([{...op(),...change}],base()));});
test('parity-specific permission is independent from a blocked both source',()=>{const s=base();s.structure!.sections[0].pageBackgrounds![0].editable=false;assert.deepEqual(validateEditOperations([{...op(),pageKind:'even'}],s),[{...op(),pageKind:'even'}]);});
test('adapter rejects a newly unsupported source without calling native setter',()=>{let writes=0;const doc={getAgentPageBackground:()=>({editable:false,reason:'투명도 보존'}),setAgentPageBackground:()=>writes++};assert.throws(()=>executeAgentPageBackground(doc,op()),/투명도/);assert.equal(writes,0);});
test('native source token stays inside adapter and every both result is verified',()=>{let actual:any={fillType:'none',color:null},payload:any;const doc={getAgentPageBackground:(_s:number,kind:string)=>({kind,editable:true,token:'native-token',...actual}),setAgentPageBackground:(_s:number,_k:string,text:string)=>{payload=JSON.parse(text);actual={fillType:payload.fillType,color:payload.color.toUpperCase()};}};executeAgentPageBackground(doc,op());assert.deepEqual(payload,{fillType:'solid',color:'#fff2cc',token:'native-token'});doc.getAgentPageBackground=(_s,kind)=>({kind,editable:true,token:'native-token',...actual,color:kind==='odd'?'#000000':actual.color});assert.throws(()=>executeAgentPageBackground(doc,op()),/적용 결과/);});
test('background-only diff includes parity, original visibility and read-only reason',()=>{const s=base();s.structure!.sections[0].pageBackgrounds![1]={kind:'even',fillType:'image',color:null,applyPage:'firstOnly',editable:false,reason:'그림 보존'};const result=describeStructure(s.structure);assert.match(result,/쪽 배경/);assert.match(result,/firstOnly/);assert.match(result,/그림 보존/);});

test('a linear gradient requires separately verified native scope, two distinct colors and a whole angle',()=>{
 const snapshot=base();
 const gradient={...op(),fillType:'gradient',endColor:'#334455',angle:45};
 assert.throws(()=>validateEditOperations([gradient],snapshot),/읽기 전용/);
 const row=snapshot.structure!.sections[0].pageBackgrounds![0];
 row.gradientEditable=true;
 assert.deepEqual(validateEditOperations([gradient],snapshot),[gradient]);
 for(const invalid of [{endColor:'#FFF2CC'},{endColor:'#123'},{endColor:undefined},{angle:15.5},{angle:361},{angle:-1},{positions:[0,50,100]}]){
  assert.throws(()=>validateEditOperations([{...gradient,...invalid}],snapshot));
 }
 row.editable=false;
 assert.deepEqual(validateEditOperations([gradient],snapshot),[gradient]);
 assert.throws(()=>validateEditOperations([op()],snapshot),/읽기 전용/);
});

test('a both-pages gradient verifies every native parity result',()=>{
 const gradient:AgentPageBackgroundOp={...op(),fillType:'gradient',endColor:'#334455',angle:45};
 let payload:Record<string,unknown>|undefined;
 let invalidOdd=false;
 const doc={
  getAgentPageBackground:(_section:number,kind:string)=>({kind,editable:false,gradientEditable:true,gradientToken:'native-gradient',
   fillType:payload?'gradient':'none',gradient:{type:1,angle:kind==='odd'&&invalidOdd?46:45,colors:['#FFF2CC','#334455']}}),
  setAgentPageBackground:(_section:number,_kind:string,text:string)=>{payload=JSON.parse(text);},
 };
 executeAgentPageBackground(doc,gradient);
 assert.deepEqual(payload,{fillType:'gradient',color:'#fff2cc',endColor:'#334455',angle:45,token:'native-gradient'});
 invalidOdd=true;
 assert.throws(()=>executeAgentPageBackground(doc,gradient),/적용 결과/);
});
