import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberSavedFormat,readSavedFormat} from '../src/adapters/files/saved-format.ts';

test('only an acknowledged connection establishes the subsequent save format; names never infer it',()=>{
 const original={name:'original.hwp'},converted={name:'converted.hwpx'};
 assert.equal(readSavedFormat(original),undefined);assert.equal(readSavedFormat(converted),undefined);
 rememberSavedFormat(converted,'hwpx');assert.equal(readSavedFormat(converted),'hwpx');
 assert.equal(readSavedFormat(original),undefined);
 converted.name='renamed.hwp';assert.equal(readSavedFormat(converted),'hwpx');
 rememberSavedFormat(original,'hwp');assert.equal(readSavedFormat(original),'hwp');assert.equal(readSavedFormat(converted),'hwpx');
 rememberSavedFormat(converted,'hwp');assert.equal(readSavedFormat(converted),'hwp');
});

test('missing handles and unsupported output do not inherit another connection format',()=>{
 const handle={};rememberSavedFormat(null,'hwpx');assert.equal(readSavedFormat(null),undefined);
 rememberSavedFormat(handle,'hwpx');rememberSavedFormat(handle,'hml');assert.equal(readSavedFormat(handle),undefined);
 assert.equal(readSavedFormat({}),undefined);
});
