import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultLineNumberSettings,validateLineNumberSettings,sameLineNumberSettings} from '../src/modules/document/public/index.ts';
import {planLineNumberEdits,executeLineNumberEdits} from '../src/adapters/rhwp/line-numbers.ts';
test('line number settings validate integer restart/start/interval/distance and strip extra input',()=>{
 assert.deepEqual(validateLineNumberSettings({...defaultLineNumberSettings(),unexpected:1} as any),defaultLineNumberSettings());
 for(const value of [{restartType:0},{countBy:0},{startNumber:65536},{distance:-1},{distance:14174},{enabled:1},{countBy:1.5}])assert.throws(()=>validateLineNumberSettings({...defaultLineNumberSettings(),...value} as any));
});
test('line number plans isolate scopes, reject unsupported sections and validate every baseline before writing',()=>{
 const rows=[0,1,2].map(()=>({...defaultLineNumberSettings(),editable:true,ok:true})),writes:number[]=[],d={getSectionCount:()=>3,getLineNumberSettings:(s:number)=>JSON.stringify(rows[s]),setLineNumberSettings:(s:number,j:string)=>{writes.push(s);Object.assign(rows[s],JSON.parse(j));return '{"ok":true}';}};
 const next={...defaultLineNumberSettings(),enabled:true};const edits=planLineNumberEdits(d,1,next,'from-current');executeLineNumberEdits(d,edits);assert.deepEqual(writes,[1,2]);assert.equal(rows[0].enabled,false);assert.equal(planLineNumberEdits(d,1,next,'from-current').length,0);
 const pending=planLineNumberEdits(d,0,next,'document');rows[0].startNumber=5;assert.throws(()=>executeLineNumberEdits(d,pending),/바뀌/);assert.deepEqual(writes,[1,2]);rows[0].editable=false;assert.throws(()=>planLineNumberEdits(d,0,next,'document'),/지원하지/);
 assert.throws(()=>planLineNumberEdits({...d,fileName:'original.hwp'},0,next,'current'),/HWPX/);
 assert.equal(sameLineNumberSettings(next,{...next,startNumber:2}),false);
});
