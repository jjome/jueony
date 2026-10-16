import test from 'node:test';
import assert from 'node:assert/strict';
import {acknowledgeDownloadedFile,readDownloadedFormat} from '../src/adapters/files/download-connection.ts';
import {rememberSavedFormat,readSavedFormat} from '../src/adapters/files/saved-format.ts';

test('only final acknowledgement detaches the original and establishes download name/format',()=>{
 const original={name:'original.hwp'},d={documentGeneration:1,fileName:'original.hwp',currentFileHandle:original as object|null};
 rememberSavedFormat(original,'hwp');
 assert.equal(readDownloadedFormat(d),undefined);
 // A cancelled or failed download never calls acknowledgement.
 assert.equal(d.fileName,'original.hwp');assert.equal(d.currentFileHandle,original);assert.equal(readSavedFormat(original),'hwp');
 acknowledgeDownloadedFile(d,'converted.hwpx','hwpx');
 assert.equal(d.fileName,'converted.hwpx');assert.equal(d.currentFileHandle,null);assert.equal(readSavedFormat(original),undefined);assert.equal(readDownloadedFormat(d),'hwpx');
});
test('download format follows repeated acknowledgement and cannot leak across documents or reopens',()=>{
 const d={documentGeneration:1,fileName:'new.hwp',currentFileHandle:null};
 acknowledgeDownloadedFile(d,'out.hwpx','hwpx');assert.equal(readDownloadedFormat(d),'hwpx');
 acknowledgeDownloadedFile(d,'out.hwp','hwp');assert.equal(readDownloadedFormat(d),'hwp');
 assert.equal(readDownloadedFormat({...d}),undefined);
 d.documentGeneration++;assert.equal(readDownloadedFormat(d),undefined);
 acknowledgeDownloadedFile(d,'same.hwp','hwp');d.fileName='different.hwp';assert.equal(readDownloadedFormat(d),undefined);
});
test('a new connected target takes precedence over an earlier download',()=>{
 const d={documentGeneration:3,fileName:'out.hwpx',currentFileHandle:null as object|null};
 acknowledgeDownloadedFile(d,'out.hwpx','hwpx');d.currentFileHandle={name:'out.hwpx'};assert.equal(readDownloadedFormat(d),undefined);
});
