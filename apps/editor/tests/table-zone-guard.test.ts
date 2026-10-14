import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNativeTableNoCellZones} from '../src/adapters/rhwp/table-write-guard.ts';
import {tableAxisPlan} from '../src/modules/document/public/engine-integration.ts';
const target:any={id:'s0p0t0',section:0,paragraph:0,control:0};
test('topology requires an independently queried exact zero cell-zone count',()=>{
 for(const value of [undefined,null,false,'0',1,-1,NaN])assert.throws(()=>assertNativeTableNoCellZones({getTableProperties:()=>({cellZoneCount:value})},target),/영역|상태/);
 assert.doesNotThrow(()=>assertNativeTableNoCellZones({getTableProperties:()=>'{"cellZoneCount":0}'},target));
});
test('missing or failed Native zone reader never certifies an editable source',()=>{
 assert.throws(()=>assertNativeTableNoCellZones({},target));
 assert.throws(()=>assertNativeTableNoCellZones({getTableProperties:()=>{throw new Error('reader failed');}},target));
});
test('detached axis context with a known zone cannot bypass topology safety',()=>{
 for(const kind of ['insert_table_row','insert_table_column','delete_table_row','delete_table_column'])assert.throws(()=>tableAxisPlan({...target,cellZoneCount:1},{kind,target:target.id,index:0,values:[]} as any),/셀 합성/);
});
