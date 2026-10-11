import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertDocumentFrameClient} from '../src/adapters/iframe/document-client.ts';
test('iframe adapter rejects incompatible version and incomplete capability surface',()=>{
 assert.throws(()=>assertDocumentFrameClient(undefined),/연결 계약/);
 assert.throws(()=>assertDocumentFrameClient({bridgeVersion:2,snapshot(){}}),/연결 계약/);
 assert.throws(()=>assertDocumentFrameClient({bridgeVersion:1,snapshot(){}}),/연결 계약/);
});
