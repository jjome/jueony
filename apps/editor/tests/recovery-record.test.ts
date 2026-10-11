import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRecoveryRecord} from '../src/mvp/recovery-record.ts';
const valid=()=>({id:'doc',workspaceId:'w',name:'한글.hwp',bytes:new Uint8Array([1]),dirty:true,updatedAt:1});
test('legacy recovery metadata remains valid without optional connection fields',()=>assert.doesNotThrow(()=>assertRecoveryRecord(valid(),'w')));
test('invalid recovery metadata cannot pollute the workspace tab list',()=>{
 for(const value of [null,{...valid(),id:''},{...valid(),workspaceId:'other'},{...valid(),bytes:[]},{...valid(),bytes:new Uint8Array()},{...valid(),dirty:'false'},{...valid(),name:''},{...valid(),updatedAt:NaN}])assert.throws(()=>assertRecoveryRecord(value,'w'));
});
