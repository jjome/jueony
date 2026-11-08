import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {patchFormatDialogCommands} from '../scripts/integration/format-dialog-target-patches.mjs';

const pinnedUrl=new URL('../../../upstream/rhwp-source/rhwp-studio/src/command/commands/format.ts',import.meta.url);
const paraAnchor='      const dialog = new ParaShapeDialog(services.wasm, services.eventBus);';
const nestedAnchor='        const defaultTabs = new DefaultTabSpacingDialog(services, curPos.sectionIndex, applied);';
const tabFeature=(source:string)=>"import { DefaultTabSpacingDialog } from '@/ui/default-tab-spacing-dialog';\n"+source.replace(paraAnchor,`${paraAnchor}
      dialog.onDefaultTabSpacingChange = (applied) => {
${nestedAnchor}
        defaultTabs.afterClose = () => document.querySelector<HTMLElement>('[data-jueony-default-tab-change]')?.focus();
        defaultTabs.show();
      };`);

test('pinned upstream without the engine-gated tab dialog keeps ordinary target guards',async()=>{
  const pinned=await readFile(pinnedUrl,'utf8'),patched=patchFormatDialogCommands(pinned);
  assert.equal((patched.match(/captureFormatDialogTarget\(services\)/gu)??[]).length,2);
  assert.equal((patched.match(/dialogTarget\.assertCurrent\(\)/gu)??[]).length,2);
  assert.doesNotMatch(patched,/acceptOwnChange/);
});

test('tab-feature fixture retains nested target assertion and accepts only its owned edit',async()=>{
  const pinned=await readFile(pinnedUrl,'utf8'),patched=patchFormatDialogCommands(tabFeature(pinned));
  assert.match(patched,/try \{ dialogTarget\.assertCurrent\(\); \} catch\(error\) \{ showFormatDialogError\(dialog,error\); return; \}/u);
  assert.match(patched,/raw => \{ dialogTarget\.acceptOwnChange\(\); applied\(raw\); \}/u);
});

test('tab feature declaration with a drifted nested callback fails closed',async()=>{
  const pinned=await readFile(pinnedUrl,'utf8'),drifted=tabFeature(pinned).replace(nestedAnchor,'        const defaultTabs = new DefaultTabSpacingDialog(services, curPos.sectionIndex, value => applied(value));');
  assert.throws(()=>patchFormatDialogCommands(drifted),/nested owned edit/);
  assert.throws(()=>patchFormatDialogCommands(pinned.replace(paraAnchor,'      const dialog = makeParaDialog(services);')),/Para capture/);
});
