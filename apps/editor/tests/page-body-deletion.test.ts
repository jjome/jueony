import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePageBodyDeletionPlan,samePageBodyDeletionRange} from '../src/modules/document/public/index.ts';
import {executePageBodyDeletion} from '../src/adapters/rhwp/page-body-deletion.ts';
const plan=()=>({ok:true as const,supported:true as const,page:0,section:0,firstParagraph:0,paragraphCount:1,texts:['본문 😀'],token:'a'.repeat(64),retainsEmptySection:true,pagesBefore:1,willChange:true});
test('page body deletion validates complete bounded ranges and preserves refusal reasons',()=>{
 assert.deepEqual(validatePageBodyDeletionPlan(plan()),plan());
 for(const patch of [{page:1},{texts:[]},{paragraphCount:0},{token:'bad'},{section:-1},{willChange:0},{texts:['x'.repeat(100001)]}])assert.throws(()=>validatePageBodyDeletionPlan({...plan(),...patch}));
 assert.throws(()=>validatePageBodyDeletionPlan({ok:true,supported:false,reason:'걸친 문단'}),/걸친 문단/);
 assert.equal(samePageBodyDeletionRange(plan(),{...plan(),texts:['다른 본문']}),false);
});
test('page body deletion refuses stale source tokens before any mutation',()=>{
 let writes=0;const d={getPageBodyDeletionPlan:()=>JSON.stringify({...plan(),token:'b'.repeat(64)}),deletePageBody:()=>{writes++;}};
 assert.throws(()=>executePageBodyDeletion(d,plan()),/바뀌/);assert.equal(writes,0);
 d.getPageBodyDeletionPlan=()=>JSON.stringify(plan());d.deletePageBody=()=>{writes++;return '{"ok":true,"sectionIdx":0,"paraIdx":0}' as any;};assert.deepEqual(executePageBodyDeletion(d,plan()),{sectionIndex:0,paragraphIndex:0,charOffset:0});assert.equal(writes,1);
});
