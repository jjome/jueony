import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyFormattingToolbarPatches} from '../scripts/integration/formatting-toolbar-patches.mjs';
test('pinned visible formatting toolbar routes fonts and sizes through registered dispatcher commands',async()=>{
 const root=await mkdtemp(join(tmpdir(),'jueony-format-bar-')),repo=fileURLToPath(new URL('../../../',import.meta.url));
 try{await mkdir(join(root,'src/ui'),{recursive:true});await mkdir(join(root,'src/command/commands'),{recursive:true});
  for(const file of ['ui/toolbar.ts','command/commands/format.ts'])await copyFile(join(repo,'upstream/rhwp-source/rhwp-studio/src',file),join(root,'src',file));
  await applyFormattingToolbarPatches({root});const source=await readFile(join(root,'src/ui/toolbar.ts'),'utf8');
  assert.match(source,/installNativeFormattingBoundary\(this\)/);assert.match(source,/commitToolbarFont\(this,this.fontName.value\)/);assert.match(source,/if\(event.detail===0\)apply\(\)/);
  assert.doesNotMatch(source,/fontSize: Math.round\(clampedPt \* 100\)/);
  assert.match(await readFile(join(root,'src/command/commands/format.ts'),'utf8'),/\.\.\.formattingToolbarCommands/);
  await assert.rejects(()=>applyFormattingToolbarPatches({root}),/seam drift/);
 }finally{await rm(root,{recursive:true,force:true});}
});
