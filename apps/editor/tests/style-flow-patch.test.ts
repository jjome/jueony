import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {applyStyleFlowPatches} from '../scripts/integration/style-flow-patches.mjs';

const repo=resolve(import.meta.dirname,'../../..');

test('Studio style patch captures a stored character-style reference before applying it',async()=>{
  const root=await mkdtemp(resolve(repo,'build/style-flow-contract-'));
  const files=['engine/input-handler.ts','engine/command.ts','command/commands/format.ts'];
  for(const file of files){
    const target=join(root,'src',file);
    await mkdir(resolve(target,'..'),{recursive:true});
    await writeFile(target,await readFile(resolve(repo,'upstream/rhwp-source/rhwp-studio/src',file)));
  }
  await applyStyleFlowPatches({root});
  const source=await readFile(join(root,'src/engine/input-handler.ts'),'utf8');
  assert.match(source,/captureStoredCharacterStyle/);
  assert.match(source,/applySelectedCharacterStyle\(this,this\.wasm,captureStoredCharacterStyle\(this\.wasm,styleId\)\)/);
  assert.doesNotMatch(source,/applySelectedCharacterStyle\(this,this\.wasm,styleId\)/);
  await assert.rejects(applyStyleFlowPatches({root}),/drift/);
});
