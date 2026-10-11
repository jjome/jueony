import test from 'node:test';
import assert from 'node:assert/strict';
import {orderRecoveredDocuments} from '../src/mvp/document-order.ts';
test('restore uses saved tab order, includes orphan records and ignores removed IDs',()=>{
 const docs=[{id:'a',name:'third'},{id:'b',name:'second'},{id:'c',name:'first'},{id:'d',name:'recovery'}];
 assert.deepEqual(orderRecoveredDocuments(docs,['c','missing','b','c','a']).map(d=>d.id),['c','b','a','d']);
 assert.deepEqual(docs.map(d=>d.id),['a','b','c','d']);
});
test('old profiles without tab order retain every record in the original order',()=>{
 assert.deepEqual(orderRecoveredDocuments([{id:'z'},{id:'a'}]),[{id:'z'},{id:'a'}]);
});
