import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyManualFeaturePatches} from '../scripts/integration/manual-feature-patches.mjs';
import {applyPageBorderPatches} from '../scripts/integration/page-border-patches.mjs';
test('page dialog patch follows pinned native controls and keeps unsupported legacy capabilities gated',async()=>{
 const root=await mkdtemp(join(tmpdir(),'jueony-page-border-')),repo=fileURLToPath(new URL('../../../',import.meta.url));
 try{
  await mkdir(join(root,'src/ui'),{recursive:true});await mkdir(join(root,'src/core'),{recursive:true});await mkdir(join(root,'src/command/commands'),{recursive:true});
  for(const file of ['ui/page-border-dialog.ts','ui/cell-border-bg-dialog.ts','command/commands/insert.ts','command/commands/table.ts','core/mutation-method-registry.ts'])await copyFile(join(repo,'upstream/rhwp-source/rhwp-studio/src',file),join(root,'src',file));
  await applyManualFeaturePatches({root});await applyPageBorderPatches({root});
  const source=await readFile(join(root,'src/ui/page-border-dialog.ts'),'utf8');
  assert.match(source,/applyPageBorderDialog\(this\)/);assert.match(source,/firstOnly.disabled = !supportsPageBorderEntries/);
  assert.match(source,/createPageGradientControls\(this\)/);assert.match(source,/this.jueonyHeaderInside=this.checkbox/);
  assert.doesNotMatch(source,/const next: PageBorderFillSettings/);
  assert.match(await readFile(join(root,'src/core/mutation-method-registry.ts'),'utf8'),/'setPageBorderFillEntry'/);
  await assert.rejects(()=>applyPageBorderPatches({root}),/seam drift/);
 }finally{await rm(root,{recursive:true,force:true});}
});
