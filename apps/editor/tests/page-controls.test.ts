import test from 'node:test';
import assert from 'node:assert/strict';
import {pageHideFlags,findPageHideTarget,writePageHide} from '../src/adapters/rhwp/page-controls.ts';
test('page-hide preserves all six independent flags and rejects unreadable data',()=>{
 const flags=pageHideFlags({ok:true,hideHeader:true,hideFooter:false,hideMasterPage:true,hideBorder:true,hideFill:true,hidePageNum:true});
 let args:unknown[]=[];writePageHide({setPageHide(...value:unknown[]){args=value;return '{"ok":true}';}},{sectionIndex:2,paragraphIndex:5},flags);
 assert.deepEqual(args,[2,5,true,false,true,true,true,true]);
 assert.throws(()=>pageHideFlags({ok:false}),/읽지/);
 assert.throws(()=>writePageHide({setPageHide(){return '{"ok":false}';}},{sectionIndex:0,paragraphIndex:0},flags),/적용/);
});
test('page-hide reuses an existing flag control on same page without creating contradictory controls',()=>{
 const doc={getSectionCount:()=>1,getParagraphCount:()=>3,getPageHide:(_s:number,p:number)=>({ok:true,exists:p===0}),getPageOfPosition:(_s:number,p:number)=>({ok:true,page:p===2?1:0})};
 assert.deepEqual(findPageHideTarget(doc,0,{sectionIndex:0,paragraphIndex:1}),{sectionIndex:0,paragraphIndex:0});
 assert.deepEqual(findPageHideTarget(doc,1,{sectionIndex:0,paragraphIndex:2}),{sectionIndex:0,paragraphIndex:2});
 assert.throws(()=>findPageHideTarget({...doc,getPageHide:()=>({ok:true,exists:true})},0,{sectionIndex:0,paragraphIndex:0}),/여러 감추기/);
 assert.throws(()=>findPageHideTarget({...doc,getPageHide:()=>({ok:true,exists:false})},1,{sectionIndex:0,paragraphIndex:0}),/여러 쪽/);
});
