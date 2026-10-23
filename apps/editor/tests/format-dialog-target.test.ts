import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFormatDialogTarget} from '../src/adapters/browser/format-dialog-target.ts';

test('unchanged dialog target remains usable',()=>{const s={generation:1,revision:'1:0',input:{},selection:'a'},g=createFormatDialogTarget(()=>s);g.assertCurrent();g.assertCurrent();});
for(const key of ['generation','revision','input','selection'] as const)test(`rejects changed ${key} without consuming or updating original target`,()=>{const initial={generation:1,revision:'1:0',input:{},selection:'a'};let s={...initial};const g=createFormatDialogTarget(()=>s);s={...s,[key]:key==='input'?{}:'changed'} as typeof s;assert.throws(()=>g.assertCurrent(),/변경/);assert.throws(()=>g.assertCurrent(),/변경/);s={...initial};g.assertCurrent();});
test('owned nested edit refreshes the target but cannot bless a different document',()=>{let s={generation:1,revision:'1:0',input:{},selection:'a'};const g=createFormatDialogTarget(()=>s);s={...s,revision:'1:1'};g.acceptOwnChange();g.assertCurrent();s={...s,generation:2};assert.throws(()=>g.acceptOwnChange(),/다른 문서/);assert.throws(()=>g.assertCurrent(),/변경/);});
