import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldProtectExit} from '../src/modules/session/public/index.ts';
test('clean persisted workspace exits while any unsaved or failed tab protects the whole host',()=>{
 const clean={persistenceFailed:false,pendingWrites:0,closing:false,running:false,documents:[{dirty:false,persistenceFailed:false,preferenceFailed:false,pendingWrites:0}]};
 assert.equal(shouldProtectExit(clean),false);
 for(const key of ['persistenceFailed','closing','running'])assert.equal(shouldProtectExit({...clean,[key]:true}),true);
 assert.equal(shouldProtectExit({...clean,pendingWrites:1}),true);
 for(const key of ['dirty','persistenceFailed','preferenceFailed'])assert.equal(shouldProtectExit({...clean,documents:[clean.documents[0],{...clean.documents[0],[key]:true}]}),true);
 assert.equal(shouldProtectExit({...clean,documents:[{...clean.documents[0],pendingWrites:1}]}),true);
});
