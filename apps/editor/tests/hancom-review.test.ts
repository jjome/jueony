import {test} from 'node:test';
import assert from 'node:assert/strict';
import {differences,compareSnapshots,absolutePath} from '../scripts/lib/hancom-review.mjs';

test('Hancom geometry comparison preserves 0.2 threshold without rounding or skipping fields',()=>{
 assert.deepEqual(differences({x:0},{x:0.2},0.2),[]);
 assert.equal(differences({x:0},{x:0.200001},0.2).length,1);
 assert.equal(differences({cells:[{x:0,h:1}]},{cells:[{x:0,h:1.21}]},0.2).length,1);
 assert.equal(differences({text:'A'},{text:'B'},0.2).length,1);
 assert.equal(differences({known:1,unknown:{payload:'a'}},{known:1,unknown:{payload:'b'}},0.2).length,1);
});
test('Hancom comparison retains all missing fields, array changes and nonfinite failures',()=>{
 const diff=differences({controls:[{x:1}],runs:[1,2],field:'old'},{controls:[{x:1},{x:2}],runs:[1],extra:true},0.2);
 assert.ok(diff.some(d=>d.kind==='added'));assert.ok(diff.some(d=>d.kind==='removed'));assert.ok(diff.some(d=>d.kind==='array-length'));assert.equal(differences(NaN,NaN,0.2).length,1);assert.equal(differences(1,'1',0.2).length,1);
});
test('Hancom semantic comparison is exact, page or read failure blocks equality, and no loss report is invented',()=>{
 const base={pages:1,semantic:{values:{tableHeight:10,text:'unchanged'},issues:[],unverified:['unknown payload']},layout:[{x:0}]};
 assert.equal(compareSnapshots(base,structuredClone(base)).status,'SAME_WITHIN_PUBLISHED_CONTRACT');
 for(const changed of [{...base,pages:2},{...base,semantic:{...base.semantic,values:{...base.semantic.values,tableHeight:10.01}}},{...base,semantic:{...base.semantic,issues:[{code:'unreadable',path:'field'}]}}])assert.equal(compareSnapshots(base,changed).status,'DIFFERENT_OR_UNREADABLE');
 assert.equal(Object.hasOwn(compareSnapshots(base,base),'serializerLossReport'),false);
});
test('Hancom review rejects relative input/output/package arguments',()=>{for(const p of ['',undefined,'relative.hwpx','./engine'])assert.throws(()=>absolutePath(p,'input'),/absolute/);assert.equal(typeof absolutePath(process.cwd(),'input'),'string');});
