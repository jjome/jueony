import {test} from 'node:test';
import assert from 'node:assert/strict';
import {partitionRecoveryRecords} from '../src/modules/document-files/public/index.ts';
test('one malformed draft is isolated while valid drafts and original records remain intact',()=>{
 const valid={id:'a',workspaceId:'w',bytes:new Uint8Array([1]),name:'draft.hwp',dirty:true,updatedAt:1};
 const corrupt={...valid,id:''},foreign={...valid,id:'b',workspaceId:'other'},records=[corrupt,valid,foreign];
 const selected=partitionRecoveryRecords(records,'w');
 assert.deepEqual(selected.valid,[valid]);assert.equal(selected.valid[0],valid);assert.equal(selected.errors.length,2);
 assert.deepEqual(records,[corrupt,valid,foreign]);
});
