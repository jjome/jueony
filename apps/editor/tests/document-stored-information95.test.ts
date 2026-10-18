import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStoredDocumentInformation,readStoredDocumentInformation,storedInformationForPreservation} from '../src/adapters/rhwp/document-stored-information.ts';
const empty=()=>({schemaVersion:1,sourceFormat:'hwp',created:{state:'absent'},modified:{state:'absent'},lastPrinted:{state:'absent'},editingDuration:{state:'absent'},issues:[]});
test('exact 100ns decimal ticks survive above JS integer precision and all seven UTC digits',()=>{
 const value={...empty(),created:{state:'value',fileTime100ns:'132274943991234567',utc:'2020-02-29T23:59:59.1234567Z'},editingDuration:{state:'value',ticks100ns:'18446744073709551615'}};
 assert.deepEqual(validateStoredDocumentInformation(value),value);assert.deepEqual(storedInformationForPreservation(value),storedInformationForPreservation({...value,sourceFormat:'hwpx'}));
});
test('1601 epoch is a value rather than absent; unrelated factory timestamps cannot stand in for missing values',()=>{
 const value={...empty(),created:{state:'value',fileTime100ns:'0',utc:'1601-01-01T00:00:00.0000000Z'}};assert.deepEqual(validateStoredDocumentInformation(value),value);
 assert.notDeepEqual(storedInformationForPreservation(value),storedInformationForPreservation(empty()));
});
test('malformed dates, rounded ticks, extra owners and duration overflow fail closed',()=>{
 const good={state:'value',fileTime100ns:'132274943991234567',utc:'2020-02-29T23:59:59.1234567Z'};
 for(const bad of [{...good,fileTime100ns:132274943991234567},{...good,fileTime100ns:'132274943991234560'},{...good,utc:'2020-02-30T23:59:59.1234567Z'},{...good,utc:'2020-02-29T23:59:59.123Z'},{...good,fileTime100ns:'0132274943991234567'}])assert.throws(()=>validateStoredDocumentInformation({...empty(),created:bad}));
 assert.throws(()=>validateStoredDocumentInformation({...empty(),extra:'foreign'}));assert.throws(()=>validateStoredDocumentInformation({...empty(),editingDuration:{state:'value',ticks100ns:'18446744073709551616'}}));
});
test('invalid source values retain exact identity and are not silently dropped',()=>{
 const value={...empty(),created:{state:'invalid',fileTime100ns:'18446744073709551615'},modified:{state:'invalid',rawBlake3:'a'.repeat(64)},editingDuration:{state:'invalid',rawBlake3:'b'.repeat(64)}};
 assert.deepEqual(validateStoredDocumentInformation(value),value);assert.notDeepEqual(storedInformationForPreservation(value),storedInformationForPreservation(empty()));
});
test('unsupported versus unreadable API is disclosed without blank metadata substitution or mutation',()=>{
 assert.match(readStoredDocumentInformation({}).reason!,/지원하지/);assert.match(readStoredDocumentInformation({getDocumentStoredInformation:()=>'{malformed'}).reason!,/읽지 못/);
 const input=empty(),result=readStoredDocumentInformation({borrowDocumentHandle:()=>({getDocumentStoredInformation:()=>JSON.stringify(input)})});assert.deepEqual(result.value,input);assert.equal(result.reason,undefined);
});
